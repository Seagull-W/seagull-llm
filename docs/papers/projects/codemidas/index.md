---
title: CodeMidas：从源码构建环境到 MiMo-V2.5 RL 实验
description: 梳理任务生产、执行验证、过滤、GRPO 配置与 benchmark 协议。
tags: ["论文与项目随谈","CodeMidas","GRPO","代码智能体"]
---

# CodeMidas：从源码构建环境到 MiMo-V2.5 RL 实验

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 对象与证据范围

2026-09-18 发布的 CodeMidas 同时包含任务生成管线和 MiMo-V2.5 RL 实验。本轮已由摘要扩展到[报告 v1 全文与 Appendix A](https://arxiv.org/html/2609.22068v1)。原始生成代码、GPU 运行日志与直播看板尚未核验。

## 2. 数据与环境路径

路径是源码功能 → 行为规格/删去实现的开发起点 → 基于原实现执行构建测试 → 环境清理与一致性检查 → rollout 后过滤。最终 5,545 题、3,185 仓库、23 语言、15 领域。任务包含容器和隐藏 verifier；后者评分时才注入。过滤检查泄漏、测试判决缺陷和求解结果退化。[报告 §3](https://arxiv.org/html/2609.22068v1)

独立复核时需要逐题 source revision、规格、镜像、隐藏测试、过滤证据和 split manifest。第三方采用 CodeMidas 名称的仓库不能自动成为官方原管线；这些执行产物本轮尚未逐题取得。

## 3. 算法与训练配置

以下按报告 Appendix A 记录，不移植 MiMo-V2.6 或 9B 配方。

| 字段 | 值 |
|---|---|
| 起点 / 算法 / reward | MiMo-V2.5 / GRPO / verifier 0 或 1 |
| batch / rollouts per task | 32 / 32 |
| advantage 标准差归一化 | disabled |
| prompt / response 上限 | 8,192 / 516,096 tokens |
| 最大 turns / staleness | 500 / 8 |
| optimizer / LR / warmup | Adam / 5e-6 / 0 |
| Adam β / ε | (0.95, 0.95) / 1e-15 |
| gradient clip / weight decay | 1 / 0 |

出处：[Appendix A](https://arxiv.org/html/2609.22068v1)。上限值不能解释为平均轨迹长度或实际每卡可承载长度。本实验另有 SFT/偏好阶段尚未核验；模型更新、并行布局、调度器、依赖版本和权重传输代码仍待核验。

## 4. loss、benchmark 与行为反馈

| benchmark | 初始 → RL 后 | 指标 |
|---|---|---|
| DeepSWE v1.1 | 10.0 → 21.7 | pass rate，+11.7 个百分点 |
| ProgramBench | 4.5 → 21.5 | Almost Solved，至少 95% 测试通过，+17.0 个百分点 |
| Terminal-Bench v2.1 | 63.7 → 72.2 | pass rate，+8.5 个百分点 |
| SWE-bench Pro / RepoZero C2Rust | 已列入五项外部评测；本轮未转录图中精确值 | 待取逐题结果与数值表 |

出处：[报告 §4](https://arxiv.org/html/2609.22068v1)。CodeMidas Val 为独立 200 题、每题 3 次尝试。报告还有验证成功率/长度、任务规模消融和行为分析；本轮未取得逐步训练 loss、KL、entropy、gradient 或图表原始 CSV。行为相关性不能直接证明训练收益的因果来源。

## 5. 故障、恢复与发布闭环

本项目目前可研究的失败反馈主要在环境质量：泄漏、测试误判、起始/参考实现执行不一致、全成功或全失败。需进一步取得 rejected-task 样本和原始审查记录。集群 OOM、通信、重启、checkpoint 恢复及上线反馈尚未核验，不补写事故或恢复步骤。

## 6. 独立检索缺口

继续追踪官方代码与数据入口、作者社交线程/回复、任务构建和筛选记录、分布式资源/配置、训练 loss 与评测原序列、checkpoint 和失败样本。论文中的参数及结果是目前一类证据，还需逐项寻找真实运行材料。

返回：[项目目录](/papers/projects/coverage)、[指标证据索引](/papers/evidence/project-metrics)。
