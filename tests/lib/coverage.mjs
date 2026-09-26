/**
 * 覆盖率报告解读（TG-110-2 的可脚本化部分）。
 * 语义与 commands/test.md「覆盖率解读」一致：
 *   - istanbul：coverage-summary.json，total.lines.pct 为整体，逐文件 lines.pct；
 *   - cobertura：XML 的 line-rate（0-1），coverage 根为整体，class 为逐文件；
 *   - 低于阈值的文件列入 lowFiles（未覆盖关键路径提示），只提示不阻断。
 */
const classTagRe = /<class\b[^>]*>/g;

const pctOf = (rate) => Math.round(parseFloat(rate) * 1000) / 10;

export function readIstanbulSummary(text, threshold = 80) {
  const data = JSON.parse(text);
  const overallPct = data?.total?.lines?.pct ?? null;
  const lowFiles = [];
  for (const [file, info] of Object.entries(data ?? {})) {
    if (file === 'total') continue;
    const pct = info?.lines?.pct;
    if (typeof pct === 'number' && pct < threshold) lowFiles.push({ file, pct });
  }
  lowFiles.sort((a, b) => a.pct - b.pct);
  return { kind: 'istanbul', overallPct, lowFiles };
}

export function readCobertura(text, threshold = 80) {
  const root = /<coverage\b[^>]*line-rate="([^"]+)"/.exec(text);
  const overallPct = root ? pctOf(root[1]) : null;
  const lowFiles = [];
  for (const tag of text.match(classTagRe) ?? []) {
    const fn = /filename="([^"]+)"/.exec(tag);
    const lr = /line-rate="([^"]+)"/.exec(tag);
    if (!fn || !lr) continue;
    const pct = pctOf(lr[1]);
    if (pct < threshold) lowFiles.push({ file: fn[1], pct });
  }
  lowFiles.sort((a, b) => a.pct - b.pct);
  return { kind: 'cobertura', overallPct, lowFiles };
}
