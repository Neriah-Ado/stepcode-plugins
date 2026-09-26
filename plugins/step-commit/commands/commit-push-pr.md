---
description: 完成规范提交并推送远端，用 gh 创建 PR（gh 缺失时输出安装指引而非报错）
argument-hint: [PR 补充说明或目标 base 分支，可选]
---

# /commit-push-pr — 提交并创建 PR

本命令 = /commit 的全部流程 + 推送远端 + 创建 Pull Request。

## 前置：提交

先完整执行 commands/commit.md 的流程，其全部安全红线同样适用（不 amend 已推送提交、不 force push、不 `--no-verify`、先 status/diff 再动作）。若工作区干净且已是要发布的提交，跳过提交步骤。

## 1. 推送（外向动作，先确认）

1. `git status` 确认无未提交改动；用 `git log @{u}..HEAD --oneline`（无 upstream 时 `git log -5 --oneline`）列出将要推送的提交。
2. 向用户确认分支名与提交列表后再推送；**禁止 force push**。
3. 首次推送当前分支用 `git push -u origin <branch>`，其后 `git push`。

## 2. 远端类型检测与工具检查（降级路径）

```bash
git remote get-url origin
```

按远端主机分流；主机无法识别为 GitHub/GitLab 时，说明情况并询问用户，不强行创建。

**GitHub（github.com）**：

```bash
gh --version
```

失败时**不裸报错**，输出以下指引并停止：

> 未检测到 GitHub CLI。请安装后重试：
> - Windows：`winget install GitHub.cli`，或 `scoop install gh`，或 `choco install gh`
> - macOS：`brew install gh`；Linux：参考 https://github.com/cli/cli#installation
> 安装后执行 `gh auth login` 完成登录，再重跑本命令。

**GitLab（gitlab.com 或自建 `gitlab.*` 主机）**：

```bash
glab --version
```

失败时输出以下指引并停止：

> 未检测到 GitLab CLI（glab）。请安装后重试：
> - Windows：`winget install GLab.GLab`，或 `scoop install glab`
> - macOS：`brew install glab`；Linux：参考 https://gitlab.com/gitlab-org/cli#installation
> 安装后执行 `glab auth login` 完成登录，再重跑本命令。

## 3. 生成并创建 PR / MR

GitLab 远端时本节等价替换：标题/正文规则相同，`gh pr create` → `glab mr create`，`--body` → `--description`，`--base` → `--target-branch`，base 默认取 `glab repo view -F .default_branch`（取不到时问用户）。

- **标题**：复用提交规范首行 `type(scope): subject`；多个提交时按主导类型概括。
- **正文**（HEREDOC 传递，防转义）：`## 摘要` 一段话 + `## 变更点` 列表 + `## 测试` 说明如何验证（没跑测试就写「未验证，建议补充」）+ 提交 footer 中的 issue 引用（`Closes #N`）。
- **base**：默认取远端默认分支（`gh repo view --json defaultBranchRef -q .defaultBranchRef`）；用户指定目标分支时用 `--base`。
- 创建：

```bash
gh pr create --title "<标题>" --base <默认分支> --body "$(cat <<'EOF'
## 摘要
...
## 变更点
- ...
## 测试
- ...
EOF
)"
```

- 同分支已有 PR（创建报错或 `gh pr view --json url` 成功）时**不重复创建**：汇报已有 PR 链接，询问是否补充评论。

## 4. 汇报

输出 PR 链接、标题、base←head 分支；提醒关注 CI 运行结果。
