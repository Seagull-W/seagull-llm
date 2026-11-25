# Hermes 与 Codex 协作约定

命令在当前 checkout 根目录执行（`/home/ubuntu/seagull-llm` 仅是既有部署路径示例）。本文件维护 Hermes（远程消息入口）与 Codex CLI（研究与写作执行者）的分工、交接边界与回传节奏。

## 分工原则：防止二次传播失真

- **Hermes（DeepSeek 消息入口）**：只做**原文透传、产物回传、反馈转交与权限门禁**。
  - **禁止改写或扩写用户原话**，禁止替用户补全“你应该比较哪些维度”。
  - **禁止在未读原文前替 Codex 预设提纲、章节数、比较轴或额外写作硬约束**。
  - 禁止擅自重写或“润色” Codex 产出的初稿，以免引入事实漂移；发现明显错漏时交回 Codex 修改。
- **Codex CLI（独立执行者）**：直接读用户原话与原始材料，论文与材料调研默认直接遵循 [.agents/skills/paper-research/SKILL.md](../.agents/skills/paper-research/SKILL.md)，独立完成选材、核对、结构编排、图表与交付；其他写作任务按 [AGENTS.md](../AGENTS.md) 入口执行。批量检索文献时可按需使用 [文献检索工具](skills.md)。

## 阶段回传与反馈

本节是交互节奏的唯一维护位置，适用于独立调研、长文及实质改写；即时答疑或小改动无需套用。

1. **默认直接出精简初稿（不强制“先报方案”）**
   - 常规调研无需 Hermes 先猜测并回传方案，减少一轮转述漂移；由 Codex 读完原文后直接交付精简、可读的初稿。
   - **例外**：仅当用户明确要求“先给候选清单/方案”，或任务范围明显过大、存在歧义时，先由 Codex 读材料后返回简短选材与切入点，确认后再成文。
2. **初稿回传后等待反馈**
   - 初稿完成后，沿原消息渠道返回**可读正文、HTML 附件或操作者可访问的非公开预览**（附简短说明：核心回答与待确认点），不能只发服务器路径或执行者总结。
   - **回传后必须停下等待用户反馈**，不自动定稿、不悄悄覆盖已回传版本、不擅自提交或发布。后台退出或检查通过不等于用户已批准。
   - 收到反馈后，将**用户反馈原话**转交 Codex 修订；用户明确授权后，再按 [发布流程](../writing/publishing.md) 上站并核验。

## 委派执行与文件路径

使用 [交接模板](task-template.md) 写入 `.research/handoffs/<唯一任务名>/task.md`。所有产物使用绝对路径且独立命名（如 `draft-v1.html`、`draft-v2.html`、`last-message.md`、`events.jsonl`），不混用 `result.md`，也不删除未归档的唯一交付记录。

启动前可用 `codex exec --help` 与 `codex login status` 核对环境。首次初稿轮示例：

```bash
project_root=/home/ubuntu/seagull-llm
run_dir="$project_root/.research/handoffs/example-task"
mkdir -p "$run_dir"
codex exec -C "$project_root" --sandbox workspace-write \
  -c 'web_search="live"' --json \
  --output-last-message "$run_dir/last-message.md" - \
  < "$run_dir/task.md" > "$run_dir/events.jsonl" 2> "$run_dir/stderr.log"
```

- 模型与推理强度沿用当前授权配置，不改全局配置；保留默认沙箱与审批边界，失败时如实报告错误。
- 命令结束后检查退出状态，打开实际交付文件确认内容完整后再回传用户（`last-message.md` 只是 CLI 最后一条消息，不能代替正文）。
- 修订轮如需续接同一会话，从本任务 `events.jsonl` 取准确 thread ID 恢复（并发任务禁用 `--last`），新一轮日志与成稿版本单独命名。

## 工具与兼容边界

- 文献检索工具环境见 [skills.md](skills.md)；旧结构化 CLI 流水线见 [task-pipeline.md](../research/task-pipeline.md)。
- 无人值守定时任务仅在用户明确免除初稿反馈环节时才可自动定稿发布。
- Hermes 账户与网关状态位于 `/home/ubuntu/.hermes/`，不纳入本仓库。
