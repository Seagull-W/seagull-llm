# Hermes、Codex 与 Antigravity 协作约定

命令在当前 checkout 根目录执行（`/home/ubuntu/seagull-llm` 仅是既有部署路径示例）。本文件维护 **Hermes（远程消息入口）→ Codex CLI（调研）→ Antigravity CLI（`agy`，写作交付）** 的串行分工、进程控制与回传边界。

## 分工原则：串行解耦、防止二次传播失真

- **Hermes（DeepSeek 消息入口与调度器）**：只做**原文透传、串行调度、产物回传、反馈转交与权限门禁**。
  - **禁止改写或扩写用户原话**，禁止替下游预设提纲、比较轴或额外写作硬约束。
  - **禁止自己重写或“润色”成稿**；发现问题时交回对应执行者处理。
  - **两个阶段都必须透传同一份用户原话**，避免 `agy` 只看到 Codex 转述而偏离原始目的。
- **阶段一 · Codex CLI（纯调研与核对）**：直接读用户原话与原始材料，只完成**选材、检索、读原文、核对关键机制与数字**（按 [.agents/skills/paper-research/SKILL.md](../.agents/skills/paper-research/SKILL.md) 第 1–2 节），产出精简、带原文定位的调研笔记 `research-notes.md`。不做 HTML 排版，不写最终长文。
- **阶段二 · Antigravity CLI（`agy`，写作与 HTML 交付）**：直接读**用户原话** + `research-notes.md`，按 [SKILL.md](../.agents/skills/paper-research/SKILL.md) 第 3–4 节完成**结构编排、精简表达、SVG 图表与独立 HTML 初稿**（`draft-v1.html`）。若笔记缺少关键事实，如实标出缺口或按定位复核原文，不编造。
- 简单任务或仅需单一工具时可按需只跑一个阶段；批量检索工具见 [skills.md](skills.md)。

## 进程与资源限制（防服务器卡死）

1. **严格串行，全局并发上限 = 1**：同一时刻**最多运行 1 个重型 CLI 进程**，禁止同时并行拉起 `codex` 和 `agy`，也禁止同时跑多个调研/写作任务。
2. **先退出再衔接**：必须等阶段一 `codex exec` 完全退出、核对退出码且 `research-notes.md` 已落盘后，再启动阶段二 `agy -p`；禁止用 `&` 后台堆叠多个 CLI，也不在 CLI 运行期间同时跑网站构建或浏览器任务。
3. **启动前检查、设超时、不留常驻**：启动前确认没有残留的 `codex` / `agy` 进程；`agy -p` 一律使用单次无头模式并加 `--print-timeout`（如 `15m`），完成后自动退出，不常驻交互 TUI。
4. **下游轻量执行**：交接任务时明确要求执行者单线程轻量运行，不无节制拉起大量子代理或常驻后台进程。

## 阶段回传与反馈

本节是交互节奏的唯一维护位置，适用于独立调研、长文及实质改写；即时答疑或小改动无需套用。

1. **默认直接出精简初稿（不强制“先报方案”）**：常规调研无需 Hermes 提前盲猜方案，串行跑完“Codex 调研 → `agy` 写作”后直接交付精简可读的初稿；仅当用户明确要求先看选材清单时，只跑阶段一并回传清单。
2. **初稿回传后等待反馈**：沿原消息渠道返回**可读正文、HTML 附件或可访问预览**（不能只发服务器路径或执行摘要），随后停在等待状态，不自动定稿、不覆盖旧版、不擅自发布。
3. **按反馈定向修订**：
   - 仅改表达、结构、篇幅或图表 → 直接把**用户反馈原话**交给 `agy` 修订（生成 `draft-v2.html`）；
   - 需补新论文或新证据 → 先串行调 Codex 补充 `research-notes.md`，退出后再调 `agy` 修订。
   - 获得用户明确授权后，再按 [发布流程](../writing/publishing.md) 上站并核验。

## 默认模型与额度记录

若用户的 prompt 未指定模型，默认采用以下已在服务器实测确认的配置：

