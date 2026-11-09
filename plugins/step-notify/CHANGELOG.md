# Changelog — step-notify

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/notify` 多渠道推送（Bark/Server酱/企业微信/钉钉/Telegram/飞书/ntfy/自定义 webhook）：默认 dry-run、真实发送先确认、密钥脱敏（移植自 chicheng-push）
- `/notify-channels` 渠道配置校验：环境变量齐套性检查 + 可选连通性探测（需确认）
- 八渠道环境变量表与 export 引导（G4）
