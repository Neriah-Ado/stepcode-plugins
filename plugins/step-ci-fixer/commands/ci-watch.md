---
description: "/goal 挂机修 CI：持续监控 run 状态直到绿或超时，进度报告落盘 docs/ci-watch.md（无头只读）"
argument-hint: [run ID 与超时分钟数，可选；如 "9001 120"]
---

# /ci-watch — 挂机修 CI 模式（/goal 长托管接入）

在 /ci-fix 完成「修复 + push + rerun」后，用本命令托管等待结果。设计为无人值守：只读轮询 + 落盘报告。

<!-- WATCH-RULES-START -->
```json
{
  "headless": "配合 /goal 使用：goal 描述 = \"按 plugins/step-ci-fixer/commands/ci-watch.md 监控 run <id> 直到绿或超时\"",
  "poll_interval_min": 5,
  "timeout_min": 120,
  "report": "docs/ci-watch.md",
  "exit_semantics": { "green": "0", "timeout_still_red": "1", "run_error": "2" },
  "readonly": "只调用 run_status / list_failed_runs；不自动 push、不自动改代码；发现新失败转人工或重新走 /ci-fix（用户已授权时）"
}
```
<!-- WATCH-RULES-END -->

## 流程

1. 每轮调 `run_status`：`queued/in_progress` → 记录一行进度；`completed` → 结论。
2. 每轮把进度**追加**写入 `docs/ci-watch.md`（时间 / 状态 / 已等待分钟 / 最近结论）；会话侧每 3 轮给一行摘要（C5）。
3. `success` → 报告标记 GREEN，退出码 0。
4. `failure` → `fetch_run_log` 截取新错误段，与上轮对比，标注「新错误/仍为旧错」；退出码 1；用户预先授权自动修复时才回写代码（否则转人工）。
5. 超过 `timeout_min` → 报告标记 TIMEOUT，退出码 1，附最后一次状态与建议。
