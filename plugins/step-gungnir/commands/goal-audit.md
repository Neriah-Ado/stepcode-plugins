---
description: "审计目标证据链：逐条判据核对证据，缺证据判未完成，防虚假完成上报"
argument-hint: [判据文件 .stepcode/gungnir/goal.json]
---

# /goal-audit — 证据链审计

**审计纪律**：只认证据——每条判据必须给出满足记录（命令输出摘要/产物路径+抽查结果）；给不出证据一律判 unmet，不允许「应该可以了」。

<!-- GOAL-AUDIT-RULES-START -->
```json
{
  "read": "读 goal.json（不存在则提示先 /ultragoal 锁定），逐条核对状态与证据；证据记录格式：判据对象含 evidence[]: [{ts, kind(command/artifact/test), ref(命令或路径), digest(输出摘要 ≤2 句)}]，审计只认该数组内的记录",
  "verdicts": "satisfied（有证据）/ unmet（无证据或证据矛盾）/ unverifiable（判据本身不可判定，标注 human-judged）",
  "recheck": "对证据可复核的判据现场重跑验证命令——不确定是否有副作用时一律按「有副作用」处理（先确认再跑，default-deny，G3）；拒绝照抄历史结论",
  "report": "输出三态清单 + 未满足项的最短补证路径（跑什么命令/造什么产物）；全绿才输出「目标完成」结论，否则只报进度",
  "honesty": "禁止把 human-judged 或 unmet 计入完成；完成结论必须附逐条证据摘引"
}
```
<!-- GOAL-AUDIT-RULES-END -->

## 流程

1. 读 goal.json，逐条核对证据记录。
2. 可复核项现场重跑（副作用判据先确认）。
3. 输出三态清单与补证路径；全绿才给完成结论。

## 输出格式

三态清单（判据/证据/结论）→ 进度 → 补证路径（未满足时）→ 完成结论（仅全绿）。
