# step-notify — 多渠道消息推送

纯声明式插件：把通知推到常用 IM/手机渠道。移植自 dsh 生态 [chicheng-push](https://github.com/534119219/chicheng-push)（★7）。

## 它解决什么

长任务跑完想收到手机通知、或者把摘要推给团队群，每个渠道 API 各不相同。本插件内置渠道模板，密钥走环境变量，默认 dry-run、真实发送先确认。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/notify <文本> [--channel bark\|serverchan\|wecom\|dingtalk\|telegram\|feishu\|ntfy\|webhook] [--dry-run]` | 组装渠道负载 → 展示脱敏 payload → 确认后发送；默认 dry-run |
| `/notify-channels` | 校验已配置渠道（环境变量齐套性 + 可选连通性探测，探测也需确认） |

### 渠道环境变量（C4，未配置输出 export 引导）

| 渠道 | 变量 |
| --- | --- |
| Bark | `NOTIFY_BARK_URL`（含 key 的完整端点） |
| Server酱 | `SERVERCHAN_KEY` |
| 企业微信 | `WECOM_WEBHOOK_URL` |
| 钉钉 | `DINGTALK_WEBHOOK_URL`（+ 可选 `DINGTALK_SECRET` 加签） |
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` |
| 飞书 | `FEISHU_WEBHOOK_URL`（+ 可选 `FEISHU_SECRET`） |
| ntfy | `NTFY_URL`（+ 可选 `NTFY_TOKEN`） |
| webhook | `NOTIFY_WEBHOOK_URL`（+ 可选 `NOTIFY_WEBHOOK_HEADERS` JSON） |

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-notify
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- 宿主 hooks 通知器形态降级为命令式外发（声明式形态边界）：被动事件通知可配 /cron 定时调用。
- **G3 附加红线**：一切外发必须先展示脱敏 payload 并获用户确认；`--dry-run` 零请求。
- 密钥与完整端点在输出中脱敏（只显示尾 4 位）。
- 渠道 API 变动可能导致负载格式失效，失效时提示核对官方文档。

## 许可证

[AGPL-3.0-only](../../LICENSE)
