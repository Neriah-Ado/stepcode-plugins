# Changelog — step-notify

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/notify` 多渠道推送（Bark/Server酱/企业微信/钉钉/Telegram/飞书/ntfy/自定义 webhook）：默认 dry-run、真实发送先确认、密钥脱敏（移植自 chicheng-push）
- `/notify-channels` 渠道配置校验：环境变量齐套性检查 + 可选连通性探测（需确认）
- 八渠道环境变量表与 export 引导（G4）

## [1.1.0] - 2026-11-10

### 新增

- 发送审计记录落盘 `docs/notify/audit-*.jsonl`（脱敏，落盘前确认），外发历史可回查

## [1.2.0] - 2026-11-10

### 新增

- 错误细分：401/403/429/超时各给针对性指引（G4），429 明确冷却后手动重试

## [1.3.0] - 2026-11-10

### 变更

- payload 大小上限 4KB，超出截断提醒，不发送超大负载

## [1.4.0] - 2026-11-10

### 安全

- webhook/ntfy URL 仅接受 http/https；headers 大小上限 2KB

## [1.5.0] - 2026-11-10

### 新增

- step-gungnir 完成报告可选推送（走既有确认链）
