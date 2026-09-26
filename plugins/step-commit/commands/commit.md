---
description: 分析 staged 改动并生成 Conventional Commits 规范提交（内置安全规则与 pre-commit hook 恢复流程）
argument-hint: [补充提交意图说明，可选]
---

# /commit — 规范提交

把当前 staged 改动整理为一个符合 Conventional Commits 规范的提交。参数为用户补充的提交意图说明（可空）。

## 安全红线（先读，任何一步不得绕过）

1. **先看再动**：提交前必须已运行 `git status` 与 `git diff --staged --stat`（必要时看完整 diff），确认提交范围与用户意图一致。禁止在未查看变更内容的情况下直接提交。
2. **不碰历史**：禁止对**已推送到远端**的提交执行 `git commit --amend`；本地未推送的提交仅在用户明确要求时才可 amend。
3. **不强推**：任何情况下不得执行 `git push --force` / `--force-with-lease`（本命令不负责推送，推送走 /commit-push-pr）。
4. **不跳 hook**：禁止使用 `--no-verify` 跳过 pre-commit hook，除非用户在同一条消息中明确要求；hook 失败一律走下方恢复流程。
5. **不碰机密**：staged 中出现疑似机密（.env、密钥文件、token/凭证字面量）或异常大文件时，停止提交，列出文件征求用户决定。
6. **不全量暂存**：不主动执行 `git add -A` / `git add .`；需要补充暂存时只 add 与本次意图相关的文件，并向用户确认。

## 配置读取

按顺序取**第一个存在**的配置，字段缺失时逐级回退到默认值：

1. 项目根 `.step-commit.json`（项目级覆盖，推荐提交进仓库与团队共享）
2. 插件目录 `config.json`（随插件分发，用户可直接修改）
3. 内置默认

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `message_language` | `"zh"` | subject 与正文的自然语言：`"zh"` 中文 / `"en"` 英文；type、scope、footer 关键字始终为英文 |
| `subject_max_length` | `100` | 首行最大长度；commitlint `header-max-length` 存在时以其为准 |
| `body_line_length` | `72` | 正文每行最大长度 |
| `scope_strategy` | `"auto"` | `"auto"` 自动推断 scope；`"off"` 一律省略 scope |
| `scope_map` | `{}` | 额外的路径前缀 → scope 映射，优先于内置规则，如 `{ "src/auth/": "auth" }` |

语言对 message 的影响（两种语言都必须满足 Conventional Commits 结构）：

- 中文：`feat(auth): 新增登录接口`，正文说明为什么改 + 改了什么；
- 英文：`feat(auth): add login endpoint`，subject 祈使语气小写开头，正文同中文要求；
- 用户消息与仓库历史里已有提交多数为英文时，即使配置缺失也建议切英文并在汇报中说明。

## 执行流程

### 1. 前置检查

```bash
git status
git diff --staged --stat
```

- 无 staged 文件时**停下**：汇报未暂存/未跟踪的改动，询问用户要提交哪些（可基于上下文建议文件清单，征得同意后再 add），不要自作主张全量暂存。
- staged 内容与参数描述明显不符时，先向用户确认。

### 2. 读取改动（token 经济）

- `git diff --staged` 输出超过约 400 行时改为分文件采样：每个文件最多取前 80 行，配合 `--stat` 与文件路径推断改动性质；确需细看的文件再单独取全量。

### 3. 生成 commit message

**type 映射**（按改动主导性质选一个）：

| 改动性质 | type |
| --- | --- |
| 新功能/新能力 | feat |
| 缺陷修复 | fix |
| 仅文档 | docs |
| 不影响含义的格式/空白 | style |
| 既非新增也非修复的重构 | refactor |
| 性能优化 | perf |
| 补充/修复测试 | test |
| 构建/依赖/打包 | build |
| CI 配置 | ci |
| 其他杂项 | chore |
| 回滚 | revert |

**格式规则**：

- 首行 `type(scope): subject`；scope 可省略（按下方 scope 推断规则生成）；有破坏性变更时 type 后加 `!`。
- subject：祈使语气，结尾不加句号，首行总长 ≤ `subject_max_length`（默认 100，commitlint 配置存在时以其为准），概括「做了什么」。
- 正文（默认中文）：空一行后说明**为什么改 + 改了什么**，每行 ≤ 72 字符。
- 破坏性变更：正文尾部加 `BREAKING CHANGE: <迁移说明>`。
- 修复 issue：正文尾部加 `Closes #123`。

**混合改动**：一次 staged 里含多种性质时，先建议用户拆分提交（给出拆分方案）；用户拒绝拆分则按主导类型提交，并在正文列明其余改动。

**scope 推断**（`scope_strategy: "off"` 时跳过，直接省略 scope）：

对每个 staged 文件路径按以下规则**顺序匹配，命中即止**；再把所有命中的 scope 聚合——取命中文件最多的 scope，平票或零命中走 fallback。`scope_map`（来自配置）的字面前缀映射最优先，且最长前缀优先。

<!-- SCOPE-RULES-START -->
```json
{
  "builtin_rules": [
    { "prefix": "packages/", "scope": "<第 2 段目录名>" },
    { "prefix": "apps/", "scope": "<第 2 段目录名>" },
    { "prefix": "src/", "scope": "<第 2 段目录名，仅当完整路径 ≥3 段>" },
    { "prefix": ".github/", "scope": "ci" },
    { "prefix": "docs/", "scope": "docs" },
    { "prefix": "test/", "scope": "test" },
    { "prefix": "tests/", "scope": "test" }
  ],
  "aggregate": "取命中文件最多的 scope；平票或零命中进入 fallback",
  "fallback": "全部文件同属一个非通用顶层目录时用该目录名，否则省略 scope",
  "generic_dirs": ["src", "lib", "bin", "dist", "build", "packages", "apps"],
  "notes": "scope 取自目录段，不含点；第 2 段是文件名（含扩展名）时视为未命中"
}
```
<!-- SCOPE-RULES-END -->

示例：`packages/core/src/index.ts` → `core`；`src/auth/login.ts` → `auth`；`docs/guide.md` → `docs`；根目录混合改动 → 省略 scope。

### 4. HEREDOC 提交（必须用 HEREDOC，防止引号/换行转义问题）

```bash
git commit -m "$(cat <<'EOF'
feat(auth): 新增登录接口

实现用户名密码登录，返回 JWT；失败统一走 401 分支。

Closes #42
EOF
)"
```

### 5. pre-commit hook 失败恢复

hook 失败时**绝不**加 `--no-verify` 重试，按以下顺序处理：

1. 完整读取 hook 输出并归因：
   - 格式化类（lint-staged/prettier 自动改写）→ 重新 add 受影响文件后重试；
   - lint 报错可自动修复 → 修复相关文件后重试；
   - 测试失败 → 汇报失败用例，征求用户是否继续修复；
   - 需要业务决策 → 停下汇报，等用户处理。
2. 自动修复后重试提交；连续 2 轮仍失败则停止，输出失败原因与建议，交用户处理。

### 6. 提交后确认

```bash
git status
git log -1 --stat
```

汇报提交 hash、type(scope)、涉及文件数；**不执行 push**。

## 输出格式

最后用 3-5 行汇报：提交 hash 与首行 message、文件统计、hook 是否触发及处理结果、下一步建议（如需推送与建 PR 用 /commit-push-pr）。
