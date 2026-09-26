/**
 * flaky 用例判定（TG-130-2 的可脚本化部分）。
 * 语义与 commands/flaky.md「判定规则」一致：
 *   - 输入为逐轮是否通过（true=通过）；
 *   - 失败率 0% → stable-pass；(0%,100%) → flaky；100% → stable-fail；
 *   - 可传 runs 数校验（默认 10，>30 需说明成本）。
 */
export function analyzeFlaky(passResults, { defaultRuns = 10, maxRuns = 30 } = {}) {
  const runs = passResults.length;
  if (runs === 0) return { runs: 0, failures: 0, failRate: null, verdict: 'invalid', note: '无重跑数据' };
  const failures = passResults.filter((p) => p === false).length;
  const failRate = Math.round((failures / runs) * 1000) / 10;
  let verdict;
  if (failures === 0) verdict = 'stable-pass';
  else if (failures === runs) verdict = 'stable-fail';
  else verdict = 'flaky';
  const notes = [];
  if (runs > maxRuns) notes.push(`轮次 ${runs} 超过建议上限 ${maxRuns}，注意 token 成本`);
  if (runs < defaultRuns) notes.push(`轮次 ${runs} 少于默认 ${defaultRuns}，结论置信度有限`);
  return { runs, failures, failRate, verdict, ...(notes.length ? { notes } : {}) };
}

export function recommendedAction(verdict) {
  switch (verdict) {
    case 'stable-pass':
      return '复验通过：按环境/脏状态排查此前失败的触发条件';
    case 'flaky':
      return '进入隔离流程：skip+跟踪项 / retry 配置 / 独立 CI 分组（需用户确认）';
    case 'stable-fail':
      return '非 flaky：转 test-fix-loop 修复闭环';
    default:
      return '数据不足，请增加轮次';
  }
}
