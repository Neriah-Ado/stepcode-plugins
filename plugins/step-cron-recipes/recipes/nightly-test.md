---
description: "模板 nightly-test：夜间全量测试，联动 step-test-guard，未安装时降级为基础测试说明"
---

# 夜间全量测试（nightly-test）

- 触发频率建议：每日 03:00（`0 3 * * *`）
- 任务 prompt：检测仓库测试框架并全量运行（框架检测与输出解析优先复用 step-test-guard 插件：`/plugin list` 确认已安装则按其 /nightly-test 流程）；结果写入 `docs/cron/nightly-test.md`（摘要/失败明细/与上轮对比）。
- 输出落盘路径：`docs/cron/nightly-test.md`
- 依赖声明：step-test-guard ≥1.2.0（可选）；未安装时降级为「运行 package.json scripts.test 并记录退出码与输出尾部 30 行」。
- 纪律：无头模式**不改代码**，失败只报告。
