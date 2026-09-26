/**
 * 夜间测试报告渲染与上轮对比（TG-120-2 的可脚本化部分）。
 * 语义与 commands/nightly-test.md「报告生成」一致：
 *   - 节：摘要 / 失败明细 / 与上轮对比；
 *   - 对比按 file+case 与上轮失败集比对，三分类：新增 / 已解决 / 仍在；
 *   - 会话侧只输出路径与一句话摘要（C5），全文落盘。
 */
export function diffFailures(current, previous) {
  const key = (e) => `${e.file ?? ''}\u0000${e.case}`;
  const cur = new Map(current.map((e) => [key(e), e]));
  const prev = new Map(previous.map((e) => [key(e), e]));
  const added = [];
  const resolved = [];
  const kept = [];
  for (const [k, e] of cur) (prev.has(k) ? kept : added).push(e);
  for (const [k, e] of prev) if (!cur.has(k)) resolved.push(e);
  return { added, resolved, kept };
}

export function renderReport({ date, stack, passed, failed, skipped, exitCode, failures, previous }) {
  const diff = diffFailures(failures, previous ?? []);
  const lines = [
    `# 测试报告 ${date}`,
    '',
    '## 摘要',
    '',
    `- 框架：${stack}`,
    `- 通过 ${passed} / 失败 ${failed} / 跳过 ${skipped}`,
    `- 退出码：${exitCode}`,
    '',
  ];
  lines.push('## 失败明细', '');
  if (failures.length === 0) lines.push('（无失败用例）', '');
  for (const f of failures) {
    lines.push(`- case: ${f.case}`);
    lines.push(`  file: ${f.file ?? '未知'}`);
    if (f.detail) lines.push(`  detail: ${f.detail}`);
  }
  if (failures.length > 0) lines.push('');
  lines.push('## 与上轮对比', '');
  const fmt = (list, tag) => list.map((e) => `- 【${tag}】${e.file ?? '未知'} :: ${e.case}`);
  const compareLines = [
    ...fmt(diff.added, '新增'),
    ...fmt(diff.resolved, '已解决'),
    ...fmt(diff.kept, '仍在'),
  ];
  lines.push(...(compareLines.length ? compareLines : ['- 无可对比数据（首次运行或上轮无记录）']), '');
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return `${lines.join('\n')}\n`;
}
