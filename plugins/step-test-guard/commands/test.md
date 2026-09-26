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

## 4. 交接

把失败清单交给 test-fix-loop skill 执行修复循环；全部通过时汇报：通过数、耗时、框架、有无跳过/待办（`todo`/`skip` 计数单列）。
