---
tags: ["RLHF","训练实验","监督微调","对话模板"]
layout: doc
title: Nathan Lambert RL BOOK 学习笔记
pageClass: chapter-index
aside: false
---

# Nathan Lambert RL BOOK 学习笔记

学习 Nathan Lambert 强化学习（RL）专著的读书笔记，聚焦大模型时代的 RLHF、PPO、DPO 等核心技术。

## 阅读章节

<ChapterCards :items="[
  { label: '第 4 章', title: '对话模板与监督微调', link: '/rl-book/cha4对话模板与监督微调', description: '从对话模板与指令结构出发，理解 IFT / SFT 的数据组织与训练细节。' },
  { label: '第 5 章', title: '奖励建模', link: '/rl-book/cha5奖励建模', description: '理解 Bradley–Terry 模型，学习如何把人类偏好转化为奖励信号。' },
  { label: '第 6 章', title: '强化学习', link: '/rl-book/cha6强化学习', description: '梳理策略梯度与 RLHF 训练循环，连接奖励、策略与优化目标。' }
]" />

## 训练实践

<ChapterCards :items="[
  { label: '奖励模型实验', title: '奖励模型训练实验与分析', link: '/rl-book/奖励模型训练实验', description: '对照 bf16 与 f32 两次训练，观察损失、偏好准确率和奖励分数的变化。' },
  { label: 'GRPO 实验', title: '强化学习训练实验与分析', link: '/rl-book/cha6-experiment', description: '结合训练配置与源码，分析数据加载、rollout、策略更新和显存占用。' }
]" />
