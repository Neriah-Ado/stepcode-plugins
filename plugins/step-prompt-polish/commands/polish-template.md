---
description: "把常用指令提取为 {{变量}} 模板并落盘 .stepcode/prompt-templates/，写盘先 diff"
argument-hint: [指令文本 | --edit 名称 | --list]
---

# /polish-template — 指令模板提取

**写盘红线**：模板文件写入 `.stepcode/prompt-templates/` 前先 diff 展示，用户确认后落盘（G3）。

<!-- POLISH-TEMPLATE-RULES-START -->
```json
{
  "extract": "从指令中识别可变部分（路径/名称/参数/选项）替换为 {{变量}}，固定部分保留原措辞；frontmatter 的 variables 为对象数组 [{name, example}]（example 为渲染验证用的示例值）；输出变量清单与填表示例",
  "store": "每模板一个 .md 文件（frontmatter 含 name/description/variables）；同名模板只更新不新建（diff 后确认）",
  "render_check": "落盘前用一组真实示例值渲染验证：变量全部替换、无残留 {{ }}、渲染结果语义与原指令一致；渲染失败快速退出并列全缺失变量，不留部分产物；example 字段强制占位（不得含真实路径/用户名/凭据）",
  "version": "版本对比依赖 git 历史（声明式形态边界）：展示同一文件最近一次提交 diff；目录非 git 仓库时跳过版本对比并明说",
  "list": "--list 只读列出全部模板（name/变量数/描述），不写盘"
}
```
<!-- POLISH-TEMPLATE-RULES-END -->

## 流程

1. `--list` 只读展示；提取/编辑则生成模板草稿与 diff。
2. 渲染验证通过后展示 diff，等用户确认。
3. 确认后落盘；输出模板名与变量清单。

## 输出格式

变量清单与填表示例 → 渲染验证结果 → diff → 待确认提示。
