/**
 * step-docker-mate MCP server 核心逻辑（DM-100-1/2/3）。
 * 包装 docker CLI（优先）而非依赖 dockerode；输出结构化 JSON；长日志尾部截断（C5）。
 * 危险操作（compose_down/rm/prune）：默认 dry-run 只列受影响资源，confirm=true 才执行（G3）。
 * 测试缝：DOCKER_MATE_FAKE 指向 fake-docker 脚本（node 执行）；DOCKER_MATE_BIN 覆盖 docker 路径。
 */
import { spawnSync } from 'node:child_process';

export const INSTALL_GUIDANCE = [
  '未检测到可用的 docker CLI。请安装/启动后重试：',
  '- Windows: Docker Desktop（https://www.docker.com/products/docker-desktop/）或 `winget install Docker.DockerDesktop`',
  '- macOS: `brew install --cask docker`；Linux: https://docs.docker.com/engine/install/',
  '安装后确认 `docker version` 可用，再重跑本工具。',
].join('\n');

export function runDocker(args, { timeoutMs = 120000, context } = {}) {
  const fullArgs = context ? ['--context', context, ...args] : args;
  if (process.env.DOCKER_MATE_FAKE) {
    const r = spawnSync(process.execPath, [process.env.DOCKER_MATE_FAKE, ...fullArgs], { encoding: 'utf8', timeout: timeoutMs });
    return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', missing: r.error ? true : r.status === null };
  }
  const bin = process.env.DOCKER_MATE_BIN || 'docker';
  const r = spawnSync(bin, fullArgs, { encoding: 'utf8', timeout: timeoutMs, shell: false });
  if (r.error || r.status === null || (r.status !== 0 && /ENOENT|not found/i.test(r.stderr ?? ''))) {
    return { code: null, stdout: '', stderr: r.stderr ?? String(r.error?.message ?? 'spawn failed'), missing: true };
  }
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', missing: false };
}

export function dockerVersion(ctx) {
  const r = runDocker(['version', '--format', '{{.Server.Version}}'], { context: ctx });
  if (r.missing) return { available: false, guidance: INSTALL_GUIDANCE };
  if (r.code !== 0) return { available: false, guidance: `docker daemon 不可用：${r.stderr.trim().slice(0, 300)}\n${INSTALL_GUIDANCE}` };
  return { available: true, version: r.stdout.trim() };
}

// docker ps --format '{{json .}}' → 每行一个 JSON
export function ps(ctx) {
  const r = runDocker(['ps', '-a', '--format', '{{json .}}'], { context: ctx });
  if (r.missing) return { error: 'docker-not-found', guidance: INSTALL_GUIDANCE };
  if (r.code !== 0) return { error: 'docker-failed', stderr: r.stderr.slice(0, 500) };
  const containers = r.stdout.split('\n').filter(Boolean).map((l) => {
    try {
      const j = JSON.parse(l);
      return { id: j.ID, name: j.Names, image: j.Image, state: j.State, status: j.Status, ports: j.Ports ?? '' };
    } catch {
      return null;
    }
  }).filter(Boolean);
  return { containers };
}

