---
description: "模板 log-patrol：日志巡检，错误聚合日报"
---

# 日志巡检（log-patrol）

- 触发频率建议：每日 08:30（`30 8 * * *`）
- 任务 prompt：扫描 `logs/**/*.log`（或参数指定目录）近 24h 新增内容，按错误模式聚合（正则规则：error/exception/fatal/ECONNREFUSED/timeout/OOM），统计频次并各取 1 条样本；日报写入 `docs/cron/log-patrol.md`。
- 输出落盘路径：`docs/cron/log-patrol.md`
- 依赖声明：无（纯本地读取）；日志目录不存在时报告「无日志可巡检」不算失败。
- 纪律：只读；单文件超过 5MB 只取尾部 1000 行（C5）。
