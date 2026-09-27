#!/usr/bin/env node
/**
 * stepcode-plugins 插件门禁校验（AGENTS.md §4 中可脚本化的部分）。
 * 零依赖：node tests/validate.mjs
 * 环境变量 GIT_BIN 可指定 git 可执行文件（默认 "git"）。
 */
import { readFileSync, existsSync, statSync, writeFileSync, rmSync } from 'node:fs';
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

// ---------- 16. step-token-meter 用量统计（TM-100） ----------
check(existsSync(join(ROOT, 'plugins/step-token-meter/docs/storage-format.md')), 'step-token-meter 存储格式文档存在');
const usageCmd = readFileSync(join(ROOT, 'plugins/step-token-meter/commands/usage.md'), 'utf8');
for (const needle of ['零网络', 'docs/storage-format.md', '--csv', '容错解析', '成本为按公开单价的粗估']) {
  check(usageCmd.includes(needle), `commands/usage.md 含关键规则「${needle}」`);
}
const usagePrice = extractBlock(usageCmd, 'PRICE-RULES');
check(usagePrice !== null && usagePrice.default?.input === 15, 'usage.md 含 PRICE-RULES 默认单价表');

const { parseSessionText, aggregate, toCsv, costOf, loadPrices } = await import('./lib/usage.mjs');
const usageSamples = JSON.parse(readFileSync(join(ROOT, 'tests/samples/usage-samples.json'), 'utf8'));
const { records, warnings } = parseSessionText(usageSamples.lines.join('\n'));
check(records.length === usageSamples.expect.recordCount, '容错解析：有效记录数', String(records.length));
check(warnings.length === usageSamples.expect.warningCount, '容错解析：损坏行警告计数', JSON.stringify(warnings));
const agg = aggregate(records);
for (const [day, m] of Object.entries(usageSamples.expect.byDay)) {
  check(agg.byDay[day]?.total === m.total, `按日聚合 ${day} total=${m.total}`, JSON.stringify(agg.byDay[day]));
}
check(agg.byModel && Object.values(agg.byModel)[0].model === usageSamples.expect.byModelTop.model, '按模型聚合排序首位');
check(Object.values(agg.byModel)[0].total === usageSamples.expect.byModelTop.total, '按模型聚合首位总量');
const csv = toCsv(records, usagePrice);
check(csv.startsWith(usageSamples.expect.csvHeader), 'CSV 表头');
check(csv.trim().split('\n').length === usageSamples.expect.csvRowCount + 1, 'CSV 行数');
const glmCost = costOf(records[0], usagePrice);
check(Math.abs(glmCost.cost - (1000 * 2 + 500 * 8 + 200 * 0.2 + 100 * 2) / 1e6) < 1e-9, 'glm-4.7 成本计算', String(glmCost.cost));
const mysteryCost = costOf(records[3], usagePrice);
check(mysteryCost.usedDefault && mysteryCost.cost > 0, '未知模型回退 default 单价');
check(loadPrices(usagePrice, { models: { 'glm-4.7': { input: 1 } } }).models['glm-4.7'].input === 1, '单价覆盖合并');

