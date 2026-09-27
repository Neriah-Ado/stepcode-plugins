---
description: "文档-代码一致性周检（/cron 可接入）：从 git diff 判断需更新的文档段落，报告落盘 docs/stale-report.md"
argument-hint: [对比范围，可选；默认近 7 天]
---

# /doc-guard — 文档一致性守护

<!-- DOC-GUARD-RULES-START -->
```json
{
  "detect": "git diff --name-only <范围> 取变更代码文件 → 与 docs/README 中出现的文件路径/函数名交叉比对（tests/lib/i18n.mjs 的 staleCheck）",
  "report": "docs/stale-report.md：逐条列出 过期文档 / 关联代码 / 建议",
  "cron": "建议 /cron 每周一 09:30 周检；无头模式只写报告不发通知",
  "exit_semantics": { "all_fresh": "0", "has_stale": "1", "error": "2" }
}
```
<!-- DOC-GUARD-RULES-END -->

## 流程

1. 取变更文件清单（`git diff --name-only @{u}` 或按天数）；文档集合 = docs/**/*.md + README*.md。
2. `staleCheck` 交叉比对 → 写报告（C5，终端只给计数与路径）。
3. 注入式验收：validate 用「文档提及 src/auth.ts + 该文件在变更列表」样本必须全部检出。
