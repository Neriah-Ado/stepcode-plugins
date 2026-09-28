# step-db-insight

数据库只读助手。MCP server（零依赖 Node）：**双重只读防线**（语句白名单解析 + 建议只读账号）+ psql CLI 执行层（测试缝可换）。

## MCP 工具

| 工具 | 说明 |
| --- | --- |
| `list_tables` / `describe_table` / `sample_rows` | schema 浏览（只读） |
| `read_query` / `explain_query` | 白名单守卫的只读查询与计划解读 |
| `migration_scaffold` | 迁移 SQL 草稿（up/down，人工审查，不自动执行） |
| `write_confirm` | 受控 INSERT/UPDATE（逐条确认；DELETE/DDL 永久拒绝） |
| `schema_timeline` | 迁移目录 → mermaid 演进时间线（v1.3.0） |

## 凭据（C4）

`requiresEnv: DATABASE_URL`——未配置时输出 export 示例与安全提示；连接串禁止落盘/打印/提交。

## 安装与验证

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-db-insight
node tests/validate.mjs   # 含 9 条对抗样本的只读守卫测试
```

## License

[AGPL-3.0-only](../../LICENSE)
