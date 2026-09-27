# Changelog — step-token-meter

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

<!-- 版本节由 tests/bootstrap-changelog.mjs 从 git 历史自举生成 -->

## [1.3.0] - 2026-09-27

### Added
- 预算告警/多机合并/schema migration 适配层 (TM-130-1, TM-130-2, TM-130-3)

### Other Changes
- 自举 /changelog 生成 step-token-meter v1.3.0 条目 (TM-130)
- 标记 step-token-meter v1.3.0 完成并接入市场源

## [1.2.0] - 2026-09-27

### Added
- 本地 HTML 报告与 /cron 周报规则 (TM-120-1, TM-120-2)

### Other Changes
- 自举 /changelog 生成 step-token-meter v1.2.0 条目 (TM-120)
- 标记 step-token-meter v1.2.0 任务完成

## [1.1.0] - 2026-09-27

### Added
- 清单注册 mcpServers 并新增 MCP 冒烟校验 (TM-110-3)
- 零依赖 MCP server 化 get_usage/get_usage_by_model (TM-110-1)

### Other Changes
- 自举 /changelog 生成 step-token-meter v1.1.0 条目 (TM-110)
- 标记 step-token-meter v1.1.0 任务完成

## [1.0.0] - 2026-09-27

### Added
- CSV 导出与容错解析层 (TM-100-3, TM-100-4)
- 实现 /usage 聚合与成本粗估命令 (TM-100-2)
- 逆向会话存储格式并建容错策略文档 (TM-100-1)

### Other Changes
- 自举 /changelog 生成 step-token-meter CHANGELOG (TM-100)
- 补充 step-token-meter 文档并标记 v1.0.0 完成 (G5)
- 引入插件仓库骨架与全局开发规范
