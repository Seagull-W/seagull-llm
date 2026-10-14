# 每日主题调研：本机验证与服务器迁移

这套流程用固定脚本采集和发布，用 Agent 生成文章。Python 端只用标准库，写作 Agent 通过 JSON 契约替换；当前支持 Codex CLI，也支持当前 Codex 聊天或其他 Agent 手动交回 JSON。

## 本机准备

需要 Python 3.10+、Node.js 24、npm、Git。独立定时运行另需已安装并登录的 Codex CLI。

```powershell
npm ci
codex login
codex login status
git ls-remote origin HEAD
```

登录由用户完成，不把登录缓存、API key 或 SSH 私钥写进仓库。当前 Codex 桌面会话可用，不代表独立 CLI 已登录。如果 npm 缓存被环境限制，可用 `npm ci --cache .research/npm-cache`。

## 指定主题与来源

编辑 `research/workflow.json`：

- `topic` 是文章主题；`slug` 是英文标识，相同主题应保持稳定。
- `keywords` 是候选材料的英文或中文筛选词；仅改主题标题不会自动翻译检索词。
- arXiv `query` 支持它的布尔查询；默认检索最近一周、最多 30 条候选。
- Hugging Face 默认读取最近 3 个日期的 Daily Papers。它是社区论文发现渠道，不覆盖整个 HF 社区的讨论。
- `max_items` 限制送给 Agent 的去重候选；关键词评分只是初筛，Agent 还需判断相关性。
- `publishing.branch/remote` 指定发布分支和 Git remote。
- `publishing.site_url` 需填写真实部署地址，包括网站 base 子路径。未配置时只能确认 GitHub 推送与 CI，不能声称网页已经上线。

来源扩展由 Agent 先选择并更新配置，再执行采集。第一版不会自行启用新域名、登录账户或收费接口。

支持的来源类型：`arxiv`、`hf-papers`、`rss`（RSS/Atom）。RSS 示例：

```json
{ "id": "research-blog", "type": "rss", "url": "https://example.com/feed.xml" }
```

X、知乎和其他需要搜索或登录的网站可先由当前 Agent 通过可用检索工具阅读，再导入已核验的资料记录。后续可新增 API/浏览器采集适配器，但应继续输出相同字段。不要用搜索结果标题代替正文证据，不绕过访问限制。

手动导入 JSON 数组格式：

```json
[
  {
    "url": "https://example.com/original-post",
    "title": "原文标题",
    "summary": "实际读取的摘录或简述，不能补造未读内容",
    "published_at": "2026-10-14T08:00:00+08:00",
    "updated_at": "2026-10-14T08:00:00+08:00",
    "authors": ["作者"],
    "reading_scope": "manual-excerpt"
  }
]
```

无可靠发布时间的记录暂不进入每日时间窗。原始资料、运行日志、锁文件保存在被 Git 忽略的 `.research/`，不会加入公开导航或搜索。

## 方式一：独立 Codex CLI，一条命令

```powershell
python scripts/research-workflow.py run
```

这会采集、生成、接入和本地构建。完成后检查文章；需自动推送时：

```powershell
python scripts/research-workflow.py run --publish
```

`--publish` 只提交调研栏目、其目录和生成的侧边栏文件。首次安装脚本及修改网站配置时，先提交这些基础文件；有其他未提交修改或已暂存文件时发布会停止，避免夹带正在编辑的内容。推送为普通 Git push，不强推。

`run --publish` 是定时执行入口。第一次上线建议先跑不带 `--publish` 的版本，确认检索范围和写作质量。

## 方式二：当前 Codex 聊天或其他 Agent

没有独立 CLI 登录时，可以分步执行：

```powershell
python scripts/research-workflow.py collect --date 2026-10-14
python scripts/research-workflow.py prompt --date 2026-10-14
```

资料包和提示词位于 `.research/runs/2026-10-14-llm-post-training-agentic-rl/`。让 Agent 阅读 `prompt.txt` 和 `research/article.schema.json`，生成同目录的 `article.json`，再执行：

```powershell
python scripts/research-workflow.py integrate --date 2026-10-14
python scripts/research-workflow.py verify --date 2026-10-14
python scripts/research-workflow.py publish --date 2026-10-14
```

`generate --runner external` 只准备提示词；外部返回 JSON 后也可用 `generate --article <文件路径>` 将其复制到当前运行目录。不要在写作后重新执行 collect：它会产生新的采集时间和资料包哈希，旧文章会被判定为过期。重新采集后应重新写作。

手动来源可在 collect 时追加：

```powershell
python scripts/research-workflow.py collect --import-items .research/manual-items.json
```

在聊天里可直接这样触发：

