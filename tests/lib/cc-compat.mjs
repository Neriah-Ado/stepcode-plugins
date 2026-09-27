/**
 * Claude Code 插件兼容性检查与修补（MC-100-3 / MC-120 的核心，规则源自 Step Code 插件加载器源码结论）：
 *   - .claude-plugin/plugin.json 自动回退读取；name→id 归一化；skills/commands/agents/.mcp.json 目录自动发现；
 *   - 已知不兼容点：lspServers（不承载）、entry（只记录不加载）→ 剔除并标注 patched；
 *   - mcpServers 需为对象或指向文件路径的字符串。
 */
export function analyzeCcPlugin(manifest) {
  if (!manifest || typeof manifest !== 'object') return { compat: 'incompatible', reason: '清单不是 JSON 对象' };
  if (!manifest.name || typeof manifest.name !== 'string') {
    return { compat: 'incompatible', reason: '缺少 name 字段（无法归一化为 id）' };
  }
  const patches = [];
  const patched = { ...manifest };
  const SAFE_ID = /^[a-z0-9][a-z0-9._-]*$/;
  let id = manifest.id ?? manifest.name;
  if (!SAFE_ID.test(id)) {
    id = String(id).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+/, '');
    patched.id = id;
    patches.push(`name→id 归一化：${manifest.name} → ${id}`);
  }
  if ('lspServers' in patched) {
    delete patched.lspServers;
    patches.push('剔除 lspServers（Step Code 明确不承载）');
  }
  if ('entry' in patched) {
    delete patched.entry;
    patches.push('剔除 entry（当前市场门面只记录不加载）');
  }
  if (patched.mcpServers !== undefined && typeof patched.mcpServers !== 'object') {
    delete patched.mcpServers;
    patches.push('剔除非法 mcpServers（必须是对象或文件路径）');
  }
  const hasResources = ['skills', 'commands', 'agents'].some((k) => Array.isArray(patched[k]) && patched[k].length > 0) || patched.mcpServers;
  if (!hasResources) {
    return { compat: 'incompatible', reason: '无 skills/commands/agents/mcpServers 可自动发现', id, patches, patched };
  }
  return { compat: patches.length > 0 ? 'patched' : 'native', id, patches, patched };
}

// ---------- v1.3.0 索引与徽章：原生与迁移插件共存 ----------
export function buildCcIndex(entries, { includeBadges = false } = {}) {
  const lines = [
    '| 插件 | 上游仓库 | 锁定版本 | 分类 | 兼容状态 | 实测表现 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const e of entries ?? []) {
    const badge = includeBadges ? ` ![${e.stars ?? 'n/a'}★]` : '';
    lines.push(`| ${e.name}${badge} | ${e.upstream} | ${e.lockedVersion} | ${e.category} | ${e.compat} | ${e.note} |`);
  }
  return lines.join('\n') + '\n';
}
