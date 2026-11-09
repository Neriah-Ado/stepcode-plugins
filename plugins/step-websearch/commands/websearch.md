---
description: "多引擎并发聚合搜索：零 key 引擎开箱即用，key 后端环境变量激活，URL 去重，失败显式标注"
argument-hint: <query> [--engines ddg,searxng,…] [--n 10]
---

# /websearch — 多引擎聚合搜索

**凭据红线（C4）**：key 后端凭据只来自环境变量，代码与输出零硬编码；未配置时该后端跳过并提示 export 引导（G4）。零 key 引擎保证零配置可用。

<!-- WEBSEARCH-RULES-START -->
```json
{
  "engines": {
    "zero_key": "duckduckgo（html 端点）、searxng（公共实例）——默认启用",
    "key_backends": "brave（BRAVE_API_KEY）、serpapi（SERPAPI_KEY）、exa（EXA_API_KEY）等——环境变量存在才激活，缺失时跳过并提示",
    "custom": "自建 SearXNG 经环境变量 SEARXNG_BASE_URL 接入"
  },
  "fan_out": "多引擎并发请求（每引擎超时 10s），失败显式标注「引擎 X 失败」不静默、不阻塞其他引擎",
  "dedupe": "按 URL 规范化去重；输出条目：标题 + 摘要（≤2 句）+ 来源链接 + 命中引擎",
  "token_economy": "只取结果页摘要不抓整页；--n 默认 10 上限 30，超出截断（C5）；仅用户主动发起，无后台轮询"
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