// ---------- 16b. step-token-meter MCP server（TM-110） ----------
{
  const tmDir = join(ROOT, 'plugins/step-token-meter');
  const tmManifest = JSON.parse(readFileSync(join(tmDir, 'step.plugin.json'), 'utf8'));
  check(tmManifest.mcpServers?.['step-token-meter']?.command === 'node', 'manifest 注册 mcpServers（node 启动）');
  check(existsSync(join(tmDir, 'server/index.mjs')) && existsSync(join(tmDir, 'server/lib.mjs')), 'server 代码存在');
  check(existsSync(join(tmDir, 'config/prices.example.json')), '单价覆盖样例存在');

  const sessionFixture = join(ROOT, 'tests/fixtures/stepcode-projects');
  const mcpInput = [
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_usage', arguments: { range: 'all' } } }),
    JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_usage_by_model', arguments: { range: 'all' } } }),
    JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope', arguments: {} } }),
    '',
  ].join('\n');

  const mkPrices = (glmInputRate) =>
    JSON.stringify({ default: { input: 15, output: 75, cache_read: 0, cache_write: 0 }, models: { 'glm-4.7': { input: glmInputRate, output: 8, cache_read: 0.2, cache_write: 2 } } });
  const pricesPath = join(ROOT, 'tests/fixtures/tm-prices.json');

  const runServer = () => {
    const r = spawnSync(process.execPath, [join(tmDir, 'server/index.mjs')], {
      input: mcpInput,
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, STEP_TOKEN_METER_DIR: sessionFixture, STEP_TOKEN_METER_PRICES: pricesPath },
    });
    if (r.status !== 0) throw new Error(`server 退出 ${r.status}: ${r.stderr}`);
    return (r.stdout + '\n').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  };

  try {
    writeFileSync(pricesPath, mkPrices(2));
    const msgs = runServer();
    const init = msgs.find((m) => m.id === 1);
    check(init?.result?.serverInfo?.name === 'step-token-meter', 'MCP initialize 握手', JSON.stringify(init));
    const tools = msgs.find((m) => m.id === 2);
    check(
      JSON.stringify(tools?.result?.tools?.map((t) => t.name)) === JSON.stringify(['get_usage', 'get_usage_by_model']),
      'MCP tools/list',
      JSON.stringify(tools?.result?.tools?.map((t) => t.name)),
    );
    const usage = msgs.find((m) => m.id === 3);
    const structured = usage?.result?.structuredContent;
    check(structured?.grandTotal === 7800, 'get_usage 汇总数', JSON.stringify(structured?.grandTotal));
    check(structured?.days?.length === 2, 'get_usage 按日条数', JSON.stringify(structured?.days?.length));
    const byModel = msgs.find((m) => m.id === 4);
    const bm = byModel?.result?.structuredContent;
    check(bm?.models?.[0]?.model === 'glm-4.7' && bm?.models?.[0]?.total === 5000, 'get_usage_by_model 排序首位', JSON.stringify(bm?.models?.[0]));
    check(msgs.find((m) => m.id === 5)?.error?.code === -32602, '未知工具返回 -32602');

    // 热加载：改写单价文件（mtime 变化）后新调用生效
    writeFileSync(pricesPath, mkPrices(20));
    const msgs2 = runServer();
    const usage2 = msgs2.find((m) => m.id === 3)?.result?.structuredContent;
    check(usage2?.grandTotal === 7800 && usage2?.days?.length === 2, '热加载后再次调用正常', JSON.stringify(usage2?.days));
    check(usage2?.days?.[0]?.cost !== structured?.days?.[0]?.cost, '单价表热加载生效（成本变化）', `${structured?.days?.[0]?.cost} -> ${usage2?.days?.[0]?.cost}`);
  } catch (e) {
    bad('MCP server 冒烟', e.message);
  } finally {
    rmSync(pricesPath, { force: true });
  }
}

// ---------- 17. step-token-meter 可视化（TM-120） ----------
const htmlBlock = extractBlock(usageCmd, 'HTML-RULES');
check(htmlBlock !== null && htmlBlock.no_external?.includes('零外部资源'), 'usage.md 含 HTML-RULES（零外部资源）');
const weeklyBlock = extractBlock(usageCmd, 'WEEKLY-RULES');
check(weeklyBlock !== null && weeklyBlock.outputs?.html === 'docs/usage-report/usage-weekly.html', 'usage.md 含 WEEKLY-RULES 周报落盘');
check(weeklyBlock?.cadence?.includes('/cron'), '周报接入 /cron');

