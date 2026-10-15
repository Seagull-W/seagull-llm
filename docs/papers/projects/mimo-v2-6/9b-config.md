---
title: 小米 9B 开源复现：配置核对表
description: 按固定提交核对五个领域的资源、采样、评分和恢复参数。
tags: ["论文与项目随谈","MiMo","后训练","训练配置"]
---

# 小米 9B 开源复现：配置核对表

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

这些是固定源码版本中的 **启动器默认值**，可以被环境变量或 CLI 覆盖。它们不代表直播中 Pro/Flash 的生产配置。以实际生成的 resolved config 为最终运行依据。

版本：`XiaomiMiMo/verl` 的 `a2ad9f6160b03ff2d47e59832bfb6b289f37c917`。Code 核心文件已分别从分支与固定 SHA 再读取，内容相同。其他参数的完整原始表达式见 [启动参数 CSV](/papers/projects/mimo-v2-6/evidence/小米9B启动参数.csv)，没有执行其中的 shell 表达式。

## 1. 各领域需要独立配置

| 字段 | Code | Cyber | General | Visual | Music |
|---|---:|---:|---:|---:|---:|
| 默认训练节点×每节点卡数 | 8×8 | 8×8 | 4×8 | 8×8 | 8×8 |
| rollout TP | 2 | 2 | 4 | 4 | 4 |
| task batch 变量 | 64 | 64 | 64 | 32 | 32 |
| 每题 rollout n | 16 | 16 | 8 | 8 | 8 |
| 最大窗口 token | 262,144 | 262,144 | 262,144 | 262,144 | 116,384 |
| prompt 预算 | 16,384 | 16,384 | 49,152 | 16,384 | 16,384 |
| 最大推理 running requests | 128 | 64 | 64 | 64 | 128 |
| agent worker 变量 | 64 | 128 | 32 | 32 | 32 |
| rollout 内存比例 | 0.78 | 0.78 | 0.75 | 0.75 | 0.85 |
| save freq | 5 | 1 | 见下层脚本 | 10 | 10 |
| test freq | -1 | 999 | 见下层脚本 | 训练 -1 / 评测 1 | 10 |

逐列来源：[Code](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/train.sh)、[Cyber](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/arvo/arvo.sh)、[General](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/general/general.sh)、[Visual](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/webdev.sh)、[Music](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/music.sh)。这是源码索引，不能从默认 batch×n 直接推出真实并发或实际有效更新量。

## 2. Code 的关键参数

| 组别 | 默认设置 | 为什么要检查 |
|---|---|---|
| 任务混合 | 四个 white-box harness，step-hash，seed 20260911 | 改 seed 或选择规则会改变实验 |
| 训练量 | 200 steps，batch64，n16 | 与公开生产的 30 步/1568 prompts 不同 |
| loss | prompt-mean，group filtering，优势不按标准差归一化 | 聚合/过滤改变信号权重 |
| entropy | coefficient0，chunking 开启，chunk size16384 | 系数为 0 不意味着没有监控内存成本 |
| microbatch | 每 GPU 1，dynamic batch 开启 | token budget 与最长样本仍影响峰值 |
| 旧策略 | 阈值2，drop | 检查被丢弃的任务族与实际 staleness |
| 模型/布局 | actor TP8/PP1/CP1/EP1，共置默认 | 不能把 9B 布局当作生产架构 |
| 服务容量 | gateway8、max session2048、task CPU0.5 | session 还受 Pod quota 限制 |
| 时间预算 | 模型请求3600s、trajectory4800s、idle720s | 不同阶段超时语义不同 |
| 行为监控 | repetition detect 开，zero reward/penalty 默认关 | 检测不等于惩罚 |
| 运行 | resume 禁用，save5，默认无周期评测 | 启动成功不能证明续训或泛化收益 |

来源为上述 Code 启动器、[env](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/env.example)与 [run_train](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/code/run_train.sh)。启动器会将单轮 token/timeout/retry 写入实际 harness 配置，检查原 YAML 不足以确认最终值。

## 3. 其他领域的差异

General 必须配置 judge URL/key；默认模型名是脚本配置，不是证明生产 grader 使用同一模型。启动器将 reward 二值化阈值设为 1，开启 length penalty 与 infra sentinel；环境 setup3600s、trajectory1200s、reward timeout0 要结合实现解释。[General 启动器](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/general/general.sh)

Cyber 默认 off-policy 阈值8、drop，启用 infra 从 group 剔除；environment setup900s、trajectory28800s。与 Code 的阈值2或 General 的时间预算不通用。[Cyber 启动器](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/arvo/arvo.sh)

Visual 默认 temperature0.6/top-p0.95/top-k20，训练和评测 grader 参数分开；Music 则特意不指定这三项，以继承下层默认。给 Music 随手复制 Visual 采样参数会改变原参考实验。[Visual](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/webdev.sh)、[Music 环境](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/music.env.example)

## 4. 复现推进顺序

这是整理建议，不是已经跑过的结果：固定父仓库/submodule revision与镜像 → 获取 9B SFT 模型和目标领域数据 → 确认环境/grader 依赖 → resolved config 预检 → 参考正确答案/失败答案评分检查 → 单 group rollout 捕获 → 固定轨迹的单更新 → 保存/恢复短跑 → 小规模 benchmark → 扩并发与节点。

每一步应留下可审阅产物。数据、镜像、源码开放并不消除 GPU、Pod、grader API 和外部依赖的资源需求。
