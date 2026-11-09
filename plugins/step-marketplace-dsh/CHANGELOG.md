# Changelog — step-marketplace-dsh

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `catalog.json` 收录 6 个 dsh 插件：upstream / lockedVersion / category / compat / port / note 字段完整
- 可移植性规则级标注：5 项 ported（dsh-cache-miss、dsh-cache-stabilizer → step-cache-lens；graph-memory → step-graph-memory；dsh-cost-meter → step-plan-quota；dsh-plugin-hub → 本插件）、1 项 not-portable（dsh-whale-widget，宿主 UI 依赖）
- 诚实约定：规则级判定与待实测状态显式声明
