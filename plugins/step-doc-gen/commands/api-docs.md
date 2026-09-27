---
description: 从 JSDoc/TSDoc 注释与类型导出生成 API 参考文档（Markdown），产物落盘
argument-hint: [源码目录，可选；默认 src/]
---

# /api-docs — API 参考文档生成

## 规则

<!-- API-DOCS-RULES-START -->
```json
{
  "sources": ["export 的函数/类/常量", "JSDoc/TSDoc 注释（@param/@returns/@example）", "类型定义（interface/type）"],
  "structure": "按模块分节 → 每个导出一个小节：签名代码块 + 参数表 + 返回 + 示例（无注释的导出标注 `<!-- TODO: 缺少 JSDoc -->`）",
  "honesty": "不推断不存在的行为；注释缺失就标注，不编造",
  "output": "docs/api-reference.md（参数可覆盖）"
}
```
<!-- API-DOCS-RULES-END -->

## 流程

1. 扫描源码目录的 `export`（AST 级解析不强求，正则 + 注释配对足够 MVP）。
2. 按结构生成 Markdown；示例优先取 `@example`。
3. 汇报：导出数、缺注释数（TODO 计数）、输出路径。
