# step-prompt-polish — 提示词润色

纯声明式插件：把草稿润色成结构化任务简报，把常用指令提取成可复用模板。移植自 dsh 生态 [dsh-prompt-polish](https://github.com/benrong2048-boop/dsh-prompt-polish)（★11，上游核心为 MIT 的 prompt-optimizer 移植）。

## 它解决什么

随手写的指令缺约束、缺验收标准，模型只好猜。润色把隐含期望显式化：角色、输入、约束、验收、边界五要素齐了，结果才稳定。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/polish <草稿> [--strict]` | 润色为结构化简报；模糊处提问澄清，不编造；`--strict` 只加约束不改措辞 |
| `/polish-template [--edit]` | 把常用指令提取为 `{{变量}}` 模板（写盘先 diff），版本对比 |

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-prompt-polish
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- 润色只加结构与约束，不替用户编造需求；所有新增内容来自澄清问答或显式约定。
- 上游三模板族（系统提示词/用户提示词/迭代优化）未逐一定制，统一为五要素结构简报；迭代修订模式不移植。
- 上游 token 成本如实上报不移植（声明式形态拿不到 provider 计费数据）；本插件不做任何成本声称。
- 版本链降级为模板文件 + git 历史（声明式形态边界，上游为本地版本链）。
- 模板只保证结构完整，不保证文风。
- 模板写盘先 diff 后确认（G3）。

## 许可证

[AGPL-3.0-only](../../LICENSE)
