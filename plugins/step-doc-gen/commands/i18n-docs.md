---
description: README 多语言互译并保持结构同步；术语表保证一致；仅生成 README.xx.md，不改原文
argument-hint: [目标语言，可选；默认 en]
---

# /i18n-docs — README 多语言

<!-- I18N-RULES-START -->
```json
{
  "source": "README.md（主语言）为唯一事实源",
  "output": "README.en.md / README.ja.md（仅新增文件，绝不修改原文）",
  "glossary": ".stepcode/glossary.json（{\"term\": \"译名\"}），翻译时强制采用，缺失术语翻译后回填术语表",
  "structure_sync": "标题层级与顺序必须与原文一一对应（由 tests/lib/i18n.mjs 的结构同步检查校验）",
  "code_fenced": "代码块不翻译，仅翻译注释"
}
```
<!-- I18N-RULES-END -->

## 流程

1. 读原文提取标题树与正文段；术语表不存在时初始化空表。
2. 逐段翻译（代码块跳过）→ 结构同步检查 → 写 README.<lang>.md。
3. 汇报：语言、段落数、术语表新增数。
