/**
 * 构建产物性能提示（FK-130-1 的可脚本化部分，语义与 skills/fe-visual PERF-RULES 一致）。
 * parseViteBuild(text) → { assets: [{name, sizeKB}], warnings: [...] }
 */
export function parseViteBuild(text) {
  const assets = [];
  const warnings = [];
  const re = /([\w./-]+\.(?:js|css))\s+([\d.]+)\s*kB/i;
  for (const line of String(text).split(/\r?\n/)) {
    const m = re.exec(line);
    if (m) assets.push({ name: m[1], sizeKB: parseFloat(m[2]) });
  }
  for (const a of assets) {
    if (a.sizeKB > 500) warnings.push(`${a.name} 体积 ${a.sizeKB}kB 超过 500kB：考虑代码分割（动态 import）`);
    else if (a.sizeKB > 250) warnings.push(`${a.name} 体积 ${a.sizeKB}kB 偏大：检查是否误打了依赖（rollup-plugin-visualizer）`);
  }
  const cssBlocking = /render-blocking|blocking/i.test(text);
  if (cssBlocking) warnings.push('检测到渲染阻塞资源提示：考虑 media 属性或按需加载 CSS');
  return { assets, warnings };
}
