/**
 * monorepo 检测、package 归组与按 package 版本建议（SC-130-1 的可脚本化部分）。
 * 语义与 commands/changelog.md「monorepo 模式」章节一致：
 *   - 检测：pnpm-workspace.yaml / package.json#workspaces / lerna.json；
 *   - workspace glob 只需支持 `packages/*`、`apps/*` 这类单层 `dir/*` 形态（单根工作区内按路径前缀归组，不依赖多根工作区能力）；
 *   - 归组：文件路径对 package 目录做最长前缀匹配；未命中归 `__root__`；
 *   - 每个 package 依自身提交独立建议 semver（复用 suggestBump）。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

// 展开 `base/*suffix` 形态的 glob（如 packages/*、apps/*）；返回含 package.json 的一层目录
function expandGlobs(rootDir, globs) {
  const packages = [];
  for (const glob of globs ?? []) {
    const star = glob.indexOf('*');
    if (star === -1) {
      const dir = join(rootDir, glob.replaceAll('\\', '/'));
      if (existsSync(join(dir, 'package.json'))) packages.push(normalize(rootDir, dir));
      continue;
    }
    const base = join(rootDir, glob.slice(0, star));
    const suffix = glob.slice(star + 1).replaceAll('\\', '/');
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      if (!statSync(join(base, entry)).isDirectory()) continue;
      const dir = join(base, entry, suffix);
      if (existsSync(join(dir, 'package.json'))) packages.push(normalize(rootDir, dir));
    }
  }
  return packages;
}

function normalize(rootDir, dir) {
  const rel = dir.slice(rootDir.length + 1).replaceAll('\\', '/');
  const pkg = readJson(join(dir, 'package.json'));
  return { dir: rel, name: pkg?.name ?? rel, version: pkg?.version ?? null };
}

function pnpmGlobs(rootDir) {
  const text = readFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'utf8');
  const globs = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const m = /^\s*-\s*'?([^'#\r\n]+)'?\s*$/.exec(line);
      if (m) globs.push(m[1].trim());
      else if (line.trim() && !/^\s*-/.test(line)) inPackages = false;
    }
  }
  return globs;
}

export function detectMonorepo(rootDir) {
  if (existsSync(join(rootDir, 'pnpm-workspace.yaml'))) {
    return { isMonorepo: true, workspaceFile: 'pnpm-workspace.yaml', packages: expandGlobs(rootDir, pnpmGlobs(rootDir)) };
  }
  const rootPkg = existsSync(join(rootDir, 'package.json')) ? readJson(join(rootDir, 'package.json')) : null;
  if (rootPkg?.workspaces) {
    const globs = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : (rootPkg.workspaces.packages ?? []);
    return { isMonorepo: true, workspaceFile: 'package.json#workspaces', packages: expandGlobs(rootDir, globs) };
  }
  if (existsSync(join(rootDir, 'lerna.json'))) {
    const lerna = readJson(join(rootDir, 'lerna.json'));
    const globs = lerna?.packages ?? ['packages/*'];
    return { isMonorepo: true, workspaceFile: 'lerna.json', packages: expandGlobs(rootDir, globs) };
  }
  return { isMonorepo: false, workspaceFile: null, packages: [] };
}

// 归组：path 对 package.dir（补齐尾部 /）做最长前缀匹配
export function groupPathsByPackage(paths, packages) {
  const sorted = [...packages].sort((a, b) => b.dir.length - a.dir.length);
  const groups = {};
  for (const p of paths) {
    const hit = sorted.find((pkg) => (p === pkg.dir ? true : p.startsWith(pkg.dir + '/')));
    const key = hit ? hit.name : '__root__';
    (groups[key] ??= []).push(p);
  }
  return groups;
}
