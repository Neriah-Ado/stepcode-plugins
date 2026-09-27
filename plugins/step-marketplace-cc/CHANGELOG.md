# Changelog — step-marketplace-cc

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。
本插件为市场仓库元项目（无 step.plugin.json，清单即 .step-plugin/marketplace.json），CHANGELOG 为人工维护。

## [1.3.0] - 2026-09-27

### Added
- 原生化：本仓库 11 个自研原生插件与迁移目录共存索引；星级/实测徽章字段（MC-130-1, MC-130-2）

## [1.2.0] - 2026-09-27

### Added
- 兼容性 CI 检测（validate.mjs 规则级批量校验）与修复 PR 草稿生成（MC-120-1, MC-120-2）

## [1.1.0] - 2026-09-27

### Added
- 收录目录按 Git/测试/前端/文档/运维 分类；逐条实测表现标注（MC-110-1, MC-110-2）

## [1.0.0] - 2026-09-27

### Added
- 市场仓库骨架与收录目录 catalog.json（10 条，锁定版本 + 诚实占位说明）（MC-100-1, MC-100-2）
- 兼容性检查器 analyzeCcPlugin：native/patched/incompatible 三态 + lspServers/entry 自动剔除修补（MC-100-3）
- README 分类索引与兼容性标注表（MC-100-4）
