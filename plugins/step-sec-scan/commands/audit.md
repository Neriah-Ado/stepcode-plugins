---
description: "安全审计：/audit 依赖漏洞 + secret 泄漏扫描，结构化报告落盘 docs/security-report.md（终端只给摘要）"
argument-hint: [--staged 增量 / --full 全量 / --baseline 基线模式，可选]
---

# /audit — 安全审计

## 流程

1. **secret 扫描**：`--staged`（默认）对 `git diff --staged` 增量扫描；`--full` 扫全仓库文本（排除 node_modules/.git）。调 MCP 工具 `scan_secrets`（内置模式表 + 降噪规则，与 tests/lib 与 skills/sec-audit 一致）。
2. **依赖漏洞**：`npm_audit`（npm 缺失给安装指引，G4）；`--multi-ecosystem`（v1.1.0）追加 pip-audit / cargo audit（二进制缺失给指引并继续其他生态）。
3. **基线模式**（v1.2.0，`--baseline`）：`baseline_diff` 区分**新引入 vs 存量**，默认只报新引入；基线存 `.stepcode/sec-baseline.json`（`baseline_save` 更新）。
4. **报告落盘**（C5）：`report` 渲染 Markdown → `docs/security-report.md`；终端只给摘要（计数/最高严重度/前 3 条）。

## 修复建议格式

- secret：**立即轮换**该凭据 + 从 git 历史清除（git filter-repo）；
- 依赖：可自动修复的给 `npm audit fix` 方案；否则给 advisory 链接与升级建议（v1.3.0 可自动建修复 PR，G3 确认）。

## CI 卡点（v1.3.0，`--gate`）

`ci_gate`：默认 critical/high 阻断；配置 `.stepcode/sec-gate.json` 的 `fail_on` 数组覆盖；返回 pass/blocking 供 CI 退出码使用（pass=0）。
