/**
 * step-token-meter HTML 报告渲染（TM-120-1 的可脚本化部分）。
 * 语义与 commands/usage.md「--html 报告」一致：内联 SVG 条形图、暗色主题、零外部资源。
 */
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function sectionBars(title, entries, maxTotal) {
  const bars = entries
    .slice(0, 20)
    .map((e) => {
      const w = maxTotal > 0 ? Math.max(2, Math.round((e.total / maxTotal) * 520)) : 2;
      return [
        `<text x="0" y="20" fill="#c9d1d9" font-size="13">${esc(e.label)}</text>`,
        `<rect x="180" y="8" width="${w}" height="16" rx="3" fill="#3fb950"></rect>`,
        `<text x="${180 + w + 8}" y="21" fill="#8b949e" font-size="12">${e.total}</text>`,
      ].join('');
    })
    .join('');
  return `<h2>${esc(title)}</h2><svg xmlns="http://www.w3.org/2000/svg" width="760" height="${entries.slice(0, 20).length * 28 + 8}" role="img">${bars}</svg>`;
}

export function renderHtmlReport({ generatedAt, byDay, byProject, byModel, pricesVersion }) {
  const dayEntries = Object.values(byDay).map((v) => ({ label: v.day, total: v.total }));
  const projEntries = Object.values(byProject).map((v) => ({ label: v.project, total: v.total }));
  const modelEntries = Object.values(byModel).map((v) => ({ label: v.model, total: v.total }));
  const maxTotal = Math.max(1, ...[...dayEntries, ...projEntries, ...modelEntries].map((e) => e.total));
  const grandTotal = Object.values(byDay).reduce((s, v) => s + v.total, 0);
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN"><head><meta charset="utf-8"><title>Step Token Meter 报告</title>',
    '<style>body{background:#0d1117;color:#c9d1d9;font-family:Consolas,monospace;margin:24px}h1{color:#58a6ff}h2{color:#79c0ff;margin-top:28px}</style>',
    '</head><body>',
    `<h1>Step Token Meter 用量报告</h1>`,
    `<p>生成时间：${esc(generatedAt)}｜总计 tokens：${grandTotal}｜单价表：${esc(pricesVersion ?? 'built-in')}（成本为粗估）</p>`,
    sectionBars('按日', dayEntries, maxTotal),
    sectionBars('按项目', projEntries, maxTotal),
    sectionBars('按模型', modelEntries, maxTotal),
    '</body></html>',
  ].join('\n');
}
