---
description: 运行测试套件，解析输出为结构化失败清单，交给 test-fix-loop skill 进入修复循环
argument-hint: [测试范围或框架提示，可选；如 "src/auth" 或 "pytest"]
---

# /test — 测试守护入口

运行测试 → 结构化解析失败 → 交给 skills/test-fix-loop/SKILL.md 的修复循环。本命令只负责「跑」与「解析」，修复规则见 skill。

## 纪律（先读）

1. 诊断完成前**不改任何业务代码**；只跑测试、读输出。
2. 测试原始输出**落盘不内联**（C5 token 经济）：重定向到 `docs/test-guard/last-run.log`，会话中只出现解析后的失败清单。
3. 不删除、不禁用测试来让问题消失；不修改断言期望值，除非用户确认测试本身写错了。
4. 单次运行超时上限默认 10 分钟，超时先询问用户（卡住的测试本身就是归因线索）。

## 1. 框架检测（顺序匹配，命中即止）

<!-- TEST-DETECT-START -->
```json
{
  "detectors": [
    { "file": "vitest.config.{ts,js,mts,js,cjs}", "stack": "vitest", "run": "npx vitest run" },
    { "file": "jest.config.{ts,js,mjs,cjs}", "stack": "jest", "run": "npx jest" },
    { "file": "pytest.ini", "stack": "pytest", "run": "python -m pytest -q" },
    { "file": "pyproject.toml[tool.pytest.ini_options]", "stack": "pytest", "run": "python -m pytest -q" },
    { "file": "conftest.py", "stack": "pytest", "run": "python -m pytest -q" },
    { "file": "go.mod", "stack": "go", "run": "go test ./..." },
    { "file": "Cargo.toml", "stack": "cargo", "run": "cargo test" },
    { "file": "pom.xml", "stack": "maven", "run": "mvn test" },
    { "file": "build.gradle", "stack": "gradle", "run": "gradle test" },
    { "file": "package.json:scripts.test", "stack": "node", "run": "npm test" }
  ],
  "fallback": "以上全未命中时，列出候选证据并询问用户使用什么测试命令；不猜测"
}
```
<!-- TEST-DETECT-END -->

参数中用户指定的框架/范围优先于自动检测。

## 2. 运行

```bash
mkdir -p docs/test-guard && <run 命令> > docs/test-guard/last-run.log 2>&1; echo "exit=$?"
```

- 记录退出码与耗时；失败时从 `docs/test-guard/last-run.log` 提取失败段解析（一般只有最后 1/3 是失败明细）。
- 增量范围：参数给了路径/用例过滤时按范围跑；修复循环内的重跑规则见 skill。

### 失败用例缓存（增量重跑）

<!-- CACHE-RULES-START -->
```json
{
  "cache_path": "docs/test-guard/failed-cases.json",
  "entry_format": { "stack": "vitest", "file": "src/a.test.ts", "case": "用例名" },
  "policy": "修复循环开始前先跑缓存失败集拿快速信号；全量确认通过后清空缓存；无缓存或缓存与当前范围不符时直接全量",
  "write_moment": "每轮全量跑后写入当前失败集；全绿时清空"
}
```
<!-- CACHE-RULES-END -->

- 缓存按 `file + case` 去重合并；`stack` 变化时视为范围不符，直接全量。
- 缓存只作为**加速信号**：快速信号为空不代表没有失败，最终以全量确认为准（宁可多跑，不可漏报）。

## 3. 解析为结构化失败清单

输出格式（每个失败用例一条）：

```
- case:    <用例名>
  file:    <文件[:行号]>
  expect:  <期望>
  actual:  <实际>
  triage:  assertion | environment | regression   （初判，SKILL 中有判定标准）
```

解析规则与三框架的输出模式见下方「框架输出解析」（v1.0.0 内置 vitest/jest/pytest）。解析不出结构化信息的失败（如进程崩溃、编译错误）原样摘录最后 30 行并标记 `triage: environment` 待定。

### 框架输出解析（按行扫描，模式与 tests/lib/test-parse.mjs 共用）

<!-- TEST-PATTERNS-START -->
```json
{
  "vitest": {
    "fail_file": "FAIL\\s+(\\S+)",
    "block_file": "❯\\s+(\\S+)\\s+\\(",
    "fail_case": "[✗×✘]\\s+(.+?)(?:\\s+\\d+ms)?$",
    "detail_line": "→\\s+(.*)$"
  },
  "jest": {
    "fail_file": "FAIL\\s+(\\S+)",
    "fail_case": "[✕×●]\\s+(.+?)(?:\\(\\d+\\s*ms\\))?$",
    "expect": "Expected:\\s*(.*)$",
    "received": "Received:\\s*(.*)$"
  },
  "pytest": {
    "summary_line": "FAILED\\s+(\\S+?)::(\\S+?)(?:\\s+-\\s+(.*))?$",
    "detail_line": "^E\\s+(.*)$"
  },
  "go": {
    "fail_case": "^--- FAIL:\\s+(\\S+)",
    "detail_line": "^\\s+(\\S+?\\.go):\\d+:\\s+(.*)$"
  },
  "cargo": {
    "fail_case": "^test\\s+(\\S+)\\s+.*FAILED$",
    "panic_file": "panicked at ([^:]+):",
    "assert_left": "left:\\s*`([^`]*)`",
    "assert_right": "right:\\s*`([^`]*)`"
  },
  "gradle": {
    "fail_case": "^(\\S+)\\s*>\\s*(\\S+)\\s+FAILED$"
  },
  "maven": {
    "fail_case": "\\[ERROR\\]\\s+(\\S+)\\.([A-Za-z_][A-Za-z_0-9]*):(.*)$"
  }
}
```
<!-- TEST-PATTERNS-END -->

扫描语义：`FAIL <file>` 切换当前文件；用例行（vitest `×`、jest `●`）创建失败条目；`Expected/Received`（jest）与 `→`（vitest）附到最近条目；pytest 从 `FAILED file::case` 汇总行建条目、`E ` 行为断言明细；go 从 `--- FAIL: 用例` 建条目、缩进的 `file.go:行: 消息` 为明细；cargo 从 `test 路径 ... FAILED` 建条目、`panicked at 文件:` 与 `left/right` 反引号为期望对比；gradle `类 > 用例 FAILED`；maven `[ERROR] 类.方法: 明细`。命中不了的行忽略；输出非 UTF-8 时先转码再解析。

## 4. 覆盖率解读（有产物才做，可跳过）

测试全绿后，若仓库存在覆盖率产物则解读（读取与阈值规则见下表）；**没有产物时跳过，不算失败**。

<!-- COVERAGE-RULES-START -->
```json
{
  "artifacts": {
    "istanbul": ["coverage/coverage-summary.json"],
    "cobertura": ["cobertura.xml", "coverage/cobertura-coverage.xml"]
  },
  "default_threshold": 80,
  "hint": "汇报整体行覆盖率；低于阈值的文件列为「未覆盖关键路径提示」，只提示不阻断"
}
```
<!-- COVERAGE-RULES-END -->

## 5. 交接

把失败清单交给 test-fix-loop skill 执行修复循环；全部通过时汇报：通过数、耗时、框架、有无跳过/待办（`todo`/`skip` 计数单列）。
