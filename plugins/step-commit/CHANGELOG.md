# Changelog — step-commit

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-09-26

### Added

- `step.plugin.json` 插件清单，接入仓库 marketplace 源。(SC-100-1)
- `/commit`：staged diff 分析 → Conventional Commits 规范 message（type/scope/subject/正文/ BREAKING CHANGE footer），HEREDOC 格式化提交；内置安全规则（不 amend 已推送提交、不 force push、先 status/diff 再动作、不 `--no-verify`、不碰机密、不全量暂存）与 pre-commit hook 失败恢复流程。(SC-100-2)
- `/commit-push-pr`：提交后推送远端并用 gh 创建 PR（标题复用提交规范、正文含摘要/变更点/测试说明/issue 关联）；gh 缺失时输出安装指引而非裸报错。(SC-100-3)
- 门禁校验脚本 `tests/validate.mjs`：清单规范（G2）、Conventional Commits 格式、命令安全规则存在性检查。