export function inspect(container, ctx) {
  const r = runDocker(['inspect', container], { context: ctx });
  if (r.missing) return { error: 'docker-not-found', guidance: INSTALL_GUIDANCE };
  if (r.code !== 0) return { error: 'not-found', stderr: r.stderr.slice(0, 300) };
  try {
    const j = JSON.parse(r.stdout)[0] ?? {};
    return {
      name: j.Name?.replace(/^\//, ''),
      image: j.Config?.Image,
      state: j.State ?? null,
      restartCount: j.RestartCount ?? 0,
      mounts: (j.Mounts ?? []).map((m) => ({ source: m.Source, dest: m.Destination })),
    };
  } catch {
    return { error: 'parse-failed' };
  }
}

// C5：日志只取尾部 maxLines（默认 200）
export function logs(container, { tail = 200, ctx } = {}) {
  const r = runDocker(['logs', '--tail', String(tail), container], { context: ctx });
  if (r.missing) return { error: 'docker-not-found', guidance: INSTALL_GUIDANCE };
  if (r.code !== 0) return { error: 'docker-failed', stderr: r.stderr.slice(0, 300) };
  const text = `${r.stdout}${r.stderr}`.split('\n');
  while (text.length > 0 && text.at(-1) === '') text.pop();
  return { container, tail, truncated: text.length >= tail, lines: text.slice(-tail) };
}

export function composeUp(file, { ctx } = {}) {
  const r = runDocker(['compose', '-f', file, 'up', '-d'], { context: ctx, timeoutMs: 300000 });
  if (r.missing) return { error: 'docker-not-found', guidance: INSTALL_GUIDANCE };
  if (r.code !== 0) return { error: 'compose-failed', stderr: r.stderr.slice(-500) };
  return { file, started: true, output: r.stdout.split('\n').slice(-20) };
}

// G3：dry-run 列出将停止/删除的资源；confirm=true 才真正 down（含 -v 需 removeVolumes）
export function composeDown(file, { confirm = false, removeVolumes = false, ctx } = {}) {
  const psR = runDocker(['compose', '-f', file, 'ps', '--format', '{{json .}}'], { context: ctx });
  const affected = psR.code === 0
    ? psR.stdout.split('\n').filter(Boolean).map((l) => {
        try {
          const j = JSON.parse(l);
          return { name: j.Name ?? j.Service, state: j.State };
        } catch {
          return null;
        }
      }).filter(Boolean)
    : [];
  if (!confirm) {
    return { file, dryRun: true, affected, message: 'dry-run：以上资源将被停止并移除。用户确认后以 confirm=true 重新调用。' };
  }
  const args = ['compose', '-f', file, 'down'];
  if (removeVolumes) args.push('-v');
  const r = runDocker(args, { context: ctx, timeoutMs: 300000 });
  if (r.missing) return { error: 'docker-not-found', guidance: INSTALL_GUIDANCE };
  if (r.code !== 0) return { error: 'compose-failed', stderr: r.stderr.slice(-500) };
  return { file, removed: true, affected, output: r.stdout.split('\n').slice(-20) };
}

export function composeLs(ctx) {
  const r = runDocker(['compose', 'ls', '--format', '{{json .}}'], { context: ctx });
  if (r.missing || r.code !== 0) return { projects: [] };
  const projects = r.stdout.split('\n').filter(Boolean).map((l) => {
    try {
      const j = JSON.parse(l);
      return { name: j.Name, status: j.Status, configs: j.Configfiles };
    } catch {
      return null;
    }
  }).filter(Boolean);
  return { projects };
}

// 镜像层分析（dive 式解读）：docker history --format json 逐层大小
export function imageLayers(image, ctx) {
  const r = runDocker(['history', '--no-trunc', '--format', '{{json .}}', image], { context: ctx });
  if (r.missing || r.code !== 0) return { error: 'docker-failed', stderr: r.stderr.slice(0, 300) };
  const layers = r.stdout.split('\n').filter(Boolean).map((l) => {
    try {
      const j = JSON.parse(l);
      return { size: j.Size, createdBy: (j.CreatedBy ?? '').slice(0, 160) };
    } catch {
      return null;
    }
  }).filter(Boolean);
  const parseSize = (s) => {
    const m = /^([\d.]+)(B|kB|MB|GB)$/.exec(String(s));
    if (!m) return 0;
    const unit = { B: 1, kB: 1e3, MB: 1e6, GB: 1e9 }[m[2]];
    return parseFloat(m[1]) * unit;
  };
  const sorted = [...layers].sort((a, b) => parseSize(b.size) - parseSize(a.size));
  return { layers, biggest: sorted.slice(0, 5) };
}
