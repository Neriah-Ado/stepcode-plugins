/**
 * 多平台 CI 日志适配（CF-130-1/2 的可脚本化部分，语义与 commands/ci-fix.md 一致）：
 *   - parseGitlabLog：按 job 段（"^...$ <job> job #<n>" 行）切分，取失败 job 的错误尾部；
 *   - parseJenkinsLog：识别 stage 行与 BUILD FAILURE，取失败 stage 的 [ERROR]/FAILED 段；
 *   - 两者都只返回尾部错误段（C5），并给出 classification（复用 classifyFailure）。
 */
import { classifyFailure } from '../../plugins/step-ci-fixer/server/lib.mjs';

const tailLines = (lines, n = 30) => lines.slice(-n).join('\n');

export function parseGitlabLog(text) {
  const lines = String(text).split(/\r?\n/);
  const jobHeader = /^\$\s+(\S+)\s+job #\d+|^Running with gitlab-runner/i;
  const jobs = [];
  let current = null;
  for (const line of lines) {
    const m = jobHeader.exec(line);
    if (m) {
      current = { job: current?.job ?? 'unknown', lines: [] };
      jobs.push(current);
    }
    if (current) current.lines.push(line);
    else jobs.push({ job: 'unknown', lines: (jobs.at(0)?.lines ?? []) });
  }
  const failedJobs = jobs
    .map((j) => ({ job: j.job || 'job', errors: j.lines.filter((l) => /^ERROR:|FAILED|error:/i.test(l)) }))
    .filter((j) => j.errors.length > 0);
  const failed = failedJobs.at(0);
  const errorTail = failed ? tailLines(failed.errors, 30) : tailLines(lines);
  return { platform: 'gitlab', failedJobs: failedJobs.map((j) => j.job), errorTail, classification: classifyFailure(errorTail) };
}

export function parseJenkinsLog(text) {
  const lines = String(text).split(/\r?\n/);
  const stages = [];
  let current = { stage: 'unknown', lines: [] };
  for (const line of lines) {
    const m = /^\[Pipeline\]\s+stage\s*\(([^)]+)\)/i.exec(line) || /^\[Pipeline\]\s+\{\s*\(([^)]+)\)/i.exec(line);
    if (m) {
      stages.push(current);
      current = { stage: m[1], lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  stages.push(current);
  const failedStages = stages
    .map((s) => ({ stage: s.stage || 'unknown', errors: s.lines.filter((l) => /\[ERROR\]|FAILED|error:/i.test(l)) }))
    .filter((s) => s.errors.length > 0);
  const hasFailure = /BUILD FAILURE/i.test(text);
  const failed = failedStages.at(0);
  const errorTail = failed ? tailLines(failed.errors, 30) : tailLines(lines);
  return { platform: 'jenkins', buildFailure: hasFailure, failedStages: failedStages.map((s) => s.stage), errorTail, classification: classifyFailure(errorTail) };
}
