---
description: "校验推送渠道配置：环境变量齐套性检查（只读）与可选连通性探测（需确认）"
argument-hint: [--probe 渠道名]
---

# /notify-channels — 渠道配置校验

**只读默认**：默认只检查环境变量齐套性，零网络请求；`--probe` 连通性探测会向渠道发测试请求，需用户确认后才执行。

<!-- NOTIFY-CHANNELS-RULES-START -->
```json
{
  "check": "逐渠道核对环境变量齐套性（见 /notify 渠道表）：齐套/缺失/格式可疑（如 webhook 非合法 URL）三态；零网络，密钥不回显（只报变量名与状态）",
  "probe": "--probe <渠道>：确认后发最小测试请求（如 ping 文本），10s 超时，报告可达性与结果码；失败给排查建议（网络/代理/令牌）",
  "sample": "输出缺失渠道的 export 引导样例（值用占位符，不含真实凭据）",
  "no_store": "校验结果可落盘 docs/notify/channels-<日期>.md（脱敏后），需确认（G3）"
}
```
<!-- NOTIFY-CHANNELS-RULES-END -->

## 流程

1. 逐渠道核对环境变量，输出三态清单（不回显密钥值）。
2. `--probe`：确认后发最小测试请求并报告结果。
3. 给缺失渠道的 export 样例。

## 输出格式

渠道配置矩阵（渠道/状态/缺失变量）→ 探测结果（可选）→ export 样例。
