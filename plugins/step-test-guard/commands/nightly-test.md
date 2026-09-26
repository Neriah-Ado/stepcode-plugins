---
description: 把全量测试封装为可被 /cron 调度的无头夜间任务：只跑测与报告，不改代码（step -p 可执行）
argument-hint: [频率提示，可选；默认建议每日 03:00]
---

# /nightly-test — 夜间全量测试守护（/cron 接入）

本命令设计为**无人值守**运行：不修改任何代码、不发起任何外向动作，只跑测试并产出报告。

## 1. 无头模式（step -p 形式）

<!-- NIGHTLY-RULES-START -->
```json
{
  "headless_command": "step -p \"按 plugins/step-test-guard/commands/nightly-test.md 的流程执行夜间全量测试\"",
  "cadence": "建议 /cron 每日 03:00；创建定时任务前必须向用户确认频率与范围",
  "report_path": "docs/test-report.md",
  "log_path": "docs/test-guard/last-run.log",
  "exit_semantics": { "green": "0", "has_failures": "1", "run_error": "2" },
  "no_network_actions": "无头模式下禁止 git push / PR / 评论等一切外向动作"
}
```
<!-- NIGHTLY-RULES-END -->

- 用户确认后用 /cron 创建定时任务；频率以用户意见为准（默认建议 03:00）。
- 无头会话没有交互：所有「询问用户」的分支一律改为**记录到报告的「待人工确认」节**。

## 2. 与 AGENTS.md 约定协作

- 运行前读取仓库根 `AGENTS.md`（若存在）：其中声明的测试/检查约定（如「改动后运行 npm run check」）**优先于框架自动检测**，作为夜间全量命令；报告中注明约定来源。
- 无 AGENTS.md 或无相关约定时，按 /test 的 TEST-DETECT 流程检测。

## 3. 执行

1. 全量跑测试（命令见约定或检测），输出照常落盘 `docs/test-guard/last-run.log`。
2. 解析失败清单（复用 /test 的 TEST-PATTERNS 与结构化格式）。
3. 生成测试报告（TG-120-2，见下方「报告生成」）。
4. 退出码：全绿 0 / 有失败 1 / 运行错误 2，供 /cron 与 CI 判断。

## 4. 报告生成

<!-- REPORT-RULES-START -->
```json
{
  "path": "docs/test-report.md",
  "sections": ["摘要", "失败明细", "与上轮对比"],
  "compare": "与上一份报告的失败集对比，逐条标注：新增 / 已解决 / 仍在",
  "c5": "会话输出只给报告路径与一句话摘要，全文落盘不内联"
}
```
<!-- REPORT-RULES-END -->

报告为 Markdown；「摘要」含日期、框架、通过/失败/跳过计数与退出码；「失败明细」复用 /test 的结构化条目格式；「与上轮对比」三分类逐条列出。报告写入前保留上一份内容做对比，写入后旧报告轮转（`docs/test-report.md` 只保留最新，上一轮失败集从报告解析）。
