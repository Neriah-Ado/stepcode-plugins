/**
 * cron 模板变量渲染与索引（CR-120-2 / CR-130-2 的可脚本化部分）。
 */
export function renderTemplate(template, vars = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const builtins = { date, range: '7d' };
  const missing = [];
  const rendered = String(template).replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (vars[name] !== undefined) return String(vars[name]);
    if (builtins[name] !== undefined) return builtins[name];
    missing.push(name);
    return `{{${name}}}`;
  });
  return { rendered, missing };
}

export function buildIndex(recipes) {
  const lines = ['# 定时任务模板索引', '', '| 模板 | 目标 | 频率 | 输出 |', '| --- | --- | --- | --- |'];
  for (const r of recipes ?? []) {
    lines.push(`| ${r.id} | ${r.description} | ${r.schedule} | ${r.output} |`);
  }
  return lines.join('\n') + '\n';
}
