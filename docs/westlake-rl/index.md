---
tags: ["强化学习","策略梯度","价值函数","贝尔曼方程"]
layout: doc
title: 西湖大学强化学习笔记
pageClass: chapter-index
aside: false
---

# 西湖大学强化学习笔记

学习西湖大学强化学习课程/教材的读书笔记，涵盖强化学习基础、策略梯度、Actor-Critic 等核心内容。

## 概念与算法

<ChapterCards :items="[
  { title: '随机近似', link: '/westlake-rl/随机近似/', description: 'Robbins–Monro 算法、收敛性条件等随机近似基础内容。' },
  { title: '价值函数', link: '/westlake-rl/价值函数/', description: '函数逼近、梯度下降求解价值函数与 DQN。' },
  { title: '策略梯度', link: '/westlake-rl/策略梯度/', description: '策略参数化、指标选择与 REINFORCE 算法。' },
  { title: 'TD 算法', link: '/westlake-rl/TD算法/TD', description: 'Q-learning、Sarsa、on-policy 与 off-policy。' }
]" />

## 课程讲义

<ChapterCards :items="[
  { label: '第 1–2 讲 · PDF / 5 页', title: '强化学习基本概念与贝尔曼方程', link: '/westlake-rl/强化学习基本概念与贝尔曼方程/', description: '建立强化学习的基本概念，理解贝尔曼方程。' },
  { label: '第 3 讲 · PDF / 9 页', title: '最优状态价值与贝尔曼最优方程', link: '/westlake-rl/最优状态价值与贝尔曼最优方程/', description: '从状态价值走向最优策略与最优方程。' },
  { label: '第 4 讲 · PDF / 11 页', title: '值迭代与策略迭代', link: '/westlake-rl/值迭代与策略迭代/', description: '通过迭代求解价值函数与策略。' },
  { label: '第 5 讲 · PDF / 11 页', title: '蒙特卡洛方法', link: '/westlake-rl/蒙特卡洛方法/', description: '通过采样轨迹估计价值。' },
  { label: '第 6 讲 · PDF / 13 页', title: '随机近似', link: '/westlake-rl/随机近似/课程讲义', description: '随机近似算法的课程讲义。' }
]" />

