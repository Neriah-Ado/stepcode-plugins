#!/usr/bin/env node
/**
 * /changelog 自举脚本（SC-120 / TG-100 验收：在本插件仓库自举使用）。
 *
 * 用法：node tests/bootstrap-changelog.mjs [pluginId]   （默认 step-commit）
 *
 * 用 tests/lib/semver-changelog.mjs（与 commands/changelog.md 同语义）对该插件
 * 的真实提交历史分类，生成当前版本的 CHANGELOG 节，写入该插件 CHANGELOG.md
 * （幂等：重跑替换同版本节）。validate.mjs 的自举一致性检查依赖本脚本产出。
 * 版本范围：存在 <pluginId>-v* 标签时取最近标签..HEAD；首版本取 plugins/<id>
 * 目录的全部提交。当前版本标签已存在时跳过（条目已定稿）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseCommit, formatChangelog } from './lib/semver-changelog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GIT_BIN = process.env.GIT_BIN || 'git';
const pluginId = process.argv[2] || 'step-commit';
const CHANGELOG_PATH = join(ROOT, 'plugins', pluginId, 'CHANGELOG.md');

const git = (...args) => execFileSync(GIT_BIN, args, { cwd: ROOT, encoding: 'utf8' });

const manifest = JSON.parse(readFileSync(join(ROOT, 'plugins', pluginId, 'step.plugin.json'), 'utf8'));
const version = manifest.version;
const currentTag = git('tag', '-l', `${pluginId}-v${version}`).trim();
if (currentTag) {
  console.log(`SKIP ${pluginId}（${currentTag} 已打 tag，条目已定稿）`);
  process.exit(0);
}

let raw;
let date;
const hasAnyTag = git('tag', '-l', `${pluginId}-v*`).trim() !== '';
if (hasAnyTag) {
  const lastTag = git('describe', '--tags', '--abbrev=0', '--match', `${pluginId}-v*`).trim();
  raw = git('log', `${lastTag}..HEAD`, '--pretty=%s%n%b%n---');
  date = git('log', '-1', '--pretty=%ad', '--date=short').trim();
  console.log(`range: ${lastTag}..HEAD`);
} else {
  raw = git('log', '--pretty=%s%n%b%n---', '--', `plugins/${pluginId}`);
  date = git('log', '-1', '--pretty=%ad', '--date=short', '--', `plugins/${pluginId}`).trim();
  console.log(`range: plugins/${pluginId} 全部历史（首版本）`);
}

const commits = raw
  .split('\n---\n')
  .map((block) => block.split('\n'))
  .filter((parts) => parts[0]?.trim())
  .map((parts) => parseCommit(parts[0].trim(), parts.slice(1).join('\n')));

const section = formatChangelog(version, date, commits);
console.log(`(${commits.length} commits)`);
console.log(section);

const doc = readFileSync(CHANGELOG_PATH, 'utf8');
const sectionRe = new RegExp(`## \\[${version}\\] - \\d{4}-\\d{2}-\\d{2}[\\s\\S]*?(?=\\n## \\[|\\s*$)`);
const withoutSection = doc.replace(sectionRe, '').replace(/\n{3,}/g, '\n\n');
const idx = withoutSection.indexOf('\n## [');
const head = idx === -1 ? withoutSection : withoutSection.slice(0, idx);
const rest = idx === -1 ? '' : withoutSection.slice(idx).trim();
const next = [head.trimEnd(), section, rest].filter(Boolean).join('\n\n') + '\n';
writeFileSync(CHANGELOG_PATH, next);
console.log(`\n${pluginId}/CHANGELOG.md 已更新`);
