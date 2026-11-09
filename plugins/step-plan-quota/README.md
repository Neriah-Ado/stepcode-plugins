# step-plan-quota — 订阅额度与峰谷计价

纯声明式插件：移植 dsh 生态 [dsh-cost-meter](https://github.com/Han-1413141/dsh-cost-meter) 的差异化能力——Coding Plan 订阅额度只读查询与峰谷计价窗口提醒；用量统计本身已由 step-token-meter 覆盖，不重复建设。

## 它解决什么

订阅制用户的「还剩多少额度、什么时候该切峰价」没有本地答案。本插件按环境变量配置的端点只读查额度并估触顶时间；峰谷窗口表本地维护，切换前给提醒规则。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/plan-quota [--provider 名称]` | 只读查询订阅额度：进度条 + 按近 7 日日均消耗估触顶天数；凭据走环境变量 |
| `/price-peak --now\|--config` | 当前时段判定与剩余分钟、窗口表校验、切换前提醒规则与 /cron 片段 |

### 配置

- `PLAN_QUOTA_URL` / `PLAN_QUOTA_TOKEN`（Bearer）：额度端点与令牌；未配置输出 export 引导（G4），可选 `PLAN_QUOTA_HEADERS` 附加头（JSON）。
- `config/price-windows.json`：峰谷窗口表（多时区）；插件不内置厂商真实时段，按账单页自行维护。

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-plan-quota
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- 只读 GET，10s 超时，无后台轮询；令牌与原始响应不落盘。
- 额度响应字段名不统一：按 used/limit/remaining 等常见键模糊匹配，匹配不到原样摘录并声明无法解析，不猜。
- 输出单价与成本均为粗估口径，不作为计费依据。
- 13 家厂商的额度 API 不内置（时效性与凭据形态各异），以通用端点约定覆盖。

## 许可证

[AGPL-3.0-only](../../LICENSE)