> 按 research/README.md 执行今天的调研。主题是大模型强化学习、后训练与 agentic RL，使用配置里的 arXiv 和 Hugging Face 来源。用当前会话生成 article.json，核验文章与入口，构建通过后推送 GitHub，报告构建状态；只有验证线上文章后才给出上线结论。

## 自动检查与结果边界

脚本校验文章是否绑定当前资料包、每段是否引用有效来源、至少引用若干条材料。正文采用纯文本结构，脚本统一添加引用，转义 HTML、Markdown 结构和 Vue 表达式。它能发现缺失或无效引用，不能自动证明一段分析被引用材料支持。

无新材料时不造文章、不推送。来源失败默认停止；仅主动添加 `--allow-partial` 才接受部分结果，文章会注明缺失来源。查询与候选数量有上限，不能宣称穷尽全部站点更新。

已接入的往期文章提供去重状态。同一日期与主题使用同一个路由，重跑更新原文章和入口。下一次采集会排除往期文章已引用的规范 URL；同一论文的新版本也会合并，因此第一版不专门报道旧论文修订。漏跑时会扩展窗口，最多回补 90 天；窗口扩展仍受候选数量上限限制。仅本地生成但尚未推送的文章也进入本地去重状态，因此失败后应优先补推该运行，不能把“本地已接入”当成“线上已发布”。

全局锁避免两个脚本运行同时修改目录。异常退出若留锁，确认没有运行进程后手工删除 `.research/workflow.lock`。当前会话分步执行时，锁只覆盖每个脚本步骤，不覆盖人工写作的间隔；不要同时启动另一份同主题流程。

执行状态可查看：

```powershell
python scripts/research-workflow.py status --date 2026-10-14
python scripts/research-workflow.py verify-site --date 2026-10-14
```

状态按 `integrated → built → pushed → site-verified` 分开记录。推送不会自动等待 GitHub CI 或托管平台部署，需查看 GitHub Actions 结果后再检查网站。`verify-site` 要求真实文章路径及当前标题出现，不能只以首页 HTTP 200 判成功。

## GitHub 构建与网站发布

`.github/workflows/site-build.yml` 在 main 推送、PR 或手动触发时执行公开范围检查、调研内容接入检查和 VitePress 构建，并保存 `website-dist` 构建产物。它验证 GitHub 构建，不自动开启 GitHub Pages，也不迁移现有托管。

若现有 Cloudflare Pages 已连接仓库，main 推送可沿用该平台的构建部署。若是直接上传模式，需要另外接入其部署凭据与固定发布动作。仅从本仓库的 wrangler 配置无法确认线上部署状态。确认实际网站地址后填写 `publishing.site_url`。

## 迁移到服务器与更换 Agent

服务器复制仓库、配置执行身份、安装 Python/Node/Git 与 Agent，再执行 `npm ci`。Agent 的唯一写作输出是 `article.schema.json` 定义的 JSON：`bundle_sha256`、文章标题/摘要、章节、段落及来源 ID。换 Agent 时保留采集器和发布器，只替换 `generate()` 中的调用，或使用外部 JSON 模式。

Codex CLI 在子进程中使用只读 sandbox，根据传入资料生成 JSON；不持有 Git 推送职责，不让来源文本执行命令。模型生成与网站发布是两个独立步骤。

Linux 直接运行同样的 Python 命令。示例 systemd 文件在 `research/systemd/`，安装前替换用户、仓库与二进制路径。服务器时区不影响 Python 日期，默认采用 UTC+8；timer 明确使用 Asia/Shanghai。

独立 CLI 需先成功登录，定时器本身不能处理交互登录。当前桌面会话执行验证不等于 CLI 定时调用已验证。其他 Agent 的模型费用、额度和权限按所选运行环境配置，不绑定某个模型或供应商。

本机 2026-10-14 实测：公开采集接口、当前 Codex 会话写作、网站接入与本地构建成功。独立 CLI 探测显示未登录；生成调用又遇到网络证书信任错误（UnknownIssuer），已终止该探测。正式定时前需由用户完成 CLI 登录并修复其网络/代理证书信任链；不要关闭证书校验。CLI 失败不会替换已生成的文章。

## 验证命令

```powershell
python scripts/test-research-workflow.py
node scripts/test-public-content.mjs
node scripts/check-research-content.mjs
npm run build
```

来源协议参考：[arXiv API](https://info.arxiv.org/help/api/user-manual.html)、[Hugging Face Hub API](https://huggingface.co/docs/hub/api)、[Codex 非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)。HF Daily Papers 格式以本次真实接口响应为依据，适配器兼容平铺和嵌套 paper 字段。
