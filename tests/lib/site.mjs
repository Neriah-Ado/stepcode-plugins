/**
 * mkdocs 侧边栏自动组织（DG-120-2 的可脚本化部分）。
 * buildMkdocsNav(entries)：entries = docs/ 目录树（目录 → 节，index 优先）→ nav YAML 文本。
 */
export function buildMkdocsNav(entries) {
  const dirs = new Map();
  const roots = [];
  for (const e of entries ?? []) {
    const idx = e.indexOf('/');
    if (idx === -1) {
      roots.push(e);
      continue;
    }
    const dir = e.slice(0, idx);
    if (!dirs.has(dir)) dirs.set(dir, []);
    dirs.get(dir).push(e);
  }
  const lines = ['nav:'];
  for (const r of roots.sort()) lines.push(`  - ${r.replace(/\.(md|html)$/, '')}: ${r}`);
  for (const [dir, files] of [...dirs.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    lines.push(`  - ${dir}:`);
    for (const f of files.sort((a, b) => (a.endsWith('index.md') ? -1 : b.endsWith('index.md') ? 1 : a < b ? -1 : 1))) {
      lines.push(`      - ${f.slice(dir.length + 1).replace(/\.md$/, '')}: ${f}`);
    }
  }
  return lines.join('\n') + '\n';
}
