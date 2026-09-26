# Changelog — step-test-guard

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

<!-- 版本节由 tests/bootstrap-changelog.mjs 从 git 历史自举生成 -->

## [1.3.0] - 2026-09-27

### Added
- /flaky 识别与隔离建议 (TG-130-2)
- /bisect 回归根因定位命令 (TG-130-1)

### Other Changes
- 自举 /changelog 生成 step-test-guard v1.3.0 条目 (TG-130)
- 标记 step-test-guard v1.3.0 任务完成
- 清单升级 v1.3.0 并补充深水区命令说明
- flaky 可复现与 bisect 定位端到端验证 (TG-130)

## [1.2.0] - 2026-09-27

### Added
- /nightly-test 接入 /cron 无头夜间任务 (TG-120-1)

### Other Changes
- 自举 /changelog 生成 step-test-guard v1.2.0 条目 (TG-120)
- 标记 step-test-guard v1.2.0 任务完成
- 清单升级 v1.2.0 并补充夜间守护说明
- 新增报告渲染与上轮对比校验 (TG-120-2)

## [1.1.0] - 2026-09-27

### Added
- 新增失败用例缓存与增量重跑 (TG-110-3)
- 新增 istanbul/cobertura 覆盖率报告解读 (TG-110-2)
- 新增 go/cargo/maven/gradle 输出解析 (TG-110-1)

### Other Changes
- 自举 /changelog 生成 step-test-guard v1.1.0 条目 (TG-110)
- 标记 step-test-guard v1.1.0 任务完成
- 清单升级 v1.1.0 并补充生态扩展说明

## [1.0.0] - 2026-09-27

### Added
- 编写 step-test-guard 插件清单 (TG-100-1)
- 内置 vitest/jest/pytest 输出解析与框架检测 (TG-100-4)
- 实现 test-fix-loop 修复循环 skill (TG-100-3)
- 实现 /test 测试守护入口命令 (TG-100-2)

### Other Changes
- 自举 /changelog 生成 step-test-guard CHANGELOG (TG-100)
- 标记 step-test-guard v1.0.0 任务完成
- 补充 step-test-guard 文档与多插件自举脚本 (G5)
- 引入插件仓库骨架与全局开发规范
