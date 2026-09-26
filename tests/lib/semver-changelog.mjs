/**
 * /changelog 的分类、semver 建议与 CHANGELOG 节格式化（SC-120-2 的可脚本化部分）。
 * 语义与 commands/changelog.md 保持一致：
 *   - subject 形如 `type(scope)!?: subject`；正文含 BREAKING CHANGE footer 亦视为破坏性；
 *   - bump：breaking → major，feat → minor，其余（含仅 other）→ patch，空范围 null；
 *   - 节归属：breaking → Changed（仅在此节），feat → Added，fix → Fixed，其余 → Other Changes；
 *   - 条目为去掉 type 前缀后的 subject 原文。
 */

const CC_RE = /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9._/-]+\))?(!)?: (.+)$/;
const BREAKING_FOOTER = /(^|\n)BREAKING[ -]CHANGE:[^\n]*/;

export function parseCommit(subject, body = '') {
  const m = CC_RE.exec(subject);
  if (!m) return { type: null, scope: null, breaking: BREAKING_FOOTER.test(body), subject };
  const footerNote = BREAKING_FOOTER.exec(body)?.[0]?.replace(/^\n?BREAKING[ -]CHANGE:\s*/, '');
  return {
    type: m[1],
    scope: m[2] ? m[2].slice(1, -1) : null,
    breaking: Boolean(m[3]) || Boolean(footerNote),
    breakingNote: footerNote ?? null,
    subject: m[4],
  };
}

export function suggestBump(commits) {
  if (!commits || commits.length === 0) return null;
  if (commits.some((c) => c.breaking)) return 'major';
  if (commits.some((c) => c.type === 'feat')) return 'minor';
  return 'patch';
}

export function bumpVersion(version, bump) {
  if (!bump) return version;
  const [maj, min, patch] = version.split('.').map(Number);
  if (bump === 'major') return `${maj + 1}.0.0`;
  if (bump === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${patch + 1}`;
}

export function formatChangelog(version, date, commits) {
  const lines = [`## [${version}] - ${date}`, ''];
  const sectionOf = (c) => {
    if (c.breaking) return 'Changed';
    if (c.type === 'feat') return 'Added';
    if (c.type === 'fix') return 'Fixed';
    return 'Other Changes';
  };
  const order = [
    ['Added', '### Added'],
    ['Fixed', '### Fixed'],
    ['Changed', '### Changed'],
    ['Other Changes', '### Other Changes'],
  ];
  for (const [key, header] of order) {
    const inSection = commits.filter((c) => sectionOf(c) === key);
    if (inSection.length === 0) continue;
    lines.push(header);
    for (const c of inSection) {
      let entry = c.scope ? `- ${c.scope}: ${c.subject}` : `- ${c.subject}`;
      if (c.breaking && c.breakingNote) entry += ` **BREAKING CHANGE:** ${c.breakingNote}`;
      lines.push(entry);
    }
    lines.push('');
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
