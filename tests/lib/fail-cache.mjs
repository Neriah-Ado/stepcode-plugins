/**
 * 失败用例缓存（TG-110-3 的可脚本化部分）。
 * 语义与 commands/test.md「失败用例缓存」一致：
 *   - 缓存为 JSON 数组 [{stack,file,case}]；解析失败视为无缓存（容错，不崩溃）；
 *   - 合并按 file + case 去重；
 *   - stack 变化视为范围不符（rangeMismatch = true），应直接全量。
 */
export function loadCache(text) {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return null;
    return data.filter((e) => e && typeof e.file === 'string' && typeof e.case === 'string');
  } catch {
    return null;
  }
}

export function saveCache(entries) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

export function mergeCases(...lists) {
  const map = new Map();
  for (const list of lists ?? []) {
    for (const e of list ?? []) {
      map.set(`${e.stack ?? ''}\u0000${e.file}\u0000${e.case}`, e);
    }
  }
  return [...map.values()];
}

export function rangeMatches(cache, stack) {
  if (!cache || cache.length === 0) return true;
  return cache.every((e) => !e.stack || e.stack === stack);
}
