/**
 * 文档结构同步与过期检查（DG-110-2 / DG-130-1 的可脚本化部分）。
 * headingsSync(sourceMd, translatedMd)：标题层级树必须一致。
 * staleCheck(changedFiles, docs)：文档中引用的代码文件在变更列表中 → 需更新提示。
 */
export function extractHeadings(md) {
  return String(md)
    .split(/\r?\n/)
    .filter((l) => /^#{1,6}\s/.test(l))
    .map((l) => `${l.match(/^#+/)[0].length}:${l.replace(/^#+\s*/, '').trim()}`);
}

export function headingsSync(sourceMd, translatedMd) {
  const levels = (md) =>
    String(md)
      .split(/\r?\n/)
      .filter((l) => /^#{1,6}\s/.test(l))
      .map((l) => l.match(/^#+/)[0].length);
  const a = levels(sourceMd);
  const b = levels(translatedMd);
  const diffs = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if ((a[i] ?? '(缺失)') !== (b[i] ?? '(缺失)')) diffs.push({ line: i + 1, sourceLevel: a[i] ?? null, translatedLevel: b[i] ?? null });
  }
  return { inSync: diffs.length === 0, diffs };
}

// 文档过期检测（注入式样本验收）：文档文本中出现被改动的代码文件路径 → stale
export function staleCheck(changedFiles, docs) {
  const stale = [];
  for (const [docFile, text] of Object.entries(docs ?? {})) {
    for (const cf of changedFiles ?? []) {
      if (cf && String(text).includes(cf)) stale.push({ doc: docFile, codeFile: cf });
    }
  }
  return { stale, count: stale.length };
}