const { renderHtmlReport } = await import('./lib/report-html.mjs');
const html = renderHtmlReport({ generatedAt: '2026-09-27T08:00:00Z', byDay: agg.byDay, byProject: agg.byProject, byModel: agg.byModel });
check(!/(src|href)\s*=|@import|url\(/i.test(html.replace(/xmlns="[^"]*"/g, '')), 'HTML 零外部资源（无 src/href/import 引用）');
check((html.match(/<svg /g) ?? []).length === 3, '三组内联 SVG 图表', String((html.match(/<svg /g) ?? []).length));
check(html.includes('#0d1117') && html.includes('lang="zh-CN"'), '暗色主题与中文页面');
check(html.includes('>2026-09-26<') && html.includes('>glm-4.7<'), '图表含日与模型标签');

// ---------- 18. step-token-meter 预算/合并/迁移（TM-130） ----------
const budgetBlock = extractBlock(usageCmd, 'BUDGET-RULES');
check(budgetBlock !== null && budgetBlock.rule?.includes('exceed'), 'usage.md 含 BUDGET-RULES');
const mergeBlock = extractBlock(usageCmd, 'MERGE-RULES');
check(mergeBlock !== null && mergeBlock.rule?.includes('本机单价表重算'), 'usage.md 含 MERGE-RULES');
check(usageCmd.includes('SCHEMA_PARSERS') && usageCmd.includes('unknown-schema'), 'usage.md 含 schema migration 说明');

const { checkBudget, mergeCsvs, parseSessionVersioned, parseSessionText: parseTextV } = await import('./lib/usage.mjs');
check(checkBudget(50, { monthly_cost: 100 }).status === 'ok', '预算 ok');
check(checkBudget(85, { monthly_cost: 100, warn_at: 0.8 }).status === 'warn', '预算 warn');
check(checkBudget(120, { monthly_cost: 100 }).status === 'exceed', '预算 exceed');
check(checkBudget(120, null).status === 'unset', '未配置预算静默');

const csvA = 'day,project,model,input,output,cache_read,cache_write,total,cost\n2026-09-26,E:/a,glm-4.7,1000,500,0,0,1500,0\n';
const csvB = 'day,project,model,input,output,cache_read,cache_write,total,cost\n2026-09-26,E:/a,glm-4.7,2000,300,0,0,2300,0\n2026-09-27,E:/b,glm-4.6,10,5,0,0,15,0\n';
const mergedCsv = mergeCsvs([csvA, csvB], usagePrice);
check(mergedCsv.split('\n')[1].startsWith('2026-09-26,E:/a,glm-4.7,3000,800,0,0,3800'), '多机合并按维度求和', mergedCsv.split('\n')[1]);
check(mergedCsv.includes('2026-09-27,E:/b,glm-4.6,10,5,0,0,15'), '多机合并保留独立维度');

const v2 = parseSessionVersioned('{"v":2,"ts":"2026-09-27T01:00:00Z","model":"glm-4.7","proj":"E:/v2","tokens":{"in":100,"out":50,"cacheR":10,"cacheW":5}}');
check(v2.ok && v2.record.total === 165 && v2.record.project === 'E:/v2', 'v2 格式解析', JSON.stringify(v2.record));
const unknown = parseSessionVersioned('{"v":99,"foo":1}');
check(unknown.ok === false || (unknown.warnings ?? []).some((w) => w.startsWith('unknown-schema:99')), '未知 schema 回退并警告', JSON.stringify(unknown.warnings ?? unknown));
const mixed = parseTextV('{"v":2,"ts":"2026-09-27T01:00:00Z","model":"m","proj":"p","tokens":{"in":1,"out":2}}\n{"timestamp":"2026-09-27T02:00:00Z","message":{"model":"m","usage":{"input_tokens":3,"output_tokens":4}}}');
check(mixed.records.length === 2 && mixed.records[1].total === 7, 'v1/v2 混合解析', JSON.stringify(mixed));

// ---------- 19. step-docker-mate（DM-100） ----------
{
  const dmDir = join(ROOT, 'plugins/step-docker-mate');
  const dmSkill = readFileSync(join(dmDir, 'skills/docker-ops/SKILL.md'), 'utf8');
  const dmDanger = extractBlock(dmSkill, 'DANGEROUS-OPS');
  check(dmDanger !== null && dmDanger.rule?.includes('绝不静默执行'), 'SKILL.md 含 DANGEROUS-OPS 确认红线');
  check(dmSkill.includes('ExitCode 137') && dmSkill.includes('port is already allocated') && dmSkill.includes('permission denied'), 'SKILL.md 含崩溃模式库（OOM/端口/权限）');

  const fake = join(ROOT, 'tests/fixtures/docker-fake/fake-docker.mjs');
  const marker = join(ROOT, 'tests/fixtures/docker-fake/down-marker.tmp');
  rmSync(marker, { force: true });
  const mkEnv = (extra) => ({ ...process.env, DOCKER_MATE_FAKE: fake, DOCKER_MATE_DOWN_MARKER: marker, ...extra });
  const runMcp = (calls, env) => {
    const r = spawnSync(process.execPath, [join(dmDir, 'server/index.mjs')], {
      input: calls.join('\n') + '\n',
      encoding: 'utf8',
      timeout: 30000,
      env,
    });
    if (r.status !== 0) throw new Error(`server 退出 ${r.status}: ${r.stderr.slice(0, 300)}`);
    return (r.stdout + '\n').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  };
  const call = (id, name, args) => JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args ?? {} } });
  const baseEnv = mkEnv({});

  try {
    const msgs = runMcp(
      [
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
        call(2, 'docker_ps'),
        call(3, 'docker_inspect', { container: 'demo-web' }),
        call(4, 'docker_logs', { container: 'demo-web', tail: 200 }),
        call(5, 'compose_up', { file: 'compose.yaml' }),
        call(6, 'compose_down', { file: 'compose.yaml' }),
        call(8, 'compose_ls'),
        call(9, 'image_layers', { image: 'demo/web:latest' }),
        '',
      ],
      baseEnv,
    );
    check(msgs.find((m) => m.id === 1)?.result?.serverInfo?.name === 'step-docker-mate', 'docker-mate MCP 握手');
    const psC = msgs.find((m) => m.id === 2)?.result?.structuredContent;
    check(psC?.containers?.length === 3 && psC.containers[0].state === 'exited', 'docker_ps 三容器', JSON.stringify(psC?.containers?.length));
    const ins = msgs.find((m) => m.id === 3)?.result?.structuredContent;
    check(ins?.state?.ExitCode === 137 && ins?.state?.OOMKilled === true, 'docker_inspect OOM 定位', JSON.stringify(ins?.state));
    const lg = msgs.find((m) => m.id === 4)?.result?.structuredContent;
    check(lg?.lines?.length === 200 && lg.lines.at(-1).includes('heap out of memory'), 'docker_logs 尾部截断含 FATAL', String(lg?.lines?.length));
    check(msgs.find((m) => m.id === 5)?.result?.structuredContent?.started === true, 'compose_up 启动');
    const dry = msgs.find((m) => m.id === 6)?.result?.structuredContent;
    check(dry?.dryRun === true && dry?.affected?.length === 3, 'compose_down dry-run 列出 3 资源', JSON.stringify(dry));
    check(msgs.find((m) => m.id === 8)?.result?.structuredContent?.projects?.[0]?.name === 'demo-app', 'compose_ls 项目列表');
    check(msgs.find((m) => m.id === 9)?.result?.structuredContent?.biggest?.[0]?.size === '320MB', '镜像层最大层识别');
    check(!existsSync(marker), 'G3：dry-run 未实际执行 down');

    const msgs2 = runMcp([call(1, 'compose_down', { file: 'compose.yaml', confirm: true }), ''], baseEnv);
    check(msgs2.find((m) => m.id === 1)?.result?.structuredContent?.removed === true, 'compose_down 确认后执行');
    check(existsSync(marker), 'G3：确认后 down 真实执行（fake 标记）');

    const bad = runMcp([call(1, 'docker_ps'), ''], mkEnv({ DOCKER_MATE_FAKE: '', DOCKER_MATE_BIN: 'no-such-docker-bin-xyz' }));
    const fail = bad.find((m) => m.id === 1)?.result;
    check(fail?.isError === true && fail?.content?.[0]?.text?.includes('winget install Docker'), 'G4：docker 缺失输出安装指引');
  } catch (e) {
    bad('docker-mate 冒烟', e.message);
  } finally {
    rmSync(marker, { force: true });
  }
}

