---
description: "向配置渠道推送消息：默认 dry-run，真实发送先展示脱敏 payload 并确认"
argument-hint: <文本> [--channel bark|serverchan|wecom|dingtalk|telegram|feishu|ntfy|webhook] [--dry-run]
---

# /notify — 多渠道推送

**外发红线（G3）**：真实发送前必须展示目标渠道与脱敏 payload，获用户确认；`--dry-run`（默认）零请求。端点与密钥只来自环境变量（C4），输出脱敏。

<!-- NOTIFY-RULES-START -->
```json
{
  "channels": {
    "bark": "NOTIFY_BARK_URL（GET/POST）；serverchan: SERVERCHAN_KEY；wecom: WECOM_WEBHOOK_URL；dingtalk: DINGTALK_WEBHOOK_URL(+DINGTALK_SECRET 加签)；telegram: TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID；feishu: FEISHU_WEBHOOK_URL(+FEISHU_SECRET)；ntfy: NTFY_URL(+NTFY_TOKEN)；webhook: NOTIFY_WEBHOOK_URL(+NOTIFY_WEBHOOK_HEADERS)"
  },
  "payload": "按渠道官方字段组装（title/text/markdown 视渠道支持）；密钥与完整端点在展示与输出中脱敏（只显示尾 4 位）",
  "confirm": "流程 = 组装 → 展示脱敏 payload → 用户确认 → 发送（超时 10s）→ 报告结果码；拒绝则不发送",
  "dry_run": "默认 --dry-run：只组装与展示，零网络请求",
  "limits": "payload 上限 4KB（超出截断并提醒）；webhook/ntfy URL 解析后 scheme（大小写不敏感、去首尾空白）必须为 http/https，非法拒绝；NOTIFY_WEBHOOK_HEADERS 上限 2KB，头名按大小写不敏感匹配黑名单（Host/Content-Length/Authorization 等），头名与值均禁 CRLF，同名头重复出现即拒绝（防请求注入）",
  "audit": "真实发送成功后，经用户同意可将审计记录（时间/渠道/结果码/负载摘要，脱敏）追加到 docs/notify/audit-<日期>.jsonl（落盘前确认，G3）；单文件超过 1000 条时滚动到 audit-<日期>-<序号>.jsonl 并提示归档，避免无界增长",
  "on_error": "渠道未配置 → 输出该渠道 export 引导后终止（G4）；请求失败细分归因：401→令牌、403→权限、429→限流（冷却后手动重试）、超时→可达性，不自动重试轰炸",
  "gungnir_link": "step-gungnir 目标全绿后可经用户确认调用本命令推送完成报告（通知内容为判据摘要，走本命令既有确认链）"
}
```
<!-- NOTIFY-RULES-END -->

## 流程

1. 选渠道（--channel 或按已配置渠道询问），从环境变量读端点与密钥。
2. 组装渠道负载，脱敏展示；默认 dry-run 结束。
3. 用户确认后发送（10s 超时），报告结果；失败给排查建议，不自动重试。
4. 凭据与完整端点不写入任何文件。

## 输出格式

脱敏 payload 预览 → 确认提示 → 发送结果（状态码）/ export 引导。
