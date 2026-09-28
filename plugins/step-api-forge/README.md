# step-api-forge

OpenAPI 全链路。混合形态：MCP server（零依赖 Node）内置 3.0/3.1 结构校验与代码生成，产物全部可落盘。

## MCP 工具

| 工具 | 说明 |
| --- | --- |
| `validate_spec` | OpenAPI 3.0/3.1 结构校验（operations/responses 全覆盖） |
| `generate_ts_client` | TypeScript fetch 客户端（路径参数插值、summary 注释） |
| `generate_mock` / `generate_docs` | express/MSW mock 与 API 参考文档页（v1.1.0） |
| `diff_spec` | 两版 spec 对比，breaking changes 100% 检出样本（v1.2.0） |
| `generate_python_sdk` | Python requests SDK（v1.3.0）；反向生成走提示词辅助模式 |

## 安装与验证

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-api-forge
node tests/validate.mjs   # petstore 样例端到端（含 MCP 冒烟）
```

## License

[AGPL-3.0-only](../../LICENSE)