// ---------- 19b. docker-mate 诊断增强与远程（DM-110/DM-130） ----------
{
  const dmDir = join(ROOT, 'plugins/step-docker-mate');
  const fake = join(ROOT, 'tests/fixtures/docker-fake/fake-docker.mjs');
  const mkEnv = (extra) => ({ ...process.env, DOCKER_MATE_FAKE: fake, ...extra });
  const runMcp = (calls, env) => {
    const r = spawnSync(process.execPath, [join(dmDir, 'server/index.mjs')], {
      input: calls.join('\n') + '\n', encoding: 'utf8', timeout: 30000, env,
    });
    if (r.status !== 0) throw new Error(`server 退出 ${r.status}: ${r.stderr.slice(0, 300)}`);
    return (r.stdout + '\n').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  };
  const call = (id, name, args) => JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args ?? {} } });
  const sc = (msgs, id) => msgs.find((m) => m.id === id)?.result?.structuredContent;

  try {
    const msgs = runMcp(
      [
        call(1, 'diagnose', { container: 'demo-web' }),
        call(2, 'diagnose', { container: 'demo-rel' }),
        call(3, 'diagnose', { container: 'demo-vol' }),
        call(4, 'docker_events', { since: '10m' }),
        '',
      ],
      mkEnv({}),
    );
    check(sc(msgs, 1)?.pattern === 'oom', '诊断：OOM 归因', JSON.stringify(sc(msgs, 1)));
    check(sc(msgs, 2)?.pattern === 'dependency-not-ready', '诊断：依赖未就绪归因', JSON.stringify(sc(msgs, 2)));
    check(sc(msgs, 3)?.pattern === 'volume-permission', '诊断：卷权限归因', JSON.stringify(sc(msgs, 3)));
    const ev = sc(msgs, 4)?.events ?? [];
    check(ev.length === 3 && ev.some((e) => e.action === 'oom' && e.actor === 'demo-web'), 'events 巡检过滤 die/oom/kill', JSON.stringify(ev));

    const { matchCrashPattern } = await import('../plugins/step-docker-mate/server/lib.mjs');
    check(
      matchCrashPattern({ ExitCode: 0, Status: 'running', OOMKilled: false }, [], 'Error: port is already allocated').id === 'port-conflict',
      '诊断：端口冲突归因（lib 级）',
    );

    const remote = runMcp([call(1, 'docker_ps'), ''], mkEnv({ DOCKER_MATE_CONTEXT: 'remote-host' }));
    check(sc(remote, 1)?.containers?.length === 3, '远程 context（DOCKER_MATE_CONTEXT）透传可用');
  } catch (e) {
    bad('docker-mate v1.1/v1.3 冒烟', e.message);
  }
}

