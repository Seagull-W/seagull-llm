---
title: INTELLECT-3：SFT、异步 RL 与多节点工程
description: 追踪两阶段 SFT、异步 RL、资源分配、评测与失败尝试。
tags: ["论文与项目随谈","INTELLECT-3","监督微调","异步训练"]
---

# INTELLECT-3：SFT、异步 RL 与多节点工程

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 对象与证据版本

INTELLECT-3 是从 GLM-4.5-Air-Base 后训练的 106B-A12B MoE。团队于 2025-11-26 发布，2025-12-18 提交报告。研究对象包括模型训练、prime-rl、verifiers/环境生态和集群运维。[作者博客](https://www.primeintellect.one/blog/intellect-3)、[模型卡](https://huggingface.co/PrimeIntellect/INTELLECT-3)、[报告 v1](https://arxiv.org/html/2512.16144v1)

本轮已读取报告全文、模型卡以及当前 prime-rl 文档并保存快照。报告对应当年实验；当前 main 文档是另一个版本证据，原 run 的精确仓库 SHA 与 resolved config 尚未核验。

## 2. 数据、环境与训练阶段

实际路径为 Base → 通用推理 SFT → Agent SFT → 混合环境 RL。SFT 来源表列出 Nemotron 与 AM 蒸馏数据，以及工具/软件工程和环境生成轨迹；RL 覆盖数学、代码、科学、逻辑、研究与软件工程。环境统一连接 verifiers，代码/SWE 执行依赖沙箱；报告说明 sandbox 失败会屏蔽相应 completion。[报告 §3.1–3.3](https://arxiv.org/html/2512.16144v1)

| 阶段 | 报告中的训练参数 |
|---|---|
| 通用推理 SFT | 1 epoch、context 65k、约 33M tokens/step；Muon LR 5e-5、weight decay 0.01、300-step warmup 从 1e-8 开始；FSDP64×DP replicate8 |
| Agent SFT | 从前阶段 checkpoint 继续；2 epochs、context 98k、CP；Muon LR 5e-8、800 steps 内线性衰减 |
| RL | 256 prompts×16 rollouts、context 65,536；Muon LR 1e-6、最大 off-policy steps 8 |

出处：[报告 §3.2–3.3](https://arxiv.org/html/2512.16144v1)。这些是不同阶段的参数，不能将 SFT 的 CP/context 或 LR 拼进 RL 配方。独立偏好优化阶段本轮未核验。

环境发布为可以固定版本的 Python 模块，使 task、评分与评测实现能够单独更新。需要同时固定环境包、数据 split、工具定义和 sandbox 镜像。[作者博客](https://www.primeintellect.one/blog/intellect-3) 当前框架关于 prompt/completion、messages 和 loss mask 的接口说明见 [training](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/training.md)，其默认值不能直接套到 2025 年实验。

## 3. 算法、更新与 rollout

报告给出 RL batch 为 256 prompts×16 rollouts，context 65,536，最大 off-policy steps 为 8，Muon LR 为 1e-6。算法采用 IcePop 的 token 重要性比值双侧 mask（0.5–5）和组内去均值优势；极低 token ratio 还会触发轨迹屏蔽。在线难度筛选用于维持学习信号。[报告 §3.3](https://arxiv.org/html/2512.16144v1)

框架由 CPU orchestrator、FSDP2 trainer 与 vLLM inference 分工：环境生成/评分，orchestrator 构建批次，trainer 更新模型，推理服务接收权重。持续采样和在途更新允许轨迹跨权重版本，必须记录生成概率与版本滞后。[当前 overview](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/overview.md)、[algorithms](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/algorithms.md)

## 4. 资源、调度与性能口径

| 来源对象 | 资源说明 | 解释边界 |
|---|---|---|
| 团队训练集群 | 64 节点、512 H200；两个月含 SFT、RL 和消融 | 不是某一条 RL run 持续占满集群两个月 |
| 报告 RL 阶段 | 60 节点、480 H200：16 节点训练，44 节点 inference | 与集群总容量分别记录 |
| 报告性能 | 65,536 context 下约 1,500s/step；去掉 in-flight updates 后超过两倍 | 作者实验条件下的观测，尚无原始分项日志 |

来源：[作者博客](https://www.primeintellect.one/blog/intellect-3)、[报告 §3.3](https://arxiv.org/html/2512.16144v1)。集群使用 Ansible 硬件发现/IB 预检、Slurm+Cgroup v2 清理、Lustre 与 NVMe-backed NFS、DCGM/Prometheus 节点监控。沙箱供给与模型 GPU 调度是分别需要维护的资源层。[博客](https://www.primeintellect.one/blog/intellect-3)

当前部署和配置接口可读 [scaling](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/scaling.md)、[configuration](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/configuration.md)。它们适合查运行步骤，不能据框架“1000+ GPU”能力宣称扩大本项目实际规模。

## 5. 训练 loss 与 benchmark

报告 Figure 8 给出两阶段 SFT loss，Figure 9 给出每 15 步的推理评测，Figure 10 为算法稳定性消融。**本轮读取到图表说明与报告内容，尚未取得这些图的原始逐点序列**；没有将图像估读值包装成训练 CSV。[报告](https://arxiv.org/html/2512.16144v1)

模型卡与报告提供以下最终值；比较列是 GLM-4.5-Air 成品模型，不能当作本项目 RL 开始前的同 checkpoint 基线。

| benchmark | INTELLECT-3 | GLM-4.5-Air | 口径 |
|---|---:|---:|---|
| MATH-500 | 98.1 | 97.8 | 500 题、每题 2 次生成；规则核验 |
| AIME24 | 90.8 | 84.6 | 报告 Avg@32，每题 32 次生成的 Pass@1 平均 |
| AIME25 | 88.0 | 82.0 | 同上 |
| LiveCodeBench v6 | 69.3 | 61.5 | 454 题，Avg@2；题目时间窗 2024-08 至 2025-05 |
| GPQA | 74.4 | 73.3 | Diamond 198 题，Avg@4，答案精确匹配 |
| HLE | 14.6 | 13.3 | text-only 2,158 题，无额外工具，平均成功率 |
| MMLU-Pro | 81.9 | 73.9 | 约 12k 题，Avg@1，答案精确匹配 |

最终表来源：[模型卡](https://huggingface.co/PrimeIntellect/INTELLECT-3)，版本和协议来源：[报告 §4/Appendix A](https://arxiv.org/html/2512.16144v1)。模型卡与报告的某些**第三方比较模型**分数存在差异，不能合并为同一次 eval。模型卡也没有提供这张表的全部 request 参数或逐题输出，仍需评测 config 和样本。

## 6. 失败尝试、修复与恢复

报告记录了三类实际反馈：异步 activation offload 的 CUDA-stream 内存泄漏，改用同步实现；长上下文 CP 尝试出现精度问题而未用于生产；高 off-policy 消融中 GSPO 出现 reward/指标崩塌。这些是作者实验反馈，不是本轮集群复测结论。[报告 §2.1.6/§3.3](https://arxiv.org/html/2512.16144v1)

原始泄漏栈、失败 batch、修复 commit 和各次重启状态未取得。当前框架的 checkpoint、恢复和日志用法可查 [training](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/training.md)、[advanced](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/advanced.md)。读取当前恢复说明只能确认功能接口；还不能证明原 run 恢复了 queue、RNG、environment 与所有在途轨迹。

## 7. 发布产物与独立检索缺口

公开产物包括 [INTELLECT-3 权重](https://huggingface.co/PrimeIntellect/INTELLECT-3)、FP8 版本、prime-rl、verifiers 和 Environments Hub；服务端 tool/reasoning parser 也是复现协议的一部分。[模型卡](https://huggingface.co/PrimeIntellect/INTELLECT-3)

下一步需要：历史训练 recipe/版本；每阶段数据/环境 manifest；SFT/RL loss、reward、entropy、KL、梯度和在线评测原序列；480 卡布局下性能分解；失败与重启日志；最终 checkpoint 对应的 eval 输出和发布后回归反馈。框架的完整公开并不自动等于某次运行全部状态公开。

返回：[项目目录](/papers/projects/coverage)、[指标证据索引](/papers/evidence/project-metrics)。
