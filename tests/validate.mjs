#!/usr/bin/env node
/**
 * stepcode-plugins 插件门禁校验（AGENTS.md §4 中可脚本化的部分）。
 * 零依赖：node tests/validate.mjs
 * 环境变量 GIT_BIN 可指定 git 可执行文件（默认 "git"）。
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

const ok = (name) => console.log(`PASS ${name}`);
const bad = (name, detail) => { failed += 1; console.log(`FAIL ${name} :: ${detail}`); };
const check = (cond, name, detail = '') => (cond ? ok(name) : bad(name, detail));

// ---------- 1. 仓库骨架 ----------
check(existsSync(join(ROOT, 'AGENTS.md')), 'repo/AGENTS.md 存在');
check(existsSync(join(ROOT, '.step-plugin', 'marketplace.json')), 'repo/marketplace 存在');

const roadmap = JSON.parse(readFileSync(join(ROOT, 'roadmap.json'), 'utf8'));
for (const p of roadmap.plugins) {
  check(existsSync(join(ROOT, p.spec)), `roadmap/${p.id} spec 存在`, p.spec);
}

// ---------- 2. 插件清单门禁（G2） ----------
const SAFE_ID = /^[a-z0-9][a-z0-9._-]*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const FORBIDDEN_KEYS = ['entry', 'hooks', 'lspServers'];

for (const p of roadmap.plugins) {
  const dir = join(ROOT, p.spec, '..');
  const manifestPath = join(dir, 'step.plugin.json');
  if (!existsSync(manifestPath)) continue; // 未开发的插件只有 plugin.yaml
  const tag = `manifest/${p.id}`;

  const raw = readFileSync(manifestPath, 'utf8');
  check(statSync(manifestPath).size < 512 * 1024, `${tag} <512KB`);
  let m;
  try {
    m = JSON.parse(raw);
  } catch (e) {
    bad(`${tag} JSON 合法`, e.message);
    continue;
  }
  check(SAFE_ID.test(m.id ?? ''), `${tag} id 安全名`, String(m.id));
  check(m.id === p.id, `${tag} id 与 roadmap 一致`, `${m.id} vs ${p.id}`);
  check(SEMVER.test(m.version ?? ''), `${tag} version 语义化`, String(m.version));
  for (const k of FORBIDDEN_KEYS) {
    check(!(k in m), `${tag} 不含禁止字段 ${k}`);
  }
  for (const rel of [...(m.commands ?? []), ...(m.skills ?? []), ...(m.agents ?? [])]) {
    check(existsSync(join(dir, rel)), `${tag} 资源存在 ${rel}`);
  }
  check(existsSync(join(dir, 'README.md')), `${tag} README 存在（G5）`);
  check(existsSync(join(dir, 'CHANGELOG.md')), `${tag} CHANGELOG 存在（G5）`);
}

// ---------- 3. marketplace 源 ----------
const market = JSON.parse(readFileSync(join(ROOT, '.step-plugin', 'marketplace.json'), 'utf8'));
check(typeof market.name === 'string' && market.name.length > 0, 'marketplace/name 存在');
for (const entry of market.plugins ?? []) {
  check(
    existsSync(join(ROOT, entry.source, 'step.plugin.json')),
    `marketplace/${entry.name} source 指向有效插件`,
    entry.source,
  );
}

// ---------- 4. step-commit 命令安全规则存在性（G3） ----------
const commitCmd = readFileSync(join(ROOT, 'plugins/step-commit/commands/commit.md'), 'utf8');
for (const needle of ['HEREDOC', 'git status', 'git diff --staged', '--no-verify', '除非用户', 'git push --force']) {
  check(commitCmd.includes(needle), `commands/commit.md 含关键规则「${needle}」`);
}
const cppCmd = readFileSync(join(ROOT, 'plugins/step-commit/commands/commit-push-pr.md'), 'utf8');
for (const needle of ['gh --version', 'gh auth login', 'winget install GitHub.cli', '禁止 force push']) {
  check(cppCmd.includes(needle), `commands/commit-push-pr.md 含关键规则「${needle}」`);
}

// ---------- 5. Conventional Commits 校验 ----------
const CC_RE = /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9._/-]+\))?!?: (.+)$/;
const subjectOk = (subject) =>
  subject.length > 0 && subject.length <= 100 && !subject.endsWith('.') && !subject.endsWith('。');
const checkMessage = (line) => {
  const m = CC_RE.exec(line);
  return Boolean(m) && subjectOk(m[3]);
};

const samples = JSON.parse(readFileSync(join(ROOT, 'tests/samples/commits.json'), 'utf8'));
for (const s of samples.valid) check(checkMessage(s), `commit 样例合法「${s}」`);
for (const s of samples.invalid) check(!checkMessage(s), `commit 样例按预期拒绝「${s}」`);

// 本仓库提交历史自举校验（git 不可用时 SKIP，不算失败）
const GIT_BIN = process.env.GIT_BIN || 'git';
if (existsSync(join(ROOT, '.git'))) {
  const probe = spawnSync(GIT_BIN, ['--version'], { cwd: ROOT });
  if (probe.status === 0) {
    const log = execFileSync(GIT_BIN, ['log', '--pretty=%s'], { cwd: ROOT, encoding: 'utf8' });
    const subjects = log.split('\n').filter(Boolean);
    for (const s of subjects) check(checkMessage(s), `git 历史 message 合法「${s}」`);
  } else {
    console.log(`SKIP git 历史校验（找不到 git：${GIT_BIN}，可用 GIT_BIN 环境变量指定）`);
  }
}

// ---------- 6. step-commit scope 推断规则与样例（SC-110-2） ----------
const commitCmdPath = join(ROOT, 'plugins/step-commit/commands/commit.md');
const commitCmdFull = readFileSync(commitCmdPath, 'utf8');

const scopeBlock = (() => {
  const m = /<!-- SCOPE-RULES-START -->\s*```json\s*([\s\S]*?)```/.exec(commitCmdFull);
  return m ? JSON.parse(m[1]) : null;
})();
check(scopeBlock !== null, 'commit.md 含 SCOPE-RULES JSON 块');

const inferScope = (paths, rules) => {
  const generic = new Set(rules.generic_dirs ?? []);
  const hits = [];
  for (const p of paths) {
    const seg = p.split('/');
    let scope = null;
    for (const r of rules.builtin_rules ?? []) {
      if (!p.startsWith(r.prefix)) continue;
      if (r.scope.startsWith('<')) {
        const name = seg[1] ?? '';
        const minSeg = r.prefix === 'src/' ? 3 : 2;
        if (seg.length >= minSeg && name && !name.includes('.')) scope = name;
      } else {
        scope = r.scope;
      }
      break;
    }
    if (scope) hits.push(scope);
  }
  if (hits.length > 0) {
    const counts = new Map();
    for (const h of hits) counts.set(h, (counts.get(h) ?? 0) + 1);
    const max = Math.max(...counts.values());
    const winners = [...counts.entries()].filter(([, c]) => c === max);
    return winners.length === 1 ? winners[0][0] : null;
  }
  const tops = new Set(paths.map((p) => p.split('/')[0]));
  if (tops.size === 1 && !generic.has([...tops][0])) return [...tops][0];
  return null;
};

if (scopeBlock) {
  const scopeCases = JSON.parse(readFileSync(join(ROOT, 'tests/samples/scope-cases.json'), 'utf8'));
  for (const c of scopeCases.cases) {
    check(
      inferScope(c.paths, scopeBlock) === c.expected,
      `scope 推断 [${c.paths.join(', ')}] → ${c.expected}`,
      `实际 ${inferScope(c.paths, scopeBlock)}`,
    );
  }
}

// ---------- 7. step-commit commitlint 规则联动（SC-110-3） ----------
check(commitCmdFull.includes('commitlint.config'), 'commit.md 含 commitlint 配置查找说明');
check(commitCmdFull.includes('type-enum') && commitCmdFull.includes('header-max-length'), 'commit.md 含规则映射说明');

const { extractCommitlintRules } = await import('./lib/commitlint-rules.mjs');

const jsonRules = extractCommitlintRules(join(ROOT, 'tests/fixtures/commitlint/json-config'));
check(jsonRules.dynamic === false, 'commitlint JSON 配置静态解析', JSON.stringify(jsonRules));
check(
  JSON.stringify(jsonRules.rules?.typeEnum) === JSON.stringify(['feat', 'fix', 'docs']),
  'commitlint type-enum 提取',
  JSON.stringify(jsonRules.rules),
);
check(jsonRules.rules?.headerMaxLength === 72, 'commitlint header-max-length 提取');
check(
  JSON.stringify(jsonRules.rules?.scopeEnum) === JSON.stringify(['auth', 'api', 'cli']),
  'commitlint scope-enum 提取',
);

const dynamicRules = extractCommitlintRules(join(ROOT, 'tests/fixtures/commitlint/dynamic-config'));
check(dynamicRules.dynamic === true, 'commitlint JS 动态配置标记 dynamic');

const noneRules = extractCommitlintRules(join(ROOT, 'tests/fixtures/commitlint/none-config'));
check(noneRules.rules === null, 'commitlint 无配置回退 null');

// ---------- 8. step-commit /changelog 分类与 semver 建议（SC-120-1/2） ----------
check(existsSync(join(ROOT, 'plugins/step-commit/commands/changelog.md')), 'commands/changelog.md 存在');
const changelogCmd = readFileSync(join(ROOT, 'plugins/step-commit/commands/changelog.md'), 'utf8');
for (const needle of ['BREAKING CHANGE', 'git push --follow-tags', '必须征得用户明确确认']) {
  check(changelogCmd.includes(needle), `commands/changelog.md 含关键规则「${needle}」`);
}

const semverBlock = (() => {
  const m = /<!-- SEMVER-RULES-START -->\s*```json\s*([\s\S]*?)```/.exec(changelogCmd);
  return m ? JSON.parse(m[1]) : null;
})();
check(semverBlock !== null, 'changelog.md 含 SEMVER-RULES JSON 块');

const { parseCommit, suggestBump, bumpVersion, formatChangelog } = await import('./lib/semver-changelog.mjs');

check(
  semverBlock && semverBlock.bump_priority?.[0]?.when === 'breaking' && semverBlock.bump_priority?.[0]?.bump === 'major',
  'SEMVER 规则优先级：breaking → major',
);
check(
  semverBlock && semverBlock.bump_priority?.[1]?.when === 'feat' && semverBlock.bump_priority?.[1]?.bump === 'minor',
  'SEMVER 规则优先级：feat → minor',
);

const changeCases = JSON.parse(readFileSync(join(ROOT, 'tests/samples/changelog-cases.json'), 'utf8'));
for (const c of changeCases.bump_cases) {
  const parsed = c.commits.map((s) => parseCommit(s));
  check(suggestBump(parsed) === c.expected, `semver 建议 [${c.commits.join(' | ') || '空'}] → ${c.expected}`, `实际 ${suggestBump(parsed)}`);
}
check(bumpVersion('1.1.0', 'minor') === '1.2.0', '版本递增 minor');
check(bumpVersion('1.1.0', 'patch') === '1.1.1', '版本递增 patch');
check(bumpVersion('1.1.0', 'major') === '2.0.0', '版本递增 major');

for (const fc of changeCases.format_cases) {
  const parsed = fc.commits.map((c) => parseCommit(c.raw, c.body ?? ''));
  const actual = formatChangelog(fc.version, fc.date, parsed);
  check(actual === fc.expected.join('\n'), 'CHANGELOG 节格式化样例', `\n--- 期望 ---\n${fc.expected.join('\n')}\n--- 实际 ---\n${actual}`);
}

// ---------- 9. CHANGELOG 自举一致性（SC-120 / TG-100 验收，按插件通用） ----------
const checkBootstrapChangelog = (pluginId) => {
  if (!existsSync(join(ROOT, '.git'))) return;
  if (spawnSync(GIT_BIN, ['--version'], { cwd: ROOT }).status !== 0) return;
  const dir = join(ROOT, 'plugins', pluginId);
  const changelogPath = join(dir, 'CHANGELOG.md');
  if (!existsSync(changelogPath)) {
    console.log(`SKIP 自举一致性 ${pluginId}（CHANGELOG.md 尚未生成）`);
    return;
  }
  const gitOut = (args) => execFileSync(GIT_BIN, args, { cwd: ROOT, encoding: 'utf8' }).trim();
  const version = JSON.parse(readFileSync(join(dir, 'step.plugin.json'), 'utf8')).version;
  const tag = `${pluginId}-v${version}`;
  if (gitOut(['tag', '-l', tag]) !== '') {
    console.log(`SKIP 自举一致性 ${pluginId}（${tag} 已打 tag，条目已定稿）`);
    return;
  }
  const hasAnyTag = gitOut(['tag', '-l', `${pluginId}-v*`]) !== '';
  let raw;
  let date;
  if (hasAnyTag) {
    const lastTag = gitOut(['describe', '--tags', '--abbrev=0', '--match', `${pluginId}-v*`]);
    raw = execFileSync(GIT_BIN, ['log', `${lastTag}..HEAD`, '--pretty=%s%n%b%n---'], { cwd: ROOT, encoding: 'utf8' });
    date = gitOut(['log', '-1', '--pretty=%ad', '--date=short']);
  } else {
    // 首版本：取该插件目录的全部提交历史
    raw = execFileSync(GIT_BIN, ['log', '--pretty=%s%n%b%n---', '--', `plugins/${pluginId}`], { cwd: ROOT, encoding: 'utf8' });
    date = gitOut(['log', '-1', '--pretty=%ad', '--date=short', '--', `plugins/${pluginId}`]);
  }
  const commits = raw
    .split('\n---\n')
    .map((block) => block.split('\n'))
    .filter((parts) => parts[0]?.trim())
    .map((parts) => parseCommit(parts[0].trim(), parts.slice(1).join('\n')));
  const expected = formatChangelog(version, date, commits);
  const doc = readFileSync(changelogPath, 'utf8');
  const m = new RegExp(`## \\[${version}\\] - \\d{4}-\\d{2}-\\d{2}[\\s\\S]*?(?=\\n## \\[|\\s*$)`).exec(doc);
  check(m !== null, `CHANGELOG.md ${pluginId} 含 [${version}] 节`);
  if (m) {
    check(m[0].trim() === expected.trim(), `CHANGELOG 自举一致 ${pluginId}（文件内容 = 库对 git 历史的输出）`, `\n--- 期望 ---\n${expected}\n--- 实际 ---\n${m[0]}`);
  }
};
checkBootstrapChangelog('step-commit');
checkBootstrapChangelog('step-test-guard');

// ---------- 10. step-commit monorepo 与 release PR（SC-130-1/2/3） ----------
check(changelogCmd.includes('pnpm-workspace.yaml'), 'commands/changelog.md 含 monorepo 检测说明');
const monorepoBlock = (() => {
  const m = /<!-- MONOREPO-RULES-START -->\s*```json\s*([\s\S]*?)```/.exec(changelogCmd);
  return m ? JSON.parse(m[1]) : null;
})();
check(monorepoBlock !== null, 'changelog.md 含 MONOREPO-RULES JSON 块');
check(monorepoBlock?.tag_style?.includes('<package短名>-vX.Y.Z'), 'MONOREPO 规则含 per-package tag 风格');

check(existsSync(join(ROOT, 'plugins/step-commit/commands/release-pr.md')), 'commands/release-pr.md 存在');
const releaseCmd = readFileSync(join(ROOT, 'plugins/step-commit/commands/release-pr.md'), 'utf8');
for (const needle of ['chore/release-v', 'chore(release): prepare', 'gh pr create', 'glab mr create', '禁止 force push', '每步先向用户确认']) {
  check(releaseCmd.includes(needle), `commands/release-pr.md 含关键规则「${needle}」`);
}
const releaseBlock = (() => {
  const m = /<!-- RELEASE-PR-RULES-START -->\s*```json\s*([\s\S]*?)```/.exec(releaseCmd);
  return m ? JSON.parse(m[1]) : null;
})();
check(releaseBlock?.remote?.github?.tool === 'gh' && releaseBlock?.remote?.gitlab?.tool === 'glab', 'RELEASE-PR 规则声明双平台工具');

for (const needle of ['glab --version', 'winget install GLab.GLab', 'glab auth login', '--target-branch', 'git remote get-url origin']) {
  check(cppCmd.includes(needle), `commands/commit-push-pr.md 含关键规则「${needle}」`);
}

const { detectMonorepo, groupPathsByPackage } = await import('./lib/monorepo.mjs');
const monoCases = JSON.parse(readFileSync(join(ROOT, 'tests/samples/monorepo-cases.json'), 'utf8'));

for (const c of monoCases.detect_cases) {
  const detected = detectMonorepo(join(ROOT, 'tests/fixtures', c.fixture));
  check(detected.isMonorepo === c.isMonorepo && detected.workspaceFile === c.workspaceFile, `monorepo 检测 ${c.fixture}`, JSON.stringify(detected));
  check(detected.packages.length >= c.packageCount, `monorepo ${c.fixture} 含 ${c.packageCount}+ package`, String(detected.packages.length));
  const names = detected.packages.map((p) => p.name);
  for (const n of c.names) check(names.includes(n), `monorepo ${c.fixture} 含 package ${n}`, JSON.stringify(names));
}

for (const c of monoCases.group_cases) {
  const grouped = groupPathsByPackage(c.paths, detectMonorepo(join(ROOT, 'tests/fixtures/monorepo-sample')).packages);
  check(
    JSON.stringify(grouped) === JSON.stringify(c.expected),
    `monorepo 归组 [${c.paths.join(', ')}]`,
    `\n期望 ${JSON.stringify(c.expected)}\n实际 ${JSON.stringify(grouped)}`,
  );
}

for (const c of monoCases.bump_cases) {
  const actual = Object.fromEntries(
    Object.entries(c.commits_by_package).map(([pkg, commits]) => [pkg, suggestBump(commits.map((s) => parseCommit(s)))]),
  );
  check(
    JSON.stringify(actual) === JSON.stringify(c.expected),
    `monorepo 按 package semver 建议`,
    `\n期望 ${JSON.stringify(c.expected)}\n实际 ${JSON.stringify(actual)}`,
  );
}

// ---------- 11. step-test-guard（TG-100） ----------
const tgTestCmd = readFileSync(join(ROOT, 'plugins/step-test-guard/commands/test.md'), 'utf8');
const tgSkill = readFileSync(join(ROOT, 'plugins/step-test-guard/skills/test-fix-loop/SKILL.md'), 'utf8');

const extractBlock = (text, marker) => {
  const m = new RegExp(`<!-- ${marker}-START -->\\s*\`\`\`json\\s*([\\s\\S]*?)\`\`\``).exec(text);
  return m ? JSON.parse(m[1]) : null;
};

const tgDetectBlock = extractBlock(tgTestCmd, 'TEST-DETECT');
check(tgDetectBlock !== null && Array.isArray(tgDetectBlock.detectors), 'test.md 含 TEST-DETECT JSON 块');
const tgPatterns = extractBlock(tgTestCmd, 'TEST-PATTERNS');
check(tgPatterns !== null && tgPatterns.vitest && tgPatterns.jest && tgPatterns.pytest, 'test.md 含 TEST-PATTERNS JSON 块');
const tgLoopBlock = extractBlock(tgSkill, 'LOOP-RULES');
check(tgLoopBlock !== null && tgLoopBlock.max_rounds === 3, 'SKILL.md 含 LOOP-RULES 且上限为 3 轮');

for (const needle of ['docs/test-guard/last-run.log', '以上全未命中时', '不删除、不禁用测试']) {
  check(tgTestCmd.includes(needle), `commands/test.md 含关键规则「${needle}」`);
}
for (const needle of ['断言失败', '环境问题', '真实回归', '最小改动', '全量重跑', 'escalate']) {
  check(tgSkill.includes(needle), `SKILL.md 含关键规则「${needle}」`);
}

const { detectStack } = await import('./lib/stack-detect.mjs');
const { parseTestOutput } = await import('./lib/test-parse.mjs');

const detectFixtures = [
  ['vitest-sample', 'vitest'],
  ['jest-sample', 'jest'],
  ['pytest-sample', 'pytest'],
  ['node-sample', 'node'],
  ['go-sample', 'go'],
  ['cargo-sample', 'cargo'],
  ['maven-sample', 'maven'],
  ['gradle-sample', 'gradle'],
];
for (const [fixture, stack] of detectFixtures) {
  const detected = detectStack(join(ROOT, 'tests/fixtures/test-projects', fixture), tgDetectBlock.detectors);
  check(detected?.stack === stack, `框架检测 ${fixture} → ${stack}`, JSON.stringify(detected));
}

const tgCases = JSON.parse(readFileSync(join(ROOT, 'tests/samples/test-output-cases.json'), 'utf8'));
for (const c of tgCases.cases) {
  const entries = parseTestOutput(c.stack, c.log, tgPatterns);
  check(entries.length === c.expected.length, `输出解析「${c.name}」条数`, `期望 ${c.expected.length}，实际 ${JSON.stringify(entries)}`);
  for (let i = 0; i < Math.min(entries.length, c.expected.length); i += 1) {
    const a = entries[i];
    const e = c.expected[i];
    check(a.file === e.file && a.case === e.case, `输出解析「${c.name}」#${i + 1} 定位`, JSON.stringify(a));
    if (e.expect !== undefined) check(a.expect === e.expect, `输出解析「${c.name}」#${i + 1} expect`, JSON.stringify(a));
    if (e.actual !== undefined) check(a.actual === e.actual, `输出解析「${c.name}」#${i + 1} actual`, JSON.stringify(a));
    if (e.detailContains !== undefined) check((a.detail ?? '').includes(e.detailContains), `输出解析「${c.name}」#${i + 1} detail`, JSON.stringify(a));
  }
}

// ---------- 12. step-test-guard 覆盖率解读（TG-110-2） ----------
check(tgTestCmd.includes('coverage-summary.json') && tgTestCmd.includes('cobertura.xml'), 'test.md 含覆盖率产物说明');
const covBlock = extractBlock(tgTestCmd, 'COVERAGE-RULES');
check(covBlock !== null && covBlock.default_threshold === 80, 'test.md 含 COVERAGE-RULES 且默认阈值 80');

const { readIstanbulSummary, readCobertura } = await import('./lib/coverage.mjs');
const istanbul = readIstanbulSummary(readFileSync(join(ROOT, 'tests/fixtures/coverage/istanbul-summary.json'), 'utf8'), covBlock.default_threshold);
check(istanbul.overallPct === 87.4, 'istanbul 整体覆盖率读取', JSON.stringify(istanbul));
check(
  JSON.stringify(istanbul.lowFiles) === JSON.stringify([{ file: 'src/api.ts', pct: 62 }]),
  'istanbul 低于阈值文件列表',
  JSON.stringify(istanbul.lowFiles),
);
const cobertura = readCobertura(readFileSync(join(ROOT, 'tests/fixtures/coverage/cobertura.xml'), 'utf8'), covBlock.default_threshold);
check(cobertura.overallPct === 86, 'cobertura 整体覆盖率读取', JSON.stringify(cobertura));
check(
  JSON.stringify(cobertura.lowFiles) === JSON.stringify([{ file: 'src/legacy.ts', pct: 55 }]),
  'cobertura 低于阈值文件列表',
  JSON.stringify(cobertura.lowFiles),
);

// ---------- 13. step-test-guard 失败用例缓存（TG-110-3） ----------
const cacheBlock = extractBlock(tgTestCmd, 'CACHE-RULES');
check(cacheBlock !== null && cacheBlock.cache_path === 'docs/test-guard/failed-cases.json', 'test.md 含 CACHE-RULES 且路径正确');
check(tgSkill.includes('failed-cases.json'), 'SKILL.md 引用失败用例缓存');

const { loadCache, saveCache, mergeCases, rangeMatches } = await import('./lib/fail-cache.mjs');
check(loadCache(cacheBlock ? JSON.stringify([{ stack: 'vitest', file: 'src/a.test.ts', case: 'x' }]) : null)?.length === 1, '缓存正常读取');
check(loadCache('{broken json') === null, '缓存损坏时容错返回 null');
check(loadCache('{"not":"array"}') === null, '缓存格式非数组时返回 null');

const merged = mergeCases(
  [{ stack: 'vitest', file: 'a.ts', case: 'x' }],
  [{ stack: 'vitest', file: 'a.ts', case: 'x' }, { stack: 'pytest', file: 't.py', case: 'y' }],
);
check(merged.length === 2, '缓存合并按 file+case 去重', JSON.stringify(merged));
check(rangeMatches([{ stack: 'vitest', file: 'a', case: 'x' }], 'vitest') === true, '缓存范围匹配');
check(rangeMatches([{ stack: 'vitest', file: 'a', case: 'x' }], 'go') === false, '缓存 stack 变化视为范围不符');
check(typeof saveCache([{ stack: 'go', file: 'a_test.go', case: 'TestSub' }]) === 'string', '缓存写出为 JSON 字符串');

// ---------- 14. step-test-guard 夜间守护与报告（TG-120-1/2） ----------
check(existsSync(join(ROOT, 'plugins/step-test-guard/commands/nightly-test.md')), 'commands/nightly-test.md 存在');
const nightlyCmd = readFileSync(join(ROOT, 'plugins/step-test-guard/commands/nightly-test.md'), 'utf8');
const nightlyBlock = extractBlock(nightlyCmd, 'NIGHTLY-RULES');
check(nightlyBlock !== null && nightlyBlock.report_path === 'docs/test-report.md', 'nightly-test.md 含 NIGHTLY-RULES 且报告路径正确');
check(nightlyBlock?.exit_semantics?.green === '0' && nightlyBlock?.exit_semantics?.has_failures === '1', '夜间任务退出码语义');
check(nightlyCmd.includes('AGENTS.md') && nightlyCmd.includes('优先于框架自动检测'), '夜间任务含 AGENTS.md 约定协作');
check(nightlyCmd.includes('禁止 git push'), '无头模式禁外向动作');

const reportBlock = extractBlock(nightlyCmd, 'REPORT-RULES');
check(reportBlock !== null && JSON.stringify(reportBlock.sections) === JSON.stringify(['摘要', '失败明细', '与上轮对比']), '报告节结构完整');

const { renderReport, diffFailures } = await import('./lib/report.mjs');
const reportCases = JSON.parse(readFileSync(join(ROOT, 'tests/samples/report-cases.json'), 'utf8'));
for (const c of reportCases.render_cases) {
  const md = renderReport(c.input);
  for (const needle of c.expectContains) check(md.includes(needle), `报告渲染「${c.name}」含「${needle}」`, md);
}
const d = diffFailures(
  [{ file: 'a', case: '1' }, { file: 'b', case: '2' }],
  [{ file: 'b', case: '2' }, { file: 'c', case: '3' }],
);
check(d.added.length === 1 && d.resolved.length === 1 && d.kept.length === 1, '失败集对比三分类', JSON.stringify(d));

// ---------- 15. step-test-guard bisect 与 flaky（TG-130-1/2） ----------
check(existsSync(join(ROOT, 'plugins/step-test-guard/commands/bisect.md')), 'commands/bisect.md 存在');
const bisectCmd = readFileSync(join(ROOT, 'plugins/step-test-guard/commands/bisect.md'), 'utf8');
const bisectBlock = extractBlock(bisectCmd, 'BISECT-RULES');
check(bisectBlock !== null && bisectBlock.finish?.includes('git bisect reset'), 'bisect.md 含 BISECT-RULES 且规定 reset');
for (const needle of ['git status', '转人工确认', '不自动 revert', 'token 经济', '125']) {
  check(bisectCmd.includes(needle), `commands/bisect.md 含关键规则「${needle}」`);
}

check(existsSync(join(ROOT, 'plugins/step-test-guard/commands/flaky.md')), 'commands/flaky.md 存在');
const flakyCmd = readFileSync(join(ROOT, 'plugins/step-test-guard/commands/flaky.md'), 'utf8');
const flakyBlock = extractBlock(flakyCmd, 'FLAKY-RULES');
check(flakyBlock !== null && flakyBlock.default_runs === 10, 'flaky.md 含 FLAKY-RULES 且默认 10 轮');
for (const needle of ['stable-pass', 'flaky', 'stable-fail', '用户确认', 'pytest-rerunfailures']) {
  check(flakyCmd.includes(needle), `commands/flaky.md 含关键规则「${needle}」`);
}

const { analyzeFlaky, recommendedAction } = await import('./lib/flaky.mjs');
check(analyzeFlaky([true, false, true, false, true, false, true, false, true, false]).verdict === 'flaky', 'flaky 判定：间歇失败');
check(analyzeFlaky([true, true, true, false]).verdict === 'flaky', 'flaky 判定：低频失败');
check(analyzeFlaky([false, false, false]).verdict === 'stable-fail', 'flaky 判定：全失败为稳定失败');
check(analyzeFlaky([]).verdict === 'invalid', 'flaky 判定：空数据无效');
check(recommendedAction('stable-fail').includes('test-fix-loop'), 'stable-fail 建议转修复闭环');
check(recommendedAction('flaky').includes('用户确认'), 'flaky 隔离动作需用户确认');

// ---------- 汇总 ----------
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