// ---------- 19c. docker-mate 瘦身（DM-120） ----------
{
  const fake = join(ROOT, 'tests/fixtures/docker-fake/fake-docker.mjs');
  const runMcp2 = (calls, env) => {
    const r = spawnSync(process.execPath, [join(ROOT, 'plugins/step-docker-mate/server/index.mjs')], {
      input: calls.join('\n') + '\n', encoding: 'utf8', timeout: 30000, env,
    });
    if (r.status !== 0) throw new Error(`server 退出 ${r.status}: ${r.stderr.slice(0, 300)}`);
    return (r.stdout + '\n').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  };
  try {
    const msgs = runMcp2(
      [JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'slimming_plan', arguments: { image: 'demo/web:latest' } } }), ''],
      { ...process.env, DOCKER_MATE_FAKE: fake },
    );
    const plan = msgs.find((m) => m.id === 1)?.result?.structuredContent;
    check(plan?.suggestions?.length >= 2, '瘦身方案覆盖 node_modules 与 apt 层', JSON.stringify(plan?.suggestions?.length));
    check(plan?.estSavingPct > 30, `瘦身预估 >30%（实际 ${plan?.estSavingPct}%）`, String(plan?.estSavingPct));
    const ls = runMcp2([JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'compose_ls', arguments: {} } }), ''], { ...process.env, DOCKER_MATE_FAKE: fake });
    check(ls.find((m) => m.id === 1)?.result?.structuredContent?.projects?.length === 1, '多 compose 项目列表');
  } catch (e) {
    bad('docker-mate v1.2 冒烟', e.message);
  }
}

// ---------- 19d. docker-mate 健康日报（DM-130） ----------
const healthCmd = readFileSync(join(ROOT, 'plugins/step-docker-mate/commands/docker-health.md'), 'utf8');
const healthBlock = extractBlock(healthCmd, 'HEALTH-RULES');
check(healthBlock !== null && healthBlock.report === 'docs/docker-health.md' && healthBlock.exit_semantics?.docker_unavailable === '2', 'docker-health.md 含 HEALTH-RULES');
check(healthBlock?.readonly?.includes('一律禁止'), '日报模式禁危险操作');
check(healthCmd.includes('DOCKER_MATE_CONTEXT'), '日报支持远程 context');

