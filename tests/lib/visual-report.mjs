/**
 * 视觉验证报告（FK-110/FK-120 的可脚本化部分，语义与 skills/fe-visual/SKILL.md 一致）。
 */
export function renderVisualReport({ page, viewports, consoleErrors = [], responsiveIssues = [], conclusion = '' }) {
  const lines = [`# 视觉验证报告 — ${page}`, '', '## 视口对比', ''];
  for (const v of viewports) {
    lines.push(`- 视口 ${v.width}×${v.height}${v.selector ? `（selector: ${v.selector}）` : ''}`);
    lines.push(`  - before: ${v.before}`);
    lines.push(`  - after: ${v.after}`);
    lines.push(`  - 疑似差异: ${v.diff || '无'}`);
  }
  lines.push('', '## 控制台错误', '');
  lines.push(...(consoleErrors.length ? consoleErrors.map((e) => `- ${e}`) : ['- 无']));
  lines.push('', '## 响应式问题', '');
  lines.push(...(responsiveIssues.length ? responsiveIssues.map((e) => `- ${e}`) : ['- 未发现']));
  lines.push('', '## 结论', '', conclusion || '（待填写）', '');
  return lines.join('\n');
}

export function viewportBatch(page, widths = [375, 768, 1440], selector = null) {
  return widths.map((width) => ({
    width,
    height: width === 375 ? 720 : width === 768 ? 1024 : 800,
    path: `docs/fe-visual/${selector ? `component-${selector.replace(/[^a-z0-9_-]/gi, '_')}-` : ''}${width}.png`,
    selector,
  }));
}
