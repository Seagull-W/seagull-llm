---
title: 公开后训练项目阅读导引
description: 按项目查阅公开后训练运行、工程专题、指标与证据边界。
tags: ["论文与项目随谈","后训练","项目实践"]
---

# 公开后训练项目阅读导引

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

检索截止：2026-10-11。**每个合适的项目都是独立、同等重要的研究目标**，按数据、环境、奖励、算法、训练、分布式、监控、故障恢复、benchmark 和发布反馈的完整路径整理。来源包括作者社交帖子及回复、公开训练看板、团队公告、代码、配置、Issue、PR、评测、修复记录和报告附录。每个项目保留自己的证据与检索缺口。

## 选择一个项目开始读

| 项目 | 独立档案 |
|---|---|
| MiMo-V2.6 | [Pro/Flash 公开运行、9B 复现与上线修复](/papers/projects/mimo-v2-6/) |
| Miles GLM-5.2 | [大型异步 RL、终端环境、Slurm/Ray 与排错](/papers/projects/miles-glm-5-2/) |
| INTELLECT-3 | [SFT→RL、环境、集群、算法、loss 与评测](/papers/projects/intellect-3/) |
| DeepSWE-Preview | [R2E-Gym、GRPO++、容器调度与评测复现](/papers/projects/deepswe-preview/) |
| CodeMidas | [源码到环境的生产管线与 MiMo-V2.5 RL 实验](/papers/projects/codemidas/) |

[项目目录与全链路覆盖](/papers/projects/coverage)列出统一检查项、各项目开放程度与继续检索的问题。表格顺序不表示研究优先级；后续发现合适项目时继续独立建档。

## 从哪里开始读

| 你的目的 | 阅读入口 | 读完应能回答 |
|---|---|---|
| 先确认是不是罗福莉分享的那次训练 | [小米公开运行](/papers/projects/mimo-v2-6/) | 什么时候训练、公开了什么、发生了哪些回滚和故障？ |
| 建立完整流程 | [全链路地图](/papers/engineering/workflow) | 每一阶段输入什么、输出什么、谁负责、如何验收？ |
| 研究数据、任务和 reward | [数据与环境](/papers/engineering/data-and-environments)、[奖励与算法](/papers/engineering/rewards-and-algorithms) | 如何避免把环境失败变成错误学习信号？ |
| 研究真正的系统工程 | [异步采样](/papers/engineering/async-and-consistency)、[分布式调度](/papers/engineering/distributed-performance) | 为什么 GPU 多了仍然慢，为什么能跑却学不好？ |
| 分析 benchmark、loss 和训练稳定性 | [各项目指标证据](/papers/evidence/project-metrics)、[损失与指标](/papers/projects/mimo-v2-6/loss-and-metrics)、[评测](/papers/engineering/evaluation-and-feedback) | 哪些是原始数值、报告曲线、最终表或尚未读到的日志？ |
| 准备训练或排查事故 | [运行与恢复](/papers/engineering/operations-and-recovery)、[故障手册](/papers/engineering/failure-handbook) | 怎么缩小问题范围，恢复时需要哪些状态？ |
| 核对小米开源复现参数 | [9B 配置表](/papers/projects/mimo-v2-6/9b-config) | 五个领域的资源、采样、评分与恢复参数有什么差异？ |
| 看上线后的真实闭环 | [评测与发布反馈](/papers/engineering/evaluation-and-feedback) | checkpoint、harness、评测与 API 版本如何对应？ |
| 按项目追踪完整路径 | [独立项目目录](/papers/projects/coverage) | 每个项目的数据、算法、系统、结果和故障证据有哪些？ |
| 复核数值与证据 | [看板指标指南](/papers/projects/mimo-v2-6/dashboard-guide)、[来源索引](/papers/evidence/sources) | 每个数字的口径、出处、版本及访问限制是什么？ |

可以从任意项目档案连续阅读，也可以先读全链路地图，再按工程问题查专题。遇到具体报错时直接查故障手册。

## 当前整理到的证据

- 小米两个模型各 30 个最终保留训练步；Flash 2,062 个指标名、Pro 2,029 个。公开序列展开为 **122,730 个记录槽位**，包含原始缺失值，并非每个槽位都有观测。
- 六条公开团队公告；保存了末尾事件窗口中的回滚记录。事件窗口和 `live` 文件不是完整日志，不能据此解释全部 19 次重启。
- 三组离线评测；保留缺失步数、原始 benchmark 名称和 `avg@3` 口径。
- 小米 9B 开源复现的配置与代码，明确区别于 Pro/Flash 原始生产训练。
- Miles 的 GLM-5.2 参考运行配置、Slurm/Ray 启动、KV/routing 故障与 replay；原 loss/benchmark 序列待取得。
- INTELLECT-3 的报告全文、两阶段 SFT、RL 算法与资源分配、最终评测表及失败尝试；原曲线数值待取得。
- DeepSWE-Preview 的数据/训练/评测代码、容器事故和实验反馈；W&B 曲线及评测归档读取有缺口。
- CodeMidas 的任务生产/验证/过滤、GRPO 参数、benchmark 协议和部分精确结果；集群日志与官方生成代码待核验。
- 跨项目工程专题，以及 slime 等框架的真实 Issue、候选修复与恢复文档。

## 如何识别证据强度

| 标记 | 含义 | 可得结论 |
|---|---|---|
| 归档观测 | 看板 JSON、代码或配置直接可见 | 文件中确实存在这个值/行为；不自动证明因果 |
| 团队说明 | 官方公告、作者技术文章 | 团队公开给出的解释；未做独立集群验证 |
| 用户反馈 | Issue 内报告和复现材料 | 已有人报告此现象；不能代表所有配置 |
| 整理建议 | 由证据导出的运行方法 | 可用作实验设计；不是该团队实际操作记录 |
| 未公开/未核验 | 找不到资料或入口不可读 | 保留缺口，不补写 GPU 拓扑、日志或修复结果 |

罗福莉的 [X 原帖链接](https://x.com/_LuoFuli/status/2100296686719610932)已定位，直接访问返回 403，全文未直接核验。原帖与这次运行的对应关系有转载线索；训练本身则由[小米官方看板](https://mimo.xiaomi.com/rl/)和[官方发布](https://mimo.mi.com/docs/en-US/news/latest/v2-6)确认。现在看板已是静态归档，不能把页面上的 `live` 标签当成训练仍在进行。

没有在本机启动 GPU 训练、部署沙箱或调用评分模型。本次验证的是资料、代码可见行为、公开数值和整理文件的一致性。

## 数据文件

[小米看板归档目录](/papers/projects/mimo-v2-6/evidence/manifest.json)包含原始 JSON、SHA-256、逐步关键指标、全量指标长表、公告时间转换和离线评测 CSV。[检索记录与缺口](/papers/evidence/gaps)说明哪些方向已经找到可用证据，哪些仍缺原始日志或社交平台全文。

当前材料是截至 2026-10-11 的阶段性整理；各项目的证据缺口分别追踪。

