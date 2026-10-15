---
layout: doc
title: 论文与项目随谈
description: 汇集大模型论文精读与后训练项目记录，按项目串联数据、算法、系统、指标和工程反馈。
tags: ["论文与项目随谈"]
pageClass: chapter-index
aside: false
---

# 论文与项目随谈

从论文方法到实际运行，记录大模型领域的阅读、项目实践与工程观察。原论文精读内容与后训练项目资料统一收录于此。

项目资料按 MiMo-V2.6、Miles GLM-5.2、INTELLECT-3、DeepSWE-Preview、CodeMidas 分别归档；通用工程问题放在跨项目专题中。后训练资料为截至 **2026-10-11** 的快照，每个项目独立保留证据范围与待核验项。

## 论文精读

<ChapterCards :items='[
  {
    "title": "DeepSeek-R1 技术报告阅读笔记",
    "link": "/papers/deepseek-r1/",
    "description": "理解 R1-Zero 与 R1 的训练过程，梳理 GRPO、监督微调与奖励设计。"
  },
  {
    "title": "GiGPO：面向长程智能体的分层信用分配",
    "link": "/papers/gigpo/",
    "description": "通过锚点状态分组进行回合级与步骤级优势估计。"
  },
  {
    "title": "Graph-GPO：基于状态转移图的信用分配",
    "link": "/papers/graph-gpo/",
    "description": "聚合 rollout 轨迹并按到成功状态的距离估计步骤优势。"
  }
]' />

## 项目导读与全链路对照

<ChapterCards :items='[
  {
    "title": "公开后训练项目阅读导引",
    "link": "/papers/post-training-guide",
    "description": "按项目查阅公开后训练运行、工程专题、指标与证据边界。"
  },
  {
    "title": "项目目录与全链路覆盖",
    "link": "/papers/projects/coverage",
    "description": "对照五个项目的数据、算法、系统、指标、故障与恢复证据。"
  }
]' />

## MiMo-V2.6 · 公开运行与复现

<ChapterCards :items='[
  {
    "title": "小米 MiMo-V2.6：从公开训练到上线修复",
    "link": "/papers/projects/mimo-v2-6/",
    "description": "串联 Pro/Flash 公开运行、9B 复现、看板指标、回滚与上线反馈。"
  },
  {
    "title": "MiMo 训练损失、稳定性与 benchmark",
    "link": "/papers/projects/mimo-v2-6/loss-and-metrics",
    "description": "结合 MiMo 归档联合分析 loss、梯度、KL、reward 与 benchmark。"
  },
  {
    "title": "小米 9B 开源复现：配置核对表",
    "link": "/papers/projects/mimo-v2-6/9b-config",
    "description": "按固定提交核对五个领域的资源、采样、评分和恢复参数。"
  },
  {
    "title": "小米公开看板：指标字典与数据阅读指南",
    "link": "/papers/projects/mimo-v2-6/dashboard-guide",
    "description": "说明 MiMo 原始 JSON、指标字典、CSV、缺失值和图表的统计口径。"
  }
]' />

## Miles GLM-5.2

<ChapterCards :items='[
  {
    "title": "Miles GLM-5.2：终端 Agent 的大型异步 RL 参考运行",
    "link": "/papers/projects/miles-glm-5-2/",
    "description": "整理终端环境、GRPO/TIS、Slurm/Ray、KV 与路由排错及 replay。"
  }
]' />

## INTELLECT-3

<ChapterCards :items='[
  {
    "title": "INTELLECT-3：SFT、异步 RL 与多节点工程",
    "link": "/papers/projects/intellect-3/",
    "description": "追踪两阶段 SFT、异步 RL、资源分配、评测与失败尝试。"
  }
]' />

## DeepSWE-Preview

<ChapterCards :items='[
  {
    "title": "DeepSWE-Preview：软件工程 Agent 的数据、RL 与评测闭环",
    "link": "/papers/projects/deepswe-preview/",
    "description": "整理 R2E-Gym、GRPO++、容器调度、训练脚本与评测复现边界。"
  }
]' />

## CodeMidas

<ChapterCards :items='[
  {
    "title": "CodeMidas：从源码构建环境到 MiMo-V2.5 RL 实验",
    "link": "/papers/projects/codemidas/",
    "description": "梳理任务生产、执行验证、过滤、GRPO 配置与 benchmark 协议。"
  }
]' />

## 跨项目工程专题与故障

<ChapterCards :items='[
  {
    "title": "从数据到上线：后训练的工程闭环",
    "link": "/papers/engineering/workflow",
    "description": "梳理数据、环境、采样、更新、容错、评测和上线的输入输出与验收。"
  },
  {
    "title": "数据、环境与可验证任务",
    "link": "/papers/engineering/data-and-environments",
    "description": "检查任务来源、数据切分、执行环境与 verifier 的可靠性。"
  },
  {
    "title": "奖励、优势与策略更新",
    "link": "/papers/engineering/rewards-and-algorithms",
    "description": "区分原始奖励、优势估计与策略更新，核对算法和实现边界。"
  },
  {
    "title": "异步采样与训练推理一致性",
    "link": "/papers/engineering/async-and-consistency",
    "description": "理解异步采样、行为概率、权重版本与路由一致性问题。"
  },
  {
    "title": "分布式调度、显存与端到端性能",
    "link": "/papers/engineering/distributed-performance",
    "description": "从资源预算、并行策略、权重传输与集群调度分析训练性能。"
  },
  {
    "title": "启动、观测与恢复：把训练做成可追溯的运行",
    "link": "/papers/engineering/operations-and-recovery",
    "description": "核对启动配置、运行证据、checkpoint 与采样器的恢复边界。"
  },
  {
    "title": "Benchmark、checkpoint 选择与上线反馈",
    "link": "/papers/engineering/evaluation-and-feedback",
    "description": "统一评测协议，关联 checkpoint、行为回归与上线修复记录。"
  },
  {
    "title": "实际故障与反馈手册",
    "link": "/papers/engineering/failure-handbook",
    "description": "按症状查找奖励、显存、调度、路由、恢复和容器故障的公开证据。"
  }
]' />

## 证据、指标与阅读边界

<ChapterCards :items='[
  {
    "title": "各项目 benchmark、loss 与运行指标证据索引",
    "link": "/papers/evidence/project-metrics",
    "description": "区分各项目已取得的数值、报告曲线、最终表和未取得日志。"
  },
  {
    "title": "后训练项目来源与版本定位",
    "link": "/papers/evidence/sources",
    "description": "按项目与材料类型定位作者报告、配置、看板、Issue 和固定版本。"
  },
  {
    "title": "项目证据边界与待核验项",
    "link": "/papers/evidence/gaps",
    "description": "分别列出五个项目尚缺的原始配置、日志、评测与版本证据。"
  }
]' />
