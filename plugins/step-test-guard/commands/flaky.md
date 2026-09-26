---
description: 对可疑用例多轮重跑统计失败率，识别 flaky 并给出隔离方案（skip/retry/CI 分组）
argument-hint: [用例定位 运行次数，可选；如 "src/a.test.ts" 或 "tests/x.py::test_flaky 20"]
---

# /flaky — flaky 用例识别与隔离

同一用例多轮重跑，用失败率区分「真 flaky」与「稳定失败」。

## 判定规则

<!-- FLAKY-RULES-START -->
```json
{
  "default_runs": 10,
  "verdict": {
    "stable-pass": "失败率 0%（重验通过，此前失败可能由环境或脏状态引起）",
    "flaky": "失败率在 (0%, 100%) 区间 —— 结果不稳定，进入隔离流程",
    "stable-fail": "失败率 100% —— 非 flaky，转 test-fix-loop 修复闭环"
  },
  "isolation": [
    "标记 skip 并记录跟踪项（issue/TODO + 原因 + 发现日期）",
    "retry 配置：vitest retry / jest 重试机制 / pytest-rerunfailures",
    "隔离到独立 CI 分组，避免阻塞主干合流"
  ],
  "user_confirm": "打 skip/retry 标记必须经用户确认（G3），并保证不掩盖新增的真实失败"
}
```
<!-- FLAKY-RULES-END -->

## 流程

1. 解析参数：目标用例定位（文件/文件::用例）与运行次数（默认 10，超过 30 需说明 token 成本）。
2. 用**最小范围命令**重跑 N 次（vitest/jest/pytest/go/cargo 对应的单用例命令见 /test 解析规则），每轮记录 通过/失败 与输出路径（`docs/test-guard/flaky-last.log`，逐轮覆盖）。
3. 统计失败率并给出判定（上表）；flaky 时列出失败轮次的错误信息样本（最多 3 条，注意错误是否**每次相同**——相同错误倾向稳定失败）。
4. flaky 的隔离方案按上表逐项建议，**用户确认后**才实施；实施后复跑一次确认 skip/retry 生效。
5. 汇报：判定、失败率、轮次明细、隔离动作、跟踪项链接。

## 附：常见 flaky 根因清单（供归因参考）

- 时间依赖（`Date.now`、时区、sleep 阈值过紧）；
- 随机顺序/共享状态（测试间共享文件、DB、全局单例）；
- 网络/端口/外部服务偶发不可用；
- 并发资源竞争（未加锁的临时目录、缓存写冲突）；
- 浮点精度与跨平台路径分隔符（Windows 高发）。
