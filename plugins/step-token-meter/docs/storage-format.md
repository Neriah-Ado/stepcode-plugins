# Step Code 会话存储格式逆向笔记（TM-100-1）

> 状态：**实机校准 pending**。本机（Windows 11，2026-09-27）未安装 Step Code，`~/.stepcode` 不存在；
> 字段语义按官方仓库（stepfun-ai/Step-Code，MIT）与同类终端 Agent（Claude Code）存储惯例推断。
> 解析层（tests/lib/usage-parse.mjs）按本文「容错策略」实现，格式变动只影响别名表。

## 1. 预期目录布局

```
~/.stepcode/
├── projects/<munged-project-path>/     # 按项目目录组织
│   └── <session-uuid>.jsonl            # 每会话一个 JSONL 文件，逐行一条事件
└── ...                                 # 其他运行时文件（不读取）
```

munged-path：项目绝对路径中的 `\ / : .` 等替换为 `-`（同类产品惯例）。

## 2. 预期记录形态（JSONL，每行一个 JSON 对象）

```json
{
  "type": "assistant",
  "timestamp": "2026-09-27T08:15:30.000Z",
  "cwd": "E:/Project/demo",
  "message": {
    "model": "glm-4.7",
    "usage": {
      "input_tokens": 12345,
      "output_tokens": 678,
      "cache_read_input_tokens": 1000,
      "cache_creation_input_tokens": 200
    }
  }
}
```

## 3. 字段别名表（解析层使用）

| 语义 | 可能的别名（按序尝试） | 缺省 |
| --- | --- | --- |
| 输入 tokens | input_tokens / inputTokens / prompt_tokens / usage.input | 0 |
| 输出 tokens | output_tokens / outputTokens / completion_tokens / usage.output | 0 |
| 缓存读 | cache_read_input_tokens / cacheReadInputTokens | 0 |
| 缓存写 | cache_creation_input_tokens / cacheCreationInputTokens | 0 |
| 模型 | message.model / model | "unknown" |
| 时间 | timestamp / ts / createdAt | null（记录计入 "unknown" 日） |
| 项目 | cwd / project / workspace | "unknown" |

## 4. 容错策略（TM-100-4，红线）

1. **只读**：解析层与命令永不写入/删除/移动 `~/.stepcode` 下任何文件。
2. 逐行独立解析：单行 JSON 损坏 → 跳过该行，警告计数 +1，不中断。
3. 未知字段一律忽略；缺失字段取缺省值（上表）。
4. 数值字段非数字 → 按 0 处理并警告；对象字段非对象 → 降级取顶层。
5. 全文件解析失败 → 返回空结果 + 警告，绝不抛错到会话。
6. 格式版本：见 `schema migration`（v1.3.0）——版本号 → 解析器映射，新格式只需加映射。

## 5. 隐私红线

统计全程**零网络请求**：不上传、不遥测；CSV/HTML 报告只落本地盘。
