// R6:大屏服务安全/背压回归——renderIndex 注入转义、SSE 连接上限。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.join(HERE, "..", "plugins", "zcode-tps-monitor");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tps-r6-"));
process.env.HOME = tmp;
process.env.USERPROFILE = tmp;
delete process.env.TPS_PROVIDERS;

const { createDashboardServer, renderIndex } = await import(
  pathToFileURL(path.join(PLUGIN, "dashboard", "server-core.mjs")).href
);
const { CONFIG_FILE } = await import(
  pathToFileURL(path.join(PLUGIN, "scripts", "lib", "config.mjs")).href
);

test("renderIndex:恶意配置不得逃逸脚本标签或展开 $ 模式", () => {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  const evil = "http://x/</script><script>bad()</script>$&$'";
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ appearance: { fontUrl: evil } }));
  const html = renderIndex();
  // 注入载荷里的闭合标签必须被转义,原始注入脚本不得出现
  assert.ok(html.includes("\\u003c/script"), "闭合标签应转义为 \\u003c/script");
  assert.ok(!html.includes("<script>bad()"), "不得出现注入的脚本");
  // 提取注入的对象字面量,确认可解析且 $ 模式未被 String.replace 展开
  const m = html.match(/window\.__TPS_CONFIG__ = (.*);<\/script>/s);
  assert.ok(m, "应能提取注入配置");
  const parsed = JSON.parse(m[1]);
  assert.equal(parsed.appearance.fontUrl, evil, "配置值应无损还原");
});

// 打开一条 SSE 连接,收到响应头即 resolve(保持连接打开)
function openSse(port) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: "/api/events", method: "GET" }, (res) => {
      resolve({ req, res, status: res.statusCode });
      res.resume(); // 消费数据,避免背压
    });
    req.on("error", reject);
    req.end();
  });
}

test("SSE:连接数达上限后新连接 503,释放后恢复", async () => {
  const app = createDashboardServer({ port: 0, idleExitMin: 0, writePidFile: false });
  const { port } = await app.start();
  const conns = [];
  try {
    for (let i = 0; i < 32; i++) {
      const c = await openSse(port);
      assert.equal(c.status, 200, `连接 ${i} 应成功`);
      conns.push(c);
    }
    const overflow = await new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path: "/api/events", method: "GET" }, (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode, text }));
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(overflow.status, 503);
    // 释放一条后应可再连
    conns.pop().req.destroy();
    await new Promise((r) => setTimeout(r, 100));
    const recovered = await openSse(port);
    assert.equal(recovered.status, 200);
    conns.push(recovered);
  } finally {
    for (const c of conns) c.req.destroy();
    await app.close();
  }
});