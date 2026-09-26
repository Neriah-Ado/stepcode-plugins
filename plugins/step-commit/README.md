# step-commit

Git 提交工作流套件。纯声明式插件（commands + Markdown 提示词，零外部依赖），把 Step Code 变成守规范的提交助手。

## 命令

| 命令 | 说明 |
| --- | --- |
| `/commit` | 分析 staged 改动 → 生成 Conventional Commits 规范 message → HEREDOC 格式化提交 |
| `/commit-push-pr` | 在 `/commit` 基础上推送远端并用 `gh` 创建 PR（标题 + 摘要/变更点/测试说明正文） |

## 内置安全规则

- 提交前必须先 `git status` / `git diff --staged` 确认范围；
- 不 amend 已推送提交、不 force push；
- pre-commit hook 失败走「归因 → 修复 → 重试」流程，绝不 `--no-verify`（除非用户明确要求）；
- staged 中疑似机密/大文件时停止并征求用户决定。

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-commit
```

## 验证

仓库根目录运行（清单规范 + Conventional Commits 校验 + 安全规则存在性）：

```bash
node tests/validate.mjs
```

## License

MIT
