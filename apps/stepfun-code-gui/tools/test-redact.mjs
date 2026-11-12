#!/usr/bin/env node
/**
 * Regression checks for argument redaction (extensions/redact.ts).
 *
 * Pins the two-tier key matching, the telemetry allowlist (token counts must
 * survive), value-pattern secret scrubbing, and the depth/entry/string caps.
 *
 * Usage: node tools/test-redact.mjs
 */
import { redactArgs, digestSummary, firstString } from "../extensions/redact.ts";

const checks = [];
const check = (name, passed, detail) => checks.push({ name, passed, detail });

// 1. Sensitive keys are masked.
const masked = redactArgs({ apiKey: "sk-secret", Authorization: "Bearer x", password: "p", clientSecret: "s" });
check("apiKey masked", masked.apiKey === "***", JSON.stringify(masked));
check("Authorization masked", masked.Authorization === "***");
check("password masked", masked.password === "***");
check("clientSecret masked", masked.clientSecret === "***");

// 2. Curated compound keys (no broad /key$/ that would catch metaKey).
const compounds = redactArgs({ privateKey: "-----BEGIN", sshKey: "ssh-rsa", signingKey: "k" });
check("privateKey masked", compounds.privateKey === "***");
check("sshKey masked", compounds.sshKey === "***");
check("signingKey masked", compounds.signingKey === "***");

// 3. Token COUNTS are telemetry, not secrets — must NOT be masked.
const telemetry = redactArgs({ maxTokens: 4096, totalTokens: 1500, tokenSpend: 42, inputTokens: 10, outputTokens: 20, tokenizer: "cl100k" });
check("maxTokens preserved", telemetry.maxTokens === 4096, JSON.stringify(telemetry));
check("totalTokens preserved", telemetry.totalTokens === 1500);
check("tokenSpend preserved", telemetry.tokenSpend === 42);
check("inputTokens preserved", telemetry.inputTokens === 10);
check("outputTokens preserved", telemetry.outputTokens === 20);

// 4. Weak-token false positives stay unmasked.
const benign = redactArgs({ metaKey: true, keyCode: 13, author: "ada", monkey: "x" });
check("metaKey not masked", benign.metaKey === true, JSON.stringify(benign));
check("keyCode not masked", benign.keyCode === 13);
check("author not masked", benign.author === "ada");

// 5. Value-pattern secrets under innocent keys are scrubbed.
const cmd = redactArgs({ command: "curl -H 'Authorization: Bearer sk-live-ABCDEFGHIJ1234567890' https://x" });
check("Bearer secret scrubbed in command", !String(cmd.command).includes("sk-live-ABCDEFGHIJ"), JSON.stringify(cmd));
const url = redactArgs({ url: "https://u:ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234@github.com" });
check("ghp token scrubbed in url", !String(url.url).includes("ghp_ABCDEFGHIJKLMNOP"), JSON.stringify(url));
const aws = redactArgs({ note: "key AKIAIOSFODNN7EXAMPLE here" });
check("AKIA scrubbed", !String(aws.note).includes("AKIAIOSFODNN7EXAMPLE"));

// 6. Caps: depth, entries, string length.
const deep = redactArgs({ a: { b: { c: { d: { e: "leaf" } } } } });
check("depth limit applied", JSON.stringify(deep).includes("[depth limit]"), JSON.stringify(deep));
const long = redactArgs({ s: "x".repeat(5000) });
check("string clipped", String(long.s).length < 5000 && String(long.s).includes("[+"), String(long.s).length);
const many = redactArgs(Object.fromEntries(Array.from({ length: 40 }, (_, i) => ["k" + i, i])));
check("entry limit applied", Object.keys(many).length <= 25, Object.keys(many).length);

// 7. Non-object input wraps to { value }.
check("non-object wrapped", redactArgs("hello").value === "hello");
check("null wrapped", redactArgs(null).value === null);

// 8. Helpers.
check("digestSummary normalises whitespace", digestSummary("  a   b  c ") === "a b c");
check("digestSummary caps length", digestSummary("x".repeat(500), 200).length === 200);
check("firstString picks first non-empty", firstString("", "  ", "ok", "no") === "ok");

let failed = 0;
for (const item of checks) {
	if (!item.passed) failed += 1;
	const detail = item.detail ? "  (" + String(item.detail).slice(0, 96) + ")" : "";
	console.log(`[redact] ${item.passed ? "PASS" : "FAIL"}  ${item.name}${detail}`);
}
console.log(`[redact] ${checks.length - failed}/${checks.length} checks passed`);

process.exit(failed > 0 ? 1 : 0);