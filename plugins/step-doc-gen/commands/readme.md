---
description: 从代码结构生成 README（安装/使用/示例骨架），缺失信息标注 TODO 而非编造
argument-hint: [输出路径，可选；默认 README.md]
---

# /readme — README 生成

## 生成规则

<!-- README-STRUCTURE-START -->
```json
{
  "sections": ["项目简介", "安装", "使用", "示例", "配置", "License"],
  "sources": ["package.json（name/description/scripts/依赖）", "目录结构（src/ 入口）", "既有文档片段"],
  "honesty": "缺失信息写 `<!-- TODO: 补充 xxx -->` 占位，绝不编造功能/数据/徽章",
  "c5": "生成后展示结构大纲，全文落盘给路径"
}
```
<!-- README-STRUCTURE-END -->

## 流程

1. 读取 package.json 与目录结构（monorepo 逐 package 生成）。
2. 按上方节结构生成 Markdown；安装/使用命令必须来自 scripts 真实存在的命令。
3. 输出路径参数优先；README.md 已存在时先备份为 README.backup.md 并告知用户，不静默覆盖。
4. 汇报：节数、TODO 数、路径。
