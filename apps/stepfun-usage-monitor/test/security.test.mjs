// 桌面端安全助手单测:外链协议白名单与 HTML 转义(纯函数,无需 Electron)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeExternalUrl, escapeHtml } from "../electron/lib/security.mjs";

test("isSafeExternalUrl:仅放行 http(s)", () => {
  for (const ok of ["https://example.com", "http://127.0.0.1:8080/x", "https://github.com/a/b"]) {
    assert.equal(isSafeExternalUrl(ok), true, ok);
  }
});

test("isSafeExternalUrl:拒绝危险协议与畸形输入", () => {
  for (const bad of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,<script>",
    "search-ms:query=calc",
    "ftp://example.com",
    "not a url",
    "",
    null,
    undefined,
    42,
    {},
  ]) {
    assert.equal(isSafeExternalUrl(bad), false, String(bad));
  }
});

test("escapeHtml:转义五个特殊字符", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(escapeHtml("a & b ' c"), "a &amp; b &#39; c");
  assert.equal(escapeHtml("</script>"), "&lt;/script&gt;");
});

test("escapeHtml:非字符串先转字符串", () => {
  assert.equal(escapeHtml(123), "123");
  assert.equal(escapeHtml(null), "null");
});