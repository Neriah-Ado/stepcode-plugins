# Changelog — step-cache-lens

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/cache-audit` 逐轮缓存重建检测：hit/rebuild 单行表 + 嫌疑前缀变更清单（移植自 dsh-cache-miss）
- `/cache-stabilize` 前缀稳定化审计：命中率/重发率/波动归因三指标 + diff 草稿（待确认）（移植自 dsh-cache-stabilizer）
- 大会话明细落盘 `docs/cache-lens/`，输出只带摘要（C5）
