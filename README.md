# stepcode-plugins

[Step Code](https://github.com/stepfun-ai/Step-Code)（阶跃星辰终端 AI Agent）第三方插件集合。全部插件为声明式形态：`step.plugin.json` 清单 + `commands/` `skills/` Markdown 资源，遵循 [AGENTS.md](./AGENTS.md) 执行规范与版本门禁。

## 插件索引

| 插件 | 版本 | 说明 |
| --- | --- | --- |
| [step-commit](./plugins/step-commit) | ![v1.3.0](https://img.shields.io/badge/version-1.3.0-blue) | Git 提交工作流套件：`/commit` 规范提交、`/commit-push-pr` 提交并建 PR、`/changelog` 发布辅助、`/release-pr` 发布 PR |
| [step-test-guard](./plugins/step-test-guard) | ![v1.3.0](https://img.shields.io/badge/version-1.3.0-blue) | 测试守护循环：`/test` 运行测试 → 失败归因 → 定点修复 → 重跑闭环 |
| [step-token-meter](./plugins/step-token-meter) | ![v1.3.0](https://img.shields.io/badge/version-1.3.0-blue) | 本地 Token 用量统计：`/usage` 聚合与成本粗估、MCP 工具、HTML 报告，纯本地零网络 |
| [step-docker-mate](./plugins/step-docker-mate) | ![v1.3.0](https://img.shields.io/badge/version-1.3.0-blue) | Docker/Compose 运维：MCP 查询/编排、崩溃归因、镜像瘦身，危险操作默认确认 |
| [step-ci-fixer](./plugins/step-ci-fixer) | ![v1.3.0](https://img.shields.io/badge/version-1.3.0-blue) | CI 失败修复：/ci-fix 闭环、挂机监控、PR 评论交互、多平台日志适配 |
| [step-fe-kit](./plugins/step-fe-kit) | ![v1.0.0](https://img.shields.io/badge/version-1.0.0-blue) | 前端套件：/dev dev server 管理、视觉验证、/publish 一键发布 |
| 其余插件 | — | 开发中，见 [roadmap.json](./roadmap.json) |

## 安装

```bash
# 在 Step Code 会话中，把本仓库添加为插件市场源
/plugin marketplace add Neriah-Ado/stepcode-plugins

# 安装具体插件
/plugin install step-commit
```

也可以直接克隆本仓库后用本地路径安装：`/plugin marketplace add <本地路径>`。

## 验证

每个插件的可脚本化门禁检查集中在 `tests/validate.mjs`（清单规范、Conventional Commits 校验、安全规则存在性等），零依赖：

```bash
node tests/validate.mjs
```

## License

[MIT](./LICENSE)
