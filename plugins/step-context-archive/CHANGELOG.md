# Changelog — step-context-archive

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

<!-- 版本节由 tests/bootstrap-changelog.mjs 从 git 历史自举生成 -->

## [1.0.0] - 2026-10-01

### Added
- 实现 /recall 命令与 context-archive 技能，补充 README 索引与 CHANGELOG (SCA-100-3)
- 实现 /archive 归档命令（原文落盘 + 三点摘要索引 + 完成状态汇报）(SCA-100-2)
- 新增 step-context-archive 插件清单并登记 roadmap/marketplace (SCA-100-1)

### Fixed
- #STAMP 索引行改项目相对路径并明确退化 id 例外 (SCA-100)

### Other Changes
- 发布 step-context-archive v1.0.0，SCA-100-4 置 done (SCA-100-4)
- license: switch MIT to AGPL-3.0-only
- 自举 /changelog 刷新 step-context-archive 条目 (SCA-100)
- 自举 /changelog 生成 step-context-archive CHANGELOG (SCA-100)
- /archive 与 /recall 补充 validate 规则块 (SCA-100)
- 补全参考实现的许可引用链接与许可名 (SCA-100-5)
- 如实标注插件资源在当前宿主的加载状态 (SCA-100-3)