// ---------- 20. step-ci-fixer（CF-100） ----------
{
  const cfDir = join(ROOT, 'plugins/step-ci-fixer');
  const cfManifest = JSON.parse(readFileSync(join(cfDir, 'step.plugin.json'), 'utf8'));
  check(cfManifest.provision?.requiresEnv?.includes('GITHUB_TOKEN'), 'manifest 声明 provision.requiresEnv GITHUB_TOKEN（CF-100-4）');
  const cfCmd = readFileSync(join(cfDir, 'commands/ci-fix.md'), 'utf8');
  check(cfCmd.includes('push 前必须向用户确认') && cfCmd.includes('上限 3 轮'), 'ci-fix.md 含 G3 确认与 3 轮上限');

  const fake = join(ROOT, 'tests/fixtures/gh-fake/fake-gh.mjs');
  const runMcp3 = (calls, env) => {
    const r = spawnSync(process.execPath, [join(cfDir, 'server/index.mjs')], {
      input: calls.join('\n') + '\n', encoding: 'utf8', timeout: 30000, env,
    });
    if (r.status !== 0) throw new Error(`server 退出 ${r.status}: ${r.stderr.slice(0, 300)}`);
    return (r.stdout + '\n').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  };
  const call3 = (id, name, args) => JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args ?? {} } });
  const sc3 = (msgs, id) => msgs.find((m) => m.id === id)?.result?.structuredContent;
  const goodEnv = { ...process.env, GH_FIXER_FAKE: fake, GH_FIXER_AUTH_MODE: '' };
  const { classifyFailure: classifyCore } = await import('../plugins/step-ci-fixer/server/lib.mjs');

  try {
    const msgs = runMcp3(
      [
        call3(1, 'check_gh'),
        call3(2, 'list_failed_runs'),
        call3(3, 'list_failed_runs', { workflow: 'deploy' }),
        call3(4, 'fetch_run_log', { runId: 9001, maxBytes: 16 * 1024 }),
        call3(5, 'classify_failure', { text: 'eslint --fix failed with 3 errors (ES2101)' }),
        call3(6, 'rerun_workflow', { runId: 9001 }),
        call3(7, 'run_status', { runId: 9001 }),
        call3(8, 'fetch_pr_comments', { prNumber: 42 }),
        '',
      ],
      goodEnv,
    );
    check(sc3(msgs, 1)?.available === true, 'check_gh 正常认证');
    check(sc3(msgs, 2)?.runs?.length === 2, 'list_failed_runs 两条失败 run');
    check(sc3(msgs, 3)?.runs?.every((r) => r.workflowName === 'deploy'), 'workflow 选择器过滤');
    const log = sc3(msgs, 4);
    check(log?.truncated === true && log?.bytes === 16 * 1024 && log?.text.includes('exit code 1'), 'fetch_run_log 尾部 16KB 截断', JSON.stringify({ bytes: log?.bytes }));
    check(sc3(msgs, 5)?.kind === 'lint', '失败分类：lint');
    check(sc3(msgs, 6)?.rerun === true, 'rerun_workflow 触发');
    check(sc3(msgs, 7)?.conclusion === 'failure', 'run_status 查询');
    check(sc3(msgs, 8)?.comments?.length === 2, 'PR 评论读取');

    check(classifyCore('error TS2304: Cannot find name "x"') === 'build', '失败分类：build');
    check(classifyCore('npm publish 403 Forbidden deploy') === 'deploy', '失败分类：deploy');
    check(classifyCore('random output') === 'unknown', '失败分类：unknown');

    const miss = runMcp3([call3(1, 'check_gh'), ''], { ...process.env, GH_FIXER_FAKE: '', GH_FIXER_BIN: 'no-such-gh-bin-xyz' });
    check(miss.find((m) => m.id === 1)?.result?.content?.[0]?.text?.includes('winget install GitHub.cli'), 'G4：gh 缺失安装指引');
    const noauth = runMcp3([call3(1, 'check_gh'), ''], { ...process.env, GH_FIXER_FAKE: fake, GH_FIXER_AUTH_MODE: 'none' });
    check(noauth.find((m) => m.id === 1)?.result?.content?.[0]?.text?.includes('gh auth login'), 'C4：未认证输出登录指引');
  } catch (e) {
    bad('ci-fixer 冒烟', e.message);
  }
}

