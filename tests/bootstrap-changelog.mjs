#!/usr/bin/env node
/**
 * step-commit /changelog 自举脚本（SC-120 验收：在本插件仓库自举使用）。
 *
 * 用 tests/lib/semver-changelog.mjs（与 commands/changelog.md 同语义）对
 * `<最近插件 tag>..HEAD` 的真实提交历史分类，生成当前版本的 CHANGELOG 节，
 * 写入 plugins/step-commit/CHANGELOG.md（幂等：重跑替换同版本节）。
 * validate.mjs 的自举一致性检查依赖本脚本产出的文本与库输出完全一致。
 *
 * 运行：node tests/bootstrap-changelog.mjs   （GIT_BIN 可指定 git 路径）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseCommit, formatChangelog } from './lib/semver-changelog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GIT_BIN = process.env.GIT_BIN || 'git';
const CHANGELOG_PATH = join(ROOT, 'plugins/step-commit/CHANGELOG.md');

const git = (...args) => execFileSync(GIT_BIN, args, { cwd: ROOT, encoding: 'utf8' });

const manifest = JSON.parse(readFileSync(join(ROOT, 'plugins/step-commit/step.plugin.json'), 'utf8'));
const version = manifest.version;
const lastTag = git('describe', '--tags', '--abbrev=0', '--match', 'step-commit-v*').trim();
const date = git('log', '-1', '--pretty=%ad', '--date=short').trim();

const raw = git('log', `${lastTag}..HEAD`, '--pretty=%s%n%b%n---');
const commits = raw
  .split('\n---\n')
  .map((block) => block.split('\n'))
  .filter((parts) => parts[0]?.trim())
  .map((parts) => parseCommit(parts[0].trim(), parts.slice(1).join('\n')));

const section = formatChangelog(version, date, commits);
console.log(`range: ${lastTag}..HEAD (${commits.length} commits)`);
console.log(section);

const doc = readFileSync(CHANGELOG_PATH, 'utf8');
const sectionRe = new RegExp(`## \\[${version}\\] - \\d{4}-\\d{2}-\\d{2}[\\s\\S]*?(?=\\n## \\[|\\s*$)`);
const withoutSection = doc.replace(sectionRe, '').replace(/\n{3,}/g, '\n\n');
const idx = withoutSection.indexOf('\n## [');
const head = idx === -1 ? withoutSection : withoutSection.slice(0, idx);
const rest = idx === -1 ? '' : withoutSection.slice(idx).trim();
const next = [head.trimEnd(), section, rest].filter(Boolean).join('\n\n') + '\n';
writeFileSync(CHANGELOG_PATH, next);
console.log('\nCHANGELOG.md 已更新');
