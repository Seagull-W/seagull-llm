# 调研入口

已有调研稿要发布到网站，按下文接入。普通笔记和新栏目的流程见[网站新增内容指南](../新增内容.md)。

## 将一篇每日调研加入网站

### 手工稿

按下表依次更新四处。路由统一使用 `/research/YYYY-MM-DD-slug`，不带文件后缀。

| 文件 | 本次更新 |
| --- | --- |
| `docs/research/YYYY-MM-DD-slug.md` | 用 Markdown 维护正文。元数据写 `title`、`description`、`date` 和主题 `tags`，标签包含「每日调研」或「调研」。正文保留一个一级标题，并在「来源与阅读范围」二级标题下列出资料、链接和实际阅读范围。可参考[已发布的精读](../docs/research/2026-11-02-score-centering-tim.md)。 |
| [目录记录](../docs/research/catalog.json) | 参照已有手工记录填写 `date`、`slug`、`route`、`title`、`description`、`source_urls`、`window_end`，并标记 `origin: "manual"`。标题、摘要与文章一致，检索截止时间带时区。同一路由只保留一条。 |
| [栏目首页](../docs/research/index.md) | 在现有 `ChapterCards` 的数组里插入或更新一张卡片。普通稿的 `label` 用日期，`link`、`title`、`description` 取自目录记录；沿用属性中 `&quot;` 等转义。保留栏目插图及导读卡的「导读」标记。 |
| [调研侧边栏](../docs/.vitepress/research-sidebar.ts) | 在「每日调研」组加入同一标题与路由，普通篇目依日期倒排。共享侧边栏已导入此文件。保留 Reward Hacking 主文下面的 21 个子章，它们靠这些嵌套链接进入站内公开索引。 |

[每日调研导读](../docs/research/2026-11-04-daily-research-guide.md) 是按主题编排的独立文章。日常新增稿只更新上表四处；扩充导读的覆盖范围时，再调整导读正文的分组、篇数、日期范围及对应入口摘要。

### 使用已有脚本任务

固定订阅的 `run` 在生成稿件后会执行 `integrate`。指定 `--task` 的任务模式将 `run` 停在本地报告，网站接入另用 `integrate`。有 `delivery` 约定的任务先读最终报告并运行 `accept`；验收后修稿，从任务源重新生成、验收再接入。具体入口见[工作流脚本](../scripts/research-workflow.py)与[任务分派](../scripts/research_tasks.py)。

当前 `integrate` 按路由更新稿件和目录，随后用扁平模板**整份重写栏目首页和调研侧边栏**。模板只生成日期卡和一级文章链接，无法表达现有栏目插图、「导读」标记和 21 个子章。已有手工稿直接走上表即可。必须用脚本接入时，在单独的干净工作区运行本地阶段，以原有两份导航为底稿，只合入本次条目，保留生成的稿件与目录记录，然后再验证。审阅导航差异可运行：

```sh
git diff -- docs/research/index.md docs/.vitepress/research-sidebar.ts
```

### 验证与发布

在仓库根目录执行以下命令。标签脚本只补缺失标签，已有标签需自行核对。

```sh
npm run tags
node scripts/check-research-content.mjs
npm run test:content
npm run build
node scripts/test-content-discovery.mjs --built
```

调研专项检查会核对目录记录、文章元数据、顶层侧栏与卡片标题/路由。导读卡标记和嵌套子章须另行检查。打开 `/research/`，从新卡片进入文章，点标签并用标题搜索。若刷新过导航，再检查导读卡及 Reward Hacking 的 21 个子章条目，从「栏目目录」试点一章。需要同步本地阅读字体的字集和篇目清单时，运行 `python scripts/update-reading-font.py`，一同检查生成的 WOFF2 和清单。

明确需要推送时，待导航合并和验证完成后再使用 `publish`。固定订阅的 `run --publish` 将整合与推送相连，会跳过这次人工合并。自动发布只接收目录记录中的主稿和三个目录/导航文件，还会检查工作区、暂存区及目标分支。若同批含字体或子章改动，应按实际范围审阅提交。推送完成后，待站点部署结束再打开线上路由验证。

## 从选题开始的调研

明确布置的主题调研可按交付目的检索、归纳和试读，普通交付直接使用 Markdown。安装了项目本地技能的环境可查阅 `.agents/skills/seagull-research/SKILL.md`。同目录的 `references/task-pipeline.md` 说明结构化任务与恢复，`references/delivery-contract.md` 说明验收，`references/daily.md` 说明固定订阅和定时运行。这些文件随本地技能安装。

本目录中的配置、JSON schema、`examples/` 和 `systemd/` 供相应脚本使用；各 VALIDATION 文件记录过去的实测情况。
