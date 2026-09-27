---
name: fe-visual
description: 前端视觉验证：改版前后截图对比、浏览器控制台错误采集、selector 组件级截图、多视口批量检查。涉及 UI 改动验证时使用。
---

# fe-visual — 视觉验证

前置：/dev 已起 dev server；内置 playwright 插件可用（不可用时提示 `/plugin install playwright` 并停止）。

## 基本流程（改版前后对比）

<!-- VISUAL-RULES-START -->
```json
{
  "viewport": { "width": 1280, "height": 800, "默认": true },
  "before": "改动前先截图并存 docs/fe-visual/before-<视口>.png",
  "after": "改动后同视口同路径截图 docs/fe-visual/after-<视口>.png",
  "compare": "对比报告 docs/fe-visual/report.md：逐视口列出差异描述 + 截图相对路径；像素级 diff 用 playwright 截图后按文件大小/内容摘要近似判断，结论措辞用「疑似差异」",
  "console_errors": "截图同时采集 console error/failed request 列表，并入报告「控制台错误」节",
  "c5": "报告落盘给路径；截图给相对路径不内联 base64"
}
```
<!-- VISUAL-RULES-END -->

## 组件级截图（v1.2.0）

<!-- SELECTOR-VIEWPORTS-START -->
```json
{
  "selector": "指定 CSS selector 时只截取该元素（组件级验证）",
  "viewports": [375, 768, 1440],
  "batch": "多视口批量检查：同一页面/组件逐视口截图并输出对比表（视口/截图/发现的问题）",
  "responsive_hint": "375 视口重点检查横向溢出、断行、按钮可点区域 <44px"
}
```
<!-- SELECTOR-VIEWPORTS-END -->

## 报告格式

报告含四节：`## 视口对比`（逐视口 before/after 路径与差异描述）、`## 控制台错误`、`## 响应式问题`（多视口时）、`## 结论`（是否达到改动目标 + 遗留问题）。