- **阶段一 · Codex 调研默认**：**`gpt-6.2-sol`**，推理强度 **`medium`**（`-m gpt-6.2-sol -c 'model_reasoning_effort="medium"'`）。
- **阶段二 · Antigravity (`agy`) 写作默认**：**`gemini-4-neon-medium`**（`agy models` 中强度后缀直接包含在模型 ID 内；多篇复杂综述按需切 `gemini-4-neon-high`；仅做轻量改字、调样式或短笔记修订时可切 **`gemini-4-hydrogen-medium`** 节省额度）。
- **每次调用必记额度消耗**：每次 `codex exec` 或 `agy -p` 结束后，Hermes 必须运行 `scripts/log-usage.py` 将本次的 `model`、`effort`、token 消耗（input/cache/output/thinking/total）、耗时及可用额度/限流提示追加到 `.research/usage-log.jsonl`，并在向用户回传初稿或修订稿时**附上一行本轮实际消耗摘要**（未返回具体数字的字段标 `-`，严禁编造）。

## 串行委派命令与文件路径

任务目录固定在 `.research/handoffs/<唯一任务名>/`，使用 [交接模板](task-template.md) 分别写入 `task-research.md` 和 `task-write.md`。所有产物使用绝对路径并分开命名，不混用 `result.md`。

启动前可核对 `codex login status`、`agy models` 与 `agy --help`（`agy` 无头模式依赖已登录的本地凭据，首次需交互登录一次）。

```bash
project_root=/home/ubuntu/seagull-llm
task_name="example-task"
run_dir="$project_root/.research/handoffs/$task_name"
mkdir -p "$run_dir"

# 阶段一：Codex 只做调研，产出 research-notes.md（等它完全退出后再进阶段二）
codex_model="${CODEX_RESEARCH_MODEL:-gpt-6.2-sol}"
codex exec -C "$project_root" --sandbox workspace-write \
  -m "$codex_model" -c 'model_reasoning_effort="medium"' \
  -c 'web_search="live"' --json \
  --output-last-message "$run_dir/codex-last.md" - \
  < "$run_dir/task-research.md" > "$run_dir/codex-events.jsonl" 2> "$run_dir/codex-stderr.log"
codex_rc=$?
python3 "$project_root/scripts/log-usage.py" \
  --tool codex --stage research --task "$task_name" \
  --model "$codex_model" --effort medium --exit-code "$codex_rc" \
  --input "$run_dir/codex-events.jsonl"

# 确认 codex_rc=0 且 research-notes.md 已生成后，再启动阶段二：
# 阶段二：Antigravity CLI 读用户原话 + research-notes.md，产出 draft-v1.html
agy_model="${AGY_WRITE_MODEL:-gemini-4-neon-medium}"
(
  cd "$project_root" && \
  agy -p "$(cat "$run_dir/task-write.md")" \
    --model "$agy_model" \
    --mode accept-edits \
    --output-format json \
    --print-timeout 15m \
    > "$run_dir/agy-result.json" 2> "$run_dir/agy-stderr.log"
)
agy_rc=$?
python3 "$project_root/scripts/log-usage.py" \
  --tool agy --stage write --task "$task_name" \
  --model "$agy_model" --exit-code "$agy_rc" \
  --input "$run_dir/agy-result.json"
```

- 沿用现有安全沙箱配置，不修改全局设置；失败时如实报告命令、错误和已产生的消耗记录。
- 可用 `python3 scripts/log-usage.py --summary --last 10` 查看近期累计消耗。
- 命令结束后先检查退出码并打开实际生成的 `draft-v1.html` 确认完整，再连同消耗摘要一起回传用户（`codex-last.md` 和 `agy-result.json` 仅为执行返回，不能代替正文）。
- 修订轮如需续接同一会话：Codex 从 `codex-events.jsonl` 取 thread ID 恢复；`agy` 从 `agy-result.json` 取 `conversation_id` 并传 `--conversation <id>`（并发或跨任务禁用 `--continue` / `--last`）。

## 兼容边界

- 文献检索工具环境见 [skills.md](skills.md)；旧结构化 CLI 流水线见 [task-pipeline.md](../research/task-pipeline.md)。
- 无人值守定时任务仅在用户明确免除初稿反馈环节时才可自动定稿发布。
- Hermes 账户与网关状态位于 `/home/ubuntu/.hermes/`，不纳入本仓库。
