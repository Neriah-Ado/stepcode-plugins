# Changelog — step-plan-quota

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/plan-quota` 订阅额度只读查询：进度条 + 触顶预估；凭据只走环境变量，未配置输出 export 引导（移植自 dsh-cost-meter 差异化子集）
- `/price-peak` 峰谷窗口判定、窗口表校验与切换前提醒规则，支持接入 /cron
- 用量统计不重复建设，由 step-token-meter 覆盖（映射见发布说明）

## [1.1.0] - 2026-11-10

### 新增

- 输出附字段映射口径（命中键与解析依据），额度数字可复核

## [1.2.0] - 2026-11-10

### 新增

- 错误细分：超时/401/403/429 各给针对性指引（G4）

## [1.3.0] - 2026-11-10

### 变更

- 字段匹配 first-match-wins 即停，减少解析开销

## [1.4.0] - 2026-11-10

### 安全

- `PLAN_QUOTA_URL` 仅接受 http/https；输出中本机路径脱敏

## [1.5.0] - 2026-11-10

### 新增

- 额度快照落盘 `docs/plan-quota/snapshots-*.jsonl`，支持 /cron 趋势记录
