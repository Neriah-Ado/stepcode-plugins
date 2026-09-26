---
description: 用 git bisect 自动定位引入回归的坏提交：生成 run 脚本、解读结果，定位后转人工确认
argument-hint: [坏提交/分支 好提交，可选；如 "HEAD v1.2.0"]
---

# /bisect — 回归根因定位（git bisect 自动化包装）

对「最近还是好的、现在坏了」的回归，用 bisect 找到引入问题的首个坏提交。定位后**转人工确认**，不自动 revert。

## 安全规则

1. **工作区必须干净**：先 `git status`，有未提交改动时列出并征得用户同意后 `git stash`（bisect 结束后恢复）；未确认不得开始。
2. bisect 过程会切换历史提交：确认用户理解这一点；切换前后都显示当前 HEAD 的短 hash。
3. **结束时必须执行 `git bisect reset`**（含中途用户叫停的情况），把仓库带回原始分支。
4. token 经济（C5）：每步测试输出落盘 `docs/test-guard/bisect-last.log`，会话中只显示「步数 / 当前提交 / 好或坏 / 剩余范围」各一行。
5. 定位结果只做汇报与证据引用；**revert / 修复 / push 由用户决定**（转人工确认）。

## 1. 确定区间

- 参数：`<bad> <good>`（默认 bad=HEAD）。向用户复述：坏=当前失败发生的提交，好=最后一次确认正常的提交。
- 区间过大（> 200 提交）时告知并请用户确认。

<!-- BISECT-RULES-START -->
```json
{
  "prereq": "git status 干净（或用户确认 stash）",
  "run_wrapper": "git bisect run sh <脚本>",
  "script": [
    "#!/bin/sh",
    "# 对目标失败用例执行最小范围测试：好=exit 0，坏=exit 1，跳过=exit 125",
    "<测试命令> > docs/test-guard/bisect-last.log 2>&1",
    "exit $?"
  ],
  "skip_code": "125（依赖未就绪等不可判定提交）",
  "finish": "定位首个坏提交 → git bisect reset → 输出报告转人工"
}
```
<!-- BISECT-RULES-END -->

## 2. 生成 run 脚本并执行

1. 按上表生成脚本：测试命令优先用**只覆盖目标失败用例**的最小范围（如 `npx vitest run src/a.test.ts` / `python -m pytest tests/x.py::test_y`）；无法最小化时用全量命令并在报告注明成本。
2. `git bisect start` → `git bisect bad <bad>` → `git bisect good <good>` → `git bisect run sh <脚本>`。
3. 每步汇报一行结论；run 结束后 git 会打印首个坏提交。

## 3. 结果解读与转人工

报告内容：

- 首个坏提交：hash、作者、日期、提交标题；
- 该提交的改动文件清单（`git show --stat`）与当前失败用例的关联分析（哪个文件最可能引入）；
- bisect 步数与总耗时、脚本日志路径（`docs/test-guard/bisect-last.log`）。

然后：`git bisect reset` → 向用户给出三个选项：自动生成 revert 提交（走 /commit 规范）/ 直接定点修复（走 test-fix-loop skill）/ 仅记录不动。等用户选择，不自行行动。
