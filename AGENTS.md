# 仓库工作指导

## 信息检索与调研

仅当用户明确布置一项以某个主题为核心的调研任务时，才使用 [seagull-research skill](.agents/skills/seagull-research/SKILL.md)。例如，“今日的调研主题是大模型推理加速，请完成调研”。措辞可以不同，判断依据是用户是否将主题调研本身作为交付任务。

用户要求分析文章、比较材料或核实具体结论时，直接处理。例如，“调查其他研究是否支持这篇文章的结论”按文章核查任务处理，可以检索并比较多项研究，无需调用调研技能。“调查”等字眼、联网检索和来源数量均不单独构成触发条件。

进入调研后，再按交付目的选择检索和归纳方式。默认直接交付 Markdown，脚本流水线按需使用；机械检查不代替实际读成稿。可读性按 [可读的调研](.agents/skills/seagull-research/references/readable-survey.md) 检查：读者是谁、从哪里起笔、一级节标题是不是判断句。数字都对但读者读不出该改什么，仍算不合格。

写作同时按 [affirmative-first-writing](.agents/skills/affirmative-first-writing/SKILL.md) 过一遍：正面写机制与事实，删掉未经请求的否定、预设反方和“不是 X 而是 Y”式对照；具体口径写成条件（“在 244 题、pass@32 下”）。事实更正、证据强度限制与安全提示照常写足，这条约束的是防御性修辞，不是准确性。任何成稿都适用，不只调研。

使用新增学术技能前，读 [Hermes/Codex 共用约定](hermes/README.md) 中的“技能与分工”和“本项目对上游规则的适配”。这些项目约定同样适用于 Codex 独立执行：scholar-deep-research 用于多文献检索，scientific-writing 用于有证据的学术写作，unslop-academic-writing 用于初稿修订；不强制三者串行、不恢复以代码评分验收内容的流程。

## 知乎 CLI

官方 `zhihu` skill 安装在用户级 `~/.codex/skills/zhihu/`。当前环境的系统凭证库不可用，使用 `python3 scripts/zhihu-cli.py <命令与参数>` 调用已安装的官方 CLI；该入口仅从仓库已有 `.env` 向 CLI 子进程注入 `ZHIHU_ACCESS_SECRET`，不另存密钥、不修改 PATH。已有非空进程环境变量优先。不要输出 `.env` 或凭证。开始使用时先阅读官方 skill，按其能力边界选择命令。

## 新增、导入或发布 docs 内容

执行前阅读 [新增内容.md](./新增内容.md)，按其中的发布流程完成整套接入；只新增 Markdown 文件不算完成。

- 每日调研写文章 `.md` 并登记 `docs/research/catalog.json`，卡片和侧边栏自动取自同一条记录。其他读者页面用相邻 `.html` 保存正文、`.md` 保存元数据和 HTML include，栏目卡片在对应的 `index.html` 维护。HTML 格式、图注与资源路径见 [HTML_FORMATS.md](./HTML_FORMATS.md)。禁止用 iframe 或运行时 HTML 注入包装文章。
- 笔记设计参考 Linux 隔离机制笔记，维护真实的导读、机制图、分节面板、对照、图注和折叠详解，不能只把 Markdown 转成 HTML。LLM 科普书当前整体撤下，源文件保留；未经用户明确要求，不恢复其构建、导航、首页、标签、搜索或翻页入口。

- 公开文章必须同步登记栏目侧边栏和栏目首页的 `ChapterCards` 卡片，保持标题、摘要和路由一致。普通栏目在 `docs/.vitepress/sidebar.ts` 登记；每日调研只在目录记录维护入口，`docs/.vitepress/research-sidebar.ts` 同时为侧边栏和栏目卡片提供数据，登记步骤见[调研指南](./research/README.md)。用户明确要求展示的文章应补齐入口，不能仅因原先未登记侧边栏就将其当作隐藏内容。
- 每篇文章设置准确的 `title`、`description` 和主题 `tags`。运行 `npm run tags` 自动补充缺失标签后，检查并修正标签；脚本不会覆盖已有标签。
- 标签索引由 `docs/.vitepress/data/tagged-pages.data.mts` 自动生成，公开范围由 `docs/.vitepress/public-content.ts` 根据侧边栏和发布状态判断。不要为了让单篇文章显示而取消公开范围过滤。
- 草稿、隐藏内容和网站维护文档不得进入公开章节卡片或标签索引；为这些页面设置 `search: false`，需要禁止搜索引擎索引时同时设置 robots `noindex`。不要把 `sidebar: false` 当作隐藏内容标记。
- 新增栏目在 `docs/.vitepress/sections.json` 维护身份、简介和默认标签，再登记顶栏导航与侧边栏路径前缀。文字栏目自动使用学术阅读版式。目录页共用 `DirectoryIntro` 和 `ChapterCards`，文章不写风格分支或动画。
- 现有栏目里的普通文章自动沿用站点视觉风格和昼夜切换。修改栏目插画、图标、配色或过渡效果时，参照 [VISUAL_STYLES.md](./VISUAL_STYLES.md) 并运行 `npm run test:styles`。
- 发布前运行 `npm run test:content`（含公开范围和公式检查）及 `npm run build`。实际验证目录卡片、侧边栏、文章标签跳转、标签筛选和站内搜索，确认公开内容可找到、内部内容不可找到。

正文写作遵循对应栏目的规范；LLM 科普书新版内容优先依据 [LLM_BOOK_PLAN.md](./LLM_BOOK_PLAN.md)。

## 工作目录与 Hermes

当前目录就是完整 Git 仓库，命令在此执行。Hermes 入口见 [hermes/README.md](hermes/README.md)。`archive/` 保存历史快照与运行资料，不作为当前源码或指令入口。
