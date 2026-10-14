# 2026-10-14 本机最小验证记录

主题：大模型强化学习、后训练与 agentic RL。

## 已完成的链路

1. 通过 Python 脚本实际访问 arXiv API 与 Hugging Face Daily Papers，检索最近一周。两类来源均成功，得到 30 条 arXiv 与 150 条 HF 候选记录，经过日期、关键词筛选和规范 URL 去重后保留 10 条。
2. 当前 Codex 会话阅读资料包，选取 6 项工作，生成绑定资料包哈希的文章 JSON。文章明确为摘要筛选，不声称全文精读或实验复现。
3. 固定脚本校验引用 ID、生成 Markdown、更新 ChapterCards、共享侧边栏与栏目导航。已有公开范围过滤保持启用。
4. 5 个 Python 测试通过，公开范围测试通过，文章接入检查通过，VitePress 生产构建通过。构建保留现有大 chunk 提示，无构建错误。
5. 浏览器实测栏目卡片可进入文章、文章标签可跳转到“每日调研”筛选结果、站内全文搜索可找到文章，内部 ADR 未出现在搜索结果。
6. 发布脚本实际推送 GitHub main。该提交的 GitHub 构建与 Cloudflare Pages 检查均成功；线上文章标题与运行标识均已核对。

## 可核验结果

- [线上文章](https://seagull-llm.pages.dev/research/2026-10-14-llm-post-training-agentic-rl)
- [栏目入口](https://seagull-llm.pages.dev/research/)
- [实现与样例提交](https://github.com/Seagull-W/seagull-llm/commit/4a6cc9f2aae8f1fea49255e96306a0841933b1e1)
- [成功的 GitHub 构建](https://github.com/Seagull-W/seagull-llm/actions/runs/38518504204)
- Cloudflare Pages 检查对应部署 ID：`63b75e43-0468-4647-ac35-1b733ee88280`，结论 `success`。
- 资料包 SHA256：`fce905f4ea1dba4af68f3f68ba4513abbbca3d1a15809171852f15683cf613e0`。

原始资料包、生成 JSON、提示词与运行日志仅保存在本机 `.research/runs/2026-10-14-llm-post-training-agentic-rl/`。公开文章保留来源与阅读范围；维护文档位于 docs 外，不进入网站卡片、标签或全文搜索。

## 尚未通过的独立验证

独立 `codex exec` 生成调用未成功：CLI 登录状态显示未登录，生成探测还遇到网络证书信任错误（UnknownIssuer），随后停止。未改动用户认证状态，未关闭 TLS 校验。

因此，本次已验证“当前本机 Codex 会话 + 可迁移脚本 → GitHub 构建 → Pages 网页”，尚不能声称“独立 CLI 每日无人值守生成”已经跑通。定时运行前，先修复 CLI 登录和证书链，再运行 `python scripts/research-workflow.py run`；成功后启用发布与调度。

X/知乎采集器和自动来源扩展决策也未在本轮验证；第一版提供 RSS/Atom 扩展和已读取资料 JSON 导入接口。
