---
description: 按 release-please 风格生成含 CHANGELOG 与版本号变更的 release PR（GitHub 用 gh，GitLab 用 glab）
argument-hint: [目标 package 或版本号，可选；monorepo 中可指定单个 package]
---

# /release-pr — 发布 PR（release-please 风格）

把「版本号变更 + CHANGELOG 更新」整理为一个 release PR，合并后即可打 tag 发布。

## 安全规则（G3）

- 建分支、push、创建 PR/MR 都是外向动作：**每步先向用户确认**再执行。
- 禁止 force push；release 分支已存在（远端或本地）时停止并汇报，不覆盖。
- 不在本命令里打 tag（合并由用户完成；合并后可转用 /changelog 的确认打 tag 流程）。
- 版本号文件（package.json 等）修改前展示 diff 预览。

## 1. 计算发布内容

按 commands/changelog.md 的完整流程计算（分类 → semver 建议 → CHANGELOG 节）：

- 单仓库：一个建议版本。
- monorepo：按 package 独立建议（无提交的 package 跳过）；参数指定单 package 时只处理它。

## 2. 创建 release 分支并提交变更

1. `git switch -c chore/release-vX.Y.Z`（monorepo：`chore/release-<pkg短名>-vX.Y.Z`；从最新 tag 所在提交或当前 HEAD 起切，向用户说明选择）。
2. 更新版本号：根/对应 package 的 `package.json` `version` 字段（只有 json 时直接改；lockfile 存在时提示用户运行包管理器 install 命令同步，不代跑）。
3. 写入 CHANGELOG（单仓库根文件；monorepo 每 package 一份 + 根总览）。
4. 提交：`chore(release): prepare vX.Y.Z`（monorepo：`chore(release): prepare <pkg>@X.Y.Z`）。

<!-- RELEASE-PR-RULES-START -->
```json
{
  "branch": "chore/release-v<semver> | chore/release-<pkg>-v<semver>",
  "commit": "chore(release): prepare v<semver> | chore(release): prepare <pkg>@<semver>",
  "pr_title": "chore(release): v<semver>",
  "remote": {
    "github": { "tool": "gh", "create": "gh pr create", "check": "gh --version" },
    "gitlab": { "tool": "glab", "create": "glab mr create", "check": "glab --version" }
  }
}
```
<!-- RELEASE-PR-RULES-END -->

## 3. 推送并创建 PR / MR

1. 确认后 `git push -u origin <branch>`。
2. **远端类型检测**（与 /commit-push-pr 相同）：`git remote get-url origin` 中主机含 `gitlab`（gitlab.com 或自建 `gitlab.*`）→ GitLab；`github.com` → GitHub。
3. GitHub：`gh pr create --title "chore(release): vX.Y.Z" --body "$(cat <<'EOF' … EOF)"`，正文 = 摘要 + 变更节 + 合并后操作说明（打 tag 步骤）。
4. GitLab：`glab mr create --title "chore(release): vX.Y.Z" --description "$(cat <<'EOF' … EOF)" --target-branch <默认分支>`。
5. 工具缺失时输出安装指引并停止（不裸报错）：
   - gh：`winget install GitHub.cli` / `scoop install gh` / `brew install gh`，然后 `gh auth login`；
   - glab：`winget install GLab.GLab` / `scoop install glab` / `brew install glab`，然后 `glab auth login`。

## 4. 汇报

分支名、PR/MR 链接、建议版本与变更统计、合并后的打 tag 提醒（`git tag vX.Y.Z && git push --follow-tags`，monorepo 用 `<pkg>-vX.Y.Z`）。
