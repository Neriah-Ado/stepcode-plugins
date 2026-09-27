# step-marketplace-cc

Claude Code 插件市场桥（元项目）。把高星 CC 插件经规则级兼容检查/修补后收录进本仓库市场源，`/plugin marketplace add Neriah-Ado/stepcode-plugins` 一键可用。

## 兼容性规则（源自 Step Code 加载器源码结论）

- `.claude-plugin/plugin.json` 自动回退读取；name→id 归一化；skills/commands/agents/.mcp.json 目录自动发现；
- 已知不兼容点：lspServers（不承载）、entry（只记录不加载）→ 自动剔除并标注 `patched`；
- 检查器实现：`tests/lib/cc-compat.mjs`（`analyzeCcPlugin`：native / patched / incompatible 三态 + 修补后清单）。

## 收录目录

见 [catalog.json](./catalog.json)：10 个条目，逐条含上游、锁定版本、分类、兼容状态、实测表现。
**诚实声明**：断网开发环境下上游地址以占位符记录、实测表现统一标注「待实测」；接入网络后按「clone → checker → 锁定版本 → 实机安装验证」流程逐条回填。

## 徽章与索引（v1.3.0）

`buildCcIndex` 生成兼容性标注表，原生 Step 插件与本仓库 11 个自研插件共存索引，星级/实测徽章字段可开关。

## License

MIT
