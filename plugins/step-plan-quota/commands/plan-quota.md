---
description: "查询 Coding Plan 订阅额度（env 配置端点，只读 GET），输出用量进度与触顶预估"
argument-hint: [--provider 名称]
---

# /plan-quota — 订阅额度查询

**凭据红线（C4）**：端点与令牌只来自环境变量 `PLAN_QUOTA_URL` / `PLAN_QUOTA_TOKEN`，代码与输出零硬编码；未配置时输出 export 引导并终止（G4）。本命令只读查询，不做任何写请求。

<!-- PLAN-QUOTA-RULES-START -->
```json
{
  "config": "PLAN_QUOTA_URL（额度端点）+ PLAN_QUOTA_TOKEN（Bearer）；可选 PLAN_QUOTA_HEADERS 附加头（JSON）",
  "request": "用户主动发起的只读 GET，超时 10s，无后台轮询；网络失败给出排查建议（代理/端点可达性）而非裸报错",
  "parse": "响应字段名不统一 → 按 used/limit/total/remaining 等常见键模糊匹配；匹配不到时原样摘录响应片段并声明无法解析（不猜）",
  "estimate": "输出已用/总额度进度条 + 触顶预估（近 7 日日均消耗 → 预计 X 天后触顶，按 1% 粒度展示窗口）",
  "no_store": "令牌与原始响应不写入任何文件（C4/C5），输出只给解析后数字与字段口径说明"
}
```
<!-- PLAN-QUOTA-RULES-END -->

## 流程

1. 检查环境变量；缺失 → 输出 `export PLAN_QUOTA_URL=...` / `export PLAN_QUOTA_TOKEN=...` 示例与配置说明后终止。
2. 发起只读 GET（10s 超时）；失败给排查建议（代理、端点可达性、令牌有效性）。
3. 按常见键模糊匹配额度字段，计算进度与触顶预估；无法识别时摘录响应并声明。
4. 输出额度报告；凭据与原始响应不写入任何文件。

## 输出格式

进度条（已用/总）→ 触顶预估 → 字段口径说明 → 失败时的排查指引。
