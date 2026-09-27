---
description: "模板 site-alive：静态站存活检查，联动 steppage"
---

# 静态站存活检查（site-alive）

- 触发频率建议：每 6 小时（`0 */6 * * *`）
- 任务 prompt：对 steppage 已发布站点（或参数给定 URL）发 HEAD 请求，非 200 记录故障与时间线；连续 2 次失败标记「疑似下线」；报告写入 `docs/cron/site-alive.md`。
- 输出落盘路径：`docs/cron/site-alive.md`
- 依赖声明：内置 steppage 插件（查询已发布链接，可选）；核心检查仅需 fetch。
- 纪律：只读探测；不做自动重部署。
