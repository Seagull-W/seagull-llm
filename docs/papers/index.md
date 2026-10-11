---
tags: ["论文精读","GRPO","信用分配","推理模型"]
layout: doc
title: 论文阅读笔记
pageClass: chapter-index
aside: false
---

# 论文阅读笔记

精读大模型领域经典与前沿论文，配套图表与个人解读。

## 论文精读

<ChapterCards :items="[
  { title: 'DeepSeek-R1 技术报告阅读笔记', link: '/papers/deepseek-r1/', description: '基于 GRPO 强化学习训练的推理模型，含 R1-Zero 与 R1 两阶段详解。' },
  { title: 'GiGPO：面向长程智能体的分层信用分配', link: '/papers/gigpo/', description: '通过锚点状态分组进行回合级与步骤级优势估计。' },
  { title: 'Graph-GPO：基于状态转移图的信用分配', link: '/papers/graph-gpo/', description: '聚合 rollout 轨迹并按到成功状态的距离估计步骤优势。' }
]" />
