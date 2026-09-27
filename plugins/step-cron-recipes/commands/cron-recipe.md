---
description: "/cron-recipe init：交互式生成定制定时模板；模板变量系统支持 {{var}} 占位"
argument-hint: [模板名或 init，可选]
---

# /cron-recipe — 模板向导与变量系统

## init 向导（三问）

<!-- WIZARD-RULES-START -->
```json
{
  "questions": [
    "1. 目标：这个定时任务要产出什么？（一句话）",
    "2. 频率：多久跑一次 / 建议 /cron 表达式？",
    "3. 输出：结果写到哪个路径？（默认 docs/cron/<模板名>.md）"
  ],
  "output": "按 recipe-format 约定生成 recipes/<id>.md，供 /cron 使用",
  "confirm": "生成后展示全文，用户确认后落盘"
}
```
<!-- WIZARD-RULES-END -->

## 变量系统

<!-- VARS-RULES-START -->
```json
{
  "syntax": "模板中的 {{var}} 占位符；/cron 调用时以 \"变量=值\" 形式注入",
  "render": "渲染规则与 tests/lib/recipes.mjs 的 renderTemplate 一致：未提供的变量保留原样并在渲染结果头部列出缺失清单",
  "builtins": "{{date}} 渲染为当天、{{range}} 默认 7d"
}
```
<!-- VARS-RULES-END -->

## 社区贡献（v1.3.0）

<!-- CONTRIBUTING-TEMPLATE-START -->
```json
{
  "path": "第三方模板放市场仓库 recipes/community/<author>/<id>.md",
  "requirements": "符合 recipe-format 约定 + 附 3 天实跑记录",
  "review": "PR 形式贡献；索引页自动收录（buildIndex）"
}
```
<!-- CONTRIBUTING-TEMPLATE-END -->

## 模板索引

`buildIndex` 扫描 recipes/ 目录生成索引页（模板 id/目标一句话/频率/输出路径），写入 docs/cron/index.md（规则见 tests/lib/recipes.mjs）。