// ---------- 21. ci-fixer 多平台日志适配（CF-130） ----------
{
  const { parseGitlabLog, parseJenkinsLog } = await import('./lib/ci-log.mjs');
  const gl = parseGitlabLog(readFileSync(join(ROOT, 'tests/fixtures/ci-logs/gitlab.txt'), 'utf8'));
  check(gl.platform === 'gitlab' && gl.classification === 'test', 'GitLab 日志解析与分类', JSON.stringify({ c: gl.classification }));
  check(gl.errorTail.includes('ECONNREFUSED'), 'GitLab 错误段含连接被拒', gl.errorTail);
  const jk = parseJenkinsLog(readFileSync(join(ROOT, 'tests/fixtures/ci-logs/jenkins.txt'), 'utf8'));
  check(jk.buildFailure === true && jk.failedStages.includes('Test'), 'Jenkins 失败 stage 定位', JSON.stringify(jk.failedStages));
  check(jk.classification === 'test' && jk.errorTail.includes('Expected: 3'), 'Jenkins 错误段与分类', jk.classification);
}

// ---------- 22. step-fe-kit（FK-100） ----------
{
  const fkDir = join(ROOT, 'plugins/step-fe-kit');
  const devCmd = readFileSync(join(fkDir, 'commands/dev.md'), 'utf8');
  const pubCmd = readFileSync(join(fkDir, 'commands/publish.md'), 'utf8');
  const devDetect = extractBlock(devCmd, 'DEV-DETECT');
  check(devDetect !== null && devDetect.detectors?.some((d) => d.dep === 'vite'), 'dev.md 含框架检测规则');
  const devLogRules = extractBlock(devCmd, 'DEV-LOG-RULES');
  check(devLogRules?.vite?.ready && devLogRules?.next?.ready, 'dev.md 含 vite/next 就绪解析规则');
  check(devCmd.includes('杀进程前必须确认') && devCmd.includes('start /b'), 'dev.md 含 G3 与 Windows 后台启动（C6）');
  check(pubCmd.includes('/plugin install steppage') && pubCmd.includes('外向动作'), 'publish.md 含 steppage 降级指引与 G3');

  const { parseDevLog } = await import('./lib/dev-log.mjs');
  const viteLog = '  VITE v6.0.0  ready in 432 ms\n  ➜  Local:   http://localhost:5173/';
  check(parseDevLog('vite', viteLog, devLogRules).port === 5173, 'vite 就绪与端口解析');
  const nextLog = '  ▲ Next.js 15\n  - Local:        http://localhost:3000\n  ✓ Ready in 1.2s';
  check(parseDevLog('next', nextLog, devLogRules).port === 3000, 'next 就绪与端口解析');
  check(parseDevLog('vite', 'error: listen EADDRINUSE: address already in use 0.0.0.0:5173', devLogRules).error === 'EADDRINUSE', '端口占用错误识别');
  check(parseDevLog('next', '✗ Failed to compile', devLogRules).error === 'Failed to compile', 'next 编译错误识别');
}

// ---------- 23. fe-kit 视觉验证（FK-110/120） ----------
{
  const fkSkill = readFileSync(join(ROOT, 'plugins/step-fe-kit/skills/fe-visual/SKILL.md'), 'utf8');
  const visualRules = extractBlock(fkSkill, 'VISUAL-RULES');
  check(visualRules !== null && visualRules.c5?.includes('不内联 base64'), 'fe-visual 含 VISUAL-RULES 与 C5 约定');
  check(fkSkill.includes('/plugin install playwright'), 'playwright 缺失降级指引');
  const svBlock = extractBlock(fkSkill, 'SELECTOR-VIEWPORTS');
  check(JSON.stringify(svBlock?.viewports) === JSON.stringify([375, 768, 1440]), '多视口定义 375/768/1440');

  const { renderVisualReport, viewportBatch } = await import('./lib/visual-report.mjs');
  const report = renderVisualReport({
    page: '/home',
    viewports: [{ width: 375, height: 720, before: 'docs/fe-visual/before-375.png', after: 'docs/fe-visual/after-375.png', diff: '按钮换行' }],
    consoleErrors: ['Uncaught TypeError: x is not a function'],
    responsiveIssues: ['375 视口横向溢出'],
    conclusion: '响应式问题已暴露',
  });
  check(report.includes('docs/fe-visual/before-375.png') && report.includes('Uncaught TypeError'), '报告含截图路径与控制台错误');
  const batch = viewportBatch('/home');
  check(batch.map((b) => b.width).join(',') === '375,768,1440' && batch[0].path.includes('375'), '多视口批量计划生成');
  check(viewportBatch('/home', [375], '.btn')[0].selector === '.btn', 'selector 组件级截图参数');
}

// ---------- 汇总 ----------
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
