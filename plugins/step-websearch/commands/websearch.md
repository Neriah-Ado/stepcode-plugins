---
description: "多引擎并发聚合搜索：零 key 引擎开箱即用，key 后端环境变量激活，URL 去重，失败显式标注"
argument-hint: <query> [--engines ddg,searxng,…] [--n 10]
---

# /websearch — 多引擎聚合搜索

**凭据红线（C4）**：key 后端凭据只来自环境变量，代码与输出零硬编码；未配置时该后端跳过并提示 export 引导（G4）。零 key 引擎（DuckDuckGo）预期开箱即用。

<!-- WEBSEARCH-RULES-START -->
```json
{
  "engines": {
    "zero_key": "duckduckgo（html 端点）——唯一零配置引擎，预期开箱即用（引擎反爬策略变化时显式标注失效并降级到可用引擎）；searxng 需经 SEARXNG_BASE_URL 指定自建或明确选择的实例后启用",
    "key_backends": "brave（BRAVE_API_KEY）、serper（SERPER_API_KEY）、exa（EXA_API_KEY）——环境变量存在才激活，缺失时跳过并提示",
    "custom": "自建 SearXNG 经环境变量 SEARXNG_BASE_URL 接入（仅接受 http/https，非法 scheme 拒绝）"
  },
  "fan_out": "多引擎并发请求（每引擎超时 10s，整体超时预算 30s），失败显式标注「引擎 X 失败」不静默、不阻塞其他引擎；全部引擎失效时判「检索不可用」并归因声明，不静默出空结果；query 长度上限 500 字符",
  "telemetry": "输出引擎健康遥测行：每引擎 成功/失败/结果条数",
  "dedupe": "按 URL 规范化去重；输出条目：标题 + 摘要（≤2 句）+ 来源链接 + 命中引擎",
  "token_economy": "只取结果页摘要不抓整页；--n 默认 10 上限 30，超出截断（C5）；仅用户主动发起，无后台轮询",
  "privacy": "检索词隐私：向引擎外发的 query 只能是提炼后的检索词——把用户文档内容拼接进查询前必须先征得用户确认（如「把这段文档上网查证」类请求，先展示将外发的 query 原文）",
  "cron": "接入 /cron 周期简报：退出码 0=有结果、1=部分引擎失效、2=检索不可用；无头模式零写配置"
}
```
<!-- WEBSEARCH-RULES-END -->

## 流程

1. 按参数选定引擎：零 key 默认启用，key 后端查环境变量决定激活。
2. 并发请求（10s 超时），收集与去重结果。
3. 输出去重条目与引擎失败清单。
4. 结果过多时截断并说明。

## 输出格式

结果清单（标题/摘要/链接/引擎）→ 引擎失败标注 → 截断说明。
