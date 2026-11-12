// 纯函数安全助手:供 main.mjs 使用,零 Electron 依赖,可在 node --test 下独立覆盖。

// 外链只放行 http(s):file://、javascript:、data: 与自定义协议一律拒绝,
// 避免渲染层被注入后经 shell.openExternal 触发系统协议处理器(潜在命令执行)。
export function isSafeExternalUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// HTML 转义:错误页等把不可信文本插入 markup 前必须经过这里(纵深防御)。
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}