# 仓库工作入口

## 仓库与工作目录

当前目录 `/home/ubuntu/seagull-llm` 是完整 Git 仓库，命令在此执行。
`archive/` 保存历史快照与迁移素材，当前任务从下表进入。

## 任务分流

| 任务 | 入口 |
| --- | --- |
| 明确布置以某个主题为交付对象的调研 | [seagull-research](.agents/skills/seagull-research/SKILL.md) |
| 正文撰写、改写与审阅 | [写作总则与类型路由](writing/README.md) |
| 正文文件、公式、图注与组件 | [正文格式](HTML_FORMATS.md) |
| 视觉、配色与动效 | [视觉规范](VISUAL_STYLES.md) |
| 新增、导入或发布网站内容 | [发布流程](writing/publishing.md) |

分析文章、比较给定材料、核实具体结论直接处理；仅有“调查”字眼、联网检索或多项来源不触发主题调研技能。
新增或发布内容按发布入口完成整套接入。

## 三条硬约束

1. 来源：事实与结论须可追溯，证据口径按[跨类硬规则](writing/README.md#跨类硬规则)。
2. 验证：完成任务对应的检查并报告实际结果；发布检查按[发布前验证](writing/publishing.md#发布前验证)。
3. 不编造：数据、引用、命令、实验与执行结果均据实记录，未核实内容明确标注。

## 知乎 CLI

开始使用前阅读官方 `~/.codex/skills/zhihu/SKILL.md`，按其能力边界选择命令。
系统凭证库不可用，使用 `python3 scripts/zhihu-cli.py <命令与参数>` 调用已安装的 CLI。
入口仅从仓库已有 `.env` 向子进程注入 `ZHIHU_ACCESS_SECRET`；已有非空环境变量优先。
不另存密钥、不修改 PATH、不输出 `.env` 或凭证。

## Codex 与 Hermes 分工

执行与委派见 [Hermes/Codex 共用约定](hermes/README.md)。使用新增学术技能前，先读其中“技能与分工”和“本项目对上游规则的适配”；这些约定同样适用于 Codex 独立执行。
