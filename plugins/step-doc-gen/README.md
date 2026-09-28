# step-doc-gen

文档生成套件（纯声明式）。生成诚实（缺失信息标 TODO 绝不编造）、中文排版规范内置。

## 命令

| 命令 | 说明 |
| --- | --- |
| `/readme` | 从 package.json/目录结构生成 README 骨架，TODO 占位不编造 |
| `/api-docs` | 从 JSDoc/类型导出生成 API 参考 |
| `/i18n-docs` | README 多语言（结构同步检查 + 术语表），仅生成 README.xx.md |
| `/site-scaffold` | mkdocs/astro 站点骨架 + 侧边栏自动组织 |
| `/doc-guard` | 文档-代码一致性周检（/cron 可接入，报告落盘） |

## 安装与验证

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-doc-gen
node tests/validate.mjs
```

## License

[AGPL-3.0-only](../../LICENSE)
