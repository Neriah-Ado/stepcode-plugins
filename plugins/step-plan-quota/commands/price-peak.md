---
description: "峰谷计价时段管理：维护价格窗口表、判断当前时段、给切换前提醒规则（本地配置零网络）"
argument-hint: [--config 窗口表 | --now]
---

# /price-peak — 峰谷计价窗口

**数据边界**：窗口表来自本地 `config/price-windows.json`（用户可编辑）或 --config 参数；插件不内置任何厂商的真实峰谷时段（时效性强，易过误导），只提供格式与计算。

<!-- PRICE-PEAK-RULES-START -->
```json
{
  "schema": "config/price-windows.json：[{name, tz, windows: [{peak: \"09:00-21:00\", priceIn, priceOut}]}]，支持多时区",
  "now": "--now 输出当前时段（peak/off-peak）、两档单价与距下次切换的剩余分钟数",
  "alert": "切换前提醒规则：默认提前 10 分钟，可选弹窗/通知/会话内提示三型（对齐 dsh-cost-meter 提醒语义的声明式映射）；接入 /cron 时按窗口生成每日提醒计划",
  "honesty": "厂商真实时段由用户按账单页自行维护；输出单价仅用于成本粗估，不作为计费依据"
}
```
<!-- PRICE-PEAK-RULES-END -->

## 流程

1. `--now`：读窗口表 → 判定当前时段与剩余时间 → 输出两档单价。
2. `--config`：展示/校验窗口表格式，检查时区合法性与区间重叠。
3. 需要提醒时给出 /cron 配置片段（每日生成提醒计划）。
4. 输出注明「粗估口径」与窗口表最后更新时间。

## 输出格式

时段判定/校验结果 → 单价与剩余时间 → 提醒计划片段（可选）→ 粗估声明。
