---
description: "模板 page-monitor：页面监控，联动 playwright 截图 diff"
---

# 页面监控（page-monitor）

- 触发频率建议：每日 10:00（`0 10 * * *`）
- 任务 prompt：对参数给定 URL 列表逐个截图（复用内置 playwright 插件），与上一轮截图做文件摘要对比；差异页写明「疑似变更」；报告写入 `docs/cron/page-monitor.md`（含逐 URL 状态与截图路径）。
- 输出落盘路径：`docs/cron/page-monitor.md`，截图存 `docs/cron/shots/`
- 依赖声明：内置 playwright 插件；未安装时降级为「仅记录 HTTP 状态码与响应字节数」。
- 纪律：只读监控，不外发数据。
