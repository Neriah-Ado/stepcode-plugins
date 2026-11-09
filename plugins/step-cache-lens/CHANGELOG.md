# Changelog — step-cache-lens

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/cache-audit` 逐轮缓存重建检测：hit/rebuild 单行表 + 嫌疑前缀变更清单（移植自 dsh-cache-miss）
- `/cache-stabilize` 前缀稳定化审计：命中率/重发率/波动归因三指标 + diff 草稿（待确认）（移植自 dsh-cache-stabilizer）
- 大会话明细落盘 `docs/cache-lens/`，输出只带摘要（C5）

## [1.1.0] - 2026-11-10

### 新增

- `/cache-audit` 落盘报告带逐轮统计摘要与内容校验和，可独立复核
- `/cache-stabilize` 三指标快照落盘 `docs/cache-lens/metrics-*.json`

## [1.2.0] - 2026-11-10

### 新增

- 会话字段缺失区分「未导出/已迁移」两态，分别给采集或迁移指引（G4）

## [1.3.0] - 2026-11-10

### 变更

- `/cache-audit` 默认只扫最近 50 轮（`--all` 显式全量），防无界扫描

## [1.4.0] - 2026-11-10

### 安全

- 输出中本机用户目录路径脱敏

## [1.5.0] - 2026-11-10

### 新增

- `/cron` 接入与退出码约定（0 正常 / 1 发现重建 / 2 依赖缺失）
