# step-cache-lens — 提示词缓存体检

纯声明式插件：把 dsh 生态 [dsh-cache-miss](https://github.com/wefio/dsh-cache-miss) / [dsh-cache-stabilizer](https://github.com/dongsheng123132/dsh-cache-stabilizer) 的缓存可观测能力移植到 Step Code——定位每轮首个请求的缓存重建，审计前缀稳定性并给改造草稿。纯本地零网络。

## 它解决什么

提示词缓存重建是账单里最隐蔽的浪费：换模型、改工具集、改写历史都会让整段前缀重算。本插件从本地会话记录找出重建点、归因到嫌疑变更，并按「稳定在前、易变在后」给出最小改法。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/cache-audit [会话] [--last N]` | 逐轮判定 hit/rebuild，重建点标注嫌疑前缀变更；超 200 轮落盘（C5） |
| `/cache-stabilize [会话\|AGENTS.md]` | 命中率/重发率/波动归因三指标 + 稳定化 diff 草稿（待确认，不改配置） |

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-cache-lens
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- 判定基于会话记录中的 cache_read/cache_write 字段；字段未导出时降级为手工标记法并明示局限。
- 嫌疑变更靠前后对比推断，对比不出差异就写「未见结构性变更」，不猜。
- 稳定化只产出 diff 草稿，绝不直接改写用户配置（G3）。
- 移植说明：dsh 版为宿主 UI 内联单行告警，本插件映射为命令报告形态。

## 许可证

[AGPL-3.0-only](../../LICENSE)
