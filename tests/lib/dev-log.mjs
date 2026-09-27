/**
 * dev server 启动日志解析（FK-100-3 的可脚本化部分，规则与 commands/dev.md 的 DEV-LOG-RULES 一致）。
 * parseDevLog(stack, text, rules) → { ready, port, error }
 */
export function parseDevLog(stack, text, rules) {
  const r = rules[stack];
  if (!r) return { ready: false, port: null, error: null };
  const readyRe = new RegExp(r.ready);
  const errorRe = new RegExp(r.error);
  let ready = false;
  let port = null;
  for (const line of String(text).split(/\r?\n/)) {
    const m = readyRe.exec(line);
    if (m && !ready) {
      ready = true;
      const nums = m.slice(1).filter((v) => v !== undefined && /^\d+$/.test(v));
      port = nums.length ? Number(nums.at(-1)) : null;
    }
  }
  const errMatch = errorRe.exec(text);
  return { ready, port, error: errMatch ? errMatch[0] : null };
}
