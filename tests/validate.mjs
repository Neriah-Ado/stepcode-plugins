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

// ---------- 汇总 ----------
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
