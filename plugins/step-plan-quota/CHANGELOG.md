# Changelog — step-plan-quota

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/plan-quota` 订阅额度只读查询：进度条 + 触顶预估；凭据只走环境变量，未配置输出 export 引导（移植自 dsh-cost-meter 差异化子集）
- `/price-peak` 峰谷窗口判定、窗口表校验与切换前提醒规则，支持接入 /cron
- 用量统计不重复建设，由 step-token-meter 覆盖（映射见发布说明）
