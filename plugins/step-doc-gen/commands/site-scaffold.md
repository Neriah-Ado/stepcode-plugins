---
description: 生成 docs 站点骨架（mkdocs 或 astro 二选一）并按目录自动组织侧边栏
argument-hint: [引擎，可选；默认 mkdocs]
---

# /site-scaffold — docs 站点骨架

<!-- SITE-RULES-START -->
```json
{
  "engines": ["mkdocs（默认，Python 生态最轻）", "astro（前端项目可选 starlight）"],
  "scaffold": "mkdocs.yml（site_name/nav/theme material）+ docs/index.md；不装依赖不构建（构建由用户执行并给命令）",
  "nav": "侧边栏按 docs/ 目录树自动组织（目录为节，index 优先），由 tests/lib/site.mjs 的 buildMkdocsNav 校验",
  "c5": "生成文件清单给路径，不内联全文"
}
```
<!-- SITE-RULES-END -->

## 流程

1. 引擎选择（参数 > 用户确认）；2. 生成骨架文件（已存在的 mkdocs.yml 不覆盖，输出 diff 建议）；3. 汇报：文件清单 + 本地构建命令（`mkdocs serve` / `npm run dev`）。
