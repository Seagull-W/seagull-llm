# 调研入口

已有调研稿要发布到网站，按下文接入。普通笔记和新栏目的流程见[网站新增内容指南](../新增内容.md)。

## 将一篇每日调研加入网站

### 手工稿

新增顶层调研只改以下两处，路由使用 `/research/YYYY-MM-DD-slug`。

| 文件 | 要写什么 |
| --- | --- |
| `docs/research/YYYY-MM-DD-slug.md` | 元数据写 `title`、`description`、`date` 和主题 `tags`，标签包含「每日调研」或「调研」。正文保留一个一级标题，在「来源与阅读范围」二级标题下列明资料与实际阅读范围。[已发布样本](../docs/research/2026-11-02-score-centering-tim.md) |
| [目录记录](../docs/research/catalog.json) | 参照已有手工记录填写 `date`、`slug`、`route`、`title`、`description`、`source_urls`、`window_end` 和 `origin: "manual"`。标题、摘要与文章一致，截止时间带时区。同一路由只登记一次。 |

[调研侧边栏和卡片](../docs/.vitepress/research-sidebar.ts)从目录记录生成。[栏目首页](../docs/research/index.md)只维护栏目导语和卡片的展示位置。日常增稿无需编辑这两个文件。普通条目用日期作卡片标签、完整标题作侧边栏标题。其余情况按需填写：

- **导读或特殊标签**：记录中写 `"label": "导读"`。若扩充[主题导读](../docs/research/2026-11-04-daily-research-guide.md)的内容，再调整导读正文及其入口摘要。
- **标题较长**：填写 `sidebarTitle` 作为侧边栏短标题。卡片仍显示完整标题。
- **专题有子章**：在父记录的 `children` 中依阅读顺序追加 `{ "text": "子章标题", "link": "/research/日期-专题/子章" }`，创建对应 Markdown，并维护父文内的阅读链接。这些子链接会随共享侧边栏进入公开索引；Reward Hacking 的 21 个子章即采用这种方式。

### 使用已有脚本任务

固定订阅的 `run` 在生成稿件后执行 `integrate`。指定 `--task` 的任务模式将 `run` 停在本地报告，网站接入另用 `integrate`。有 `delivery` 约定时先试读并运行 `accept`；验收后修稿须重新生成、验收、接入。[工作流脚本](../scripts/research-workflow.py)与[任务分派](../scripts/research_tasks.py)负责这些阶段。

`integrate` 写本次稿件并按路由更新目录，条目按日期和 slug 倒排。重新接入同一路由会替换其正文，保留该记录的 `label`、`sidebarTitle` 和 `children`。栏目模板与侧边栏程序不会被脚本重写。接入前核对目标路由，特别是同日已有手工稿时。

### 验证与发布

在仓库根目录执行：

```sh
npm run tags
node scripts/check-research-content.mjs
npm run test:content
npm run build
node scripts/check-research-content.mjs --built
node scripts/test-content-discovery.mjs --built
```

专项检查核对顶层记录、卡片、侧边栏以及登记的子章文件与公开状态；`--built` 同时查生成的栏目页面入口。打开 `/research/`，从新卡片进入正文，再点标签、搜索一个小节并试用本页目录。学术字体子集需更新时运行 `python scripts/update-reading-font.py`，检查生成的 WOFF2 和清单。

收到推送要求后再使用 `publish` 或手工提交。自动发布允许目录文件和目录内的顶层稿件，还会检查暂存区、工作区和目标分支。若本批还含子章、字体或站点代码，按实际范围审阅并提交。推送后再验证线上路由。

## 从选题开始的调研

明确布置的主题调研可按交付目的检索、归纳和试读，普通交付直接使用 Markdown。安装了项目本地技能的环境可查阅 `.agents/skills/seagull-research/SKILL.md`。同目录的 `references/task-pipeline.md` 说明结构化任务与恢复，`references/delivery-contract.md` 说明验收，`references/daily.md` 说明固定订阅和定时运行。这些文件随本地技能安装。

本目录中的配置、JSON schema、`examples/` 和 `systemd/` 供相应脚本使用；各 VALIDATION 文件记录过去的实测情况。
