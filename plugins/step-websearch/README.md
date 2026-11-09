# step-websearch — 多引擎聚合搜索

纯声明式插件：零 key 引擎开箱即用的多引擎搜索，key 后端经环境变量自动激活。移植自 dsh 生态 [dsh-websearch](https://github.com/240xu/dsh-websearch)（★9）。

## 它解决什么

单引擎搜索结果偏窄且易被反爬掐断。聚合 fan-out + 去重让「部分引擎宕机仍可用」，key 后端按需激活、零 key 兜底。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/websearch <query> [--engines ddg,searxng,…] [--n 10]` | 多引擎并发搜索：URL 去重、逐条来源、失败显式标注；结果截断（C5） |
| `/search-brief <query>` | 搜索 + 归纳为带来源简报：结论先行、矛盾标注、逐句可溯源 |

### 引擎与凭据

- **零 key 开箱**：DuckDuckGo（html）、SearXNG（公共实例）。
- **key 后端**（配置对应环境变量后自动激活）：如 `BRAVE_API_KEY`、`SERPAPI_KEY`、`EXA_API_KEY` 等；凭据只走环境变量（C4），未配置时输出 export 引导（G4）。
- 仅用户主动发起的查询，无后台轮询。

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-websearch
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- MCP 进程形态降级为命令内请求指引（声明式形态边界，上游为 stdio MCP）。
- 搜索引擎反爬策略变化可能导致零 key 引擎失效；失败显式标注并降级到可用引擎，不静默。
- 结果只保留标题/摘要/链接，防上下文膨胀（C5）；不抓取整页正文（需要时另发请求）。

## 许可证

[AGPL-3.0-only](../../LICENSE)
