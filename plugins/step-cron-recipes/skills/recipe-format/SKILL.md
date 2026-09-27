---
name: recipe-format
description: cron 模板通用结构约定：撰写新模板或审查模板时使用。
---

# recipe-format — 模板通用结构

<!-- RECIPE-FORMAT-START -->
```json
{
  "frontmatter": "description 必须一句话说明任务目标",
  "required_sections": ["触发频率建议（含 /cron 表达式）", "任务 prompt（无头可执行）", "输出落盘路径", "依赖声明"],
  "rules": ["无头模式禁外向动作", "输出遵循 C5（落盘给路径）", "依赖缺失时写明降级路径", "模板保存于 recipes/ 目录，文件名即模板 id"]
}
```
<!-- RECIPE-FORMAT-END -->
