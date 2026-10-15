---
title: DeepSWE-Preview：软件工程 Agent 的数据、RL 与评测闭环
description: 整理 R2E-Gym、GRPO++、容器调度、训练脚本与评测复现边界。
tags: ["论文与项目随谈","DeepSWE","GRPO","代码智能体"]
---

# DeepSWE-Preview：软件工程 Agent 的数据、RL 与评测闭环

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 对象、规模与版本

对象为 2025-07 发布的 DeepSWE-Preview。作者说明以已有 Qwen3-32B 为起点，约 4,500 个 R2E-Gym 任务、64 H100、六天 RL；“RL only”指该项目的训练阶段。[作者文章](https://www.together.ai/blog/deepswe) 它与 2026 年 DeepSWE benchmark 是不同对象。

本轮读取作者文章、[rLLM SWE README](https://github.com/agentica-project/rllm/tree/main/examples/swe)、[数据准备](https://github.com/agentica-project/rllm/blob/main/examples/swe/prepare_swe_data.py)、[训练脚本](https://github.com/agentica-project/rllm/blob/main/examples/swe/train_deepswe_32b.sh)及评测指南。当前 main 的版本和历史 run 需要分别记录。

## 2. 数据、环境与反馈信号

R2E-Gym 将代码任务与独立镜像连接，Agent 使用 Bash、搜索、编辑、提交工具，环境返回执行观察。作者过滤了与 SWE-Bench Verified 同仓库的训练任务；训练 reward 为受限时间内选定测试通过的 0/1 结果，训练测试限时 5 分钟，官方评测限时 30 分钟。[作者文章](https://www.together.ai/blog/deepswe)

数据准备脚本注册 R2E-Gym 子集与 SWE-Bench Verified；没有预期 train/test 时会使用首个 split。复现需检查实际数据集内容、仓库交集和版本，不能只用 split 名称证明无污染。[数据准备代码](https://github.com/agentica-project/rllm/blob/main/examples/swe/prepare_swe_data.py) 完整原始训练任务清单及每题过滤记录尚未取得。

## 3. 算法与更新配置

作者将配方称为 GRPO++，包含多轮 observation mask、clip high、无 KL/entropy loss、leave-one-out 与 compact filtering。后者屏蔽达到上下文、步数或时间边界的非正常完成轨迹；失败实验和消融有助于解释其选择。[作者文章](https://www.together.ai/blog/deepswe)

下表是 2026-10-11 当前脚本的事实，不是恢复出的 2025 原始配置。[训练脚本](https://github.com/agentica-project/rllm/blob/main/examples/swe/train_deepswe_32b.sh)

| 环节 | 当前脚本值 |
|---|---|
| 更新入口 | `rllm.trainer.verl.train_agent_ppo`；adv_estimator=`loop` |
| 批次/优化 | train batch 8、rollout n=8、LR 1e-6、micro-batch/GPU=1 |
| loss | `seq-mean-token-sum`、clip high 0.28；KL loss disabled、entropy coef=0 |
| token 边界 | prompt 4,096、response 32,768、训练 token/GPU 上限 32,000 |
| 训练资源 | 8 节点×8 GPU、Ulysses SP8、gradient checkpointing、FSDP 参数/优化器 CPU offload |
| 生成 | vLLM TP8、async mode、temperature 1、gpu_memory_utilization 0.6 |
| Agent/产物 | 50 steps、5,400s、每 10 更新保存/评测；console/W&B logger |

代码中的 KL coefficient 字段不证明已启用 KL loss；异步生成 mode 也不独自证明整个 optimizer 流水线完全异步。脚本 `total_epochs=1000` 不能当作实际运行完成长度。当前 batch8×n8 与作者原训练 64×8/512 容器说明不同。

## 4. 分布式与环境调度

GPU 训练之外还有容器供给集群。作者记录大批并发容器使 Docker API/dockerd 崩溃，随后用 Kubernetes 分摊环境执行并预置镜像；这给出了实际故障—架构调整的链条。[作者文章](https://www.together.ai/blog/deepswe)

README 的复现资源约束包括至少 64 GPU 和 512 个并发容器。训练进程、Kubernetes worker、镜像磁盘与评分任务分别需要容量规划；原始 Ray/Slurm 提交文件、GPU/CPU 节点完整拓扑和逐步利用率未核验。[README](https://github.com/agentica-project/rllm/tree/main/examples/swe)

## 5. loss、训练曲线与 benchmark

| 项目 | 已核验结果/入口 | 协议与边界 |
|---|---|---|
| SWE-Bench Verified Pass@1 | 42.2% | 单次成功率；作者报告对多次运行取平均 |
| SWE-Bench Verified Pass@16 | 71.0% | 多候选至少一个成功的口径，不能当作选中答案的成功率 |
| test-time scaling | README 为 59.2%；文章多处取约 59% | 混合 verifier 选择候选，另计测试时预算 |
| loss/reward/entropy 等序列 | [W&B 入口](https://wandb.ai/mluo/deepswe) | 当前 HTTP 重定向页面未提供可复核曲线，尚未导出数值 |
| 逐题评测日志 | [作者链接的归档](https://drive.google.com/file/d/10LIwpJeaFuiX6Y-qEG2a4a335PEuQJeS/view) | 已确认链接，本轮未完整解析归档 |

分数出处：[作者文章](https://www.together.ai/blog/deepswe)、[README](https://github.com/agentica-project/rllm/tree/main/examples/swe)。本项目仍需训练 loss、KL、gradient、截断/过滤率和 benchmark 逐步序列，不能用超参数或文章中的 reward 消融图代替原 run 的原始 loss。

评测路径为模型服务 → agent 轨迹 → patch/prediction 转换 → 官方 SWE-Bench harness → 结果日志。[评测复现指南](https://github.com/agentica-project/R2E-Gym/blob/master/reproduction/DEEPSWE_REPRODUCTION.MD) 应同时保存 context、最大步数、temperature、候选数量、verifier 和任务集版本。

## 6. 报错、失败实验与恢复

已找到 dockerd 过载、轨迹边界处理及不成功的 SFT/数据选择尝试等作者反馈入口。[作者文章](https://www.together.ai/blog/deepswe) 接下来需要原始实验 ID、失败日志和对应曲线，才能精确比较这些尝试；不将“未改善”泛化为 SFT 或某数据集普遍无效。

当前脚本保存 cadence 可见，完整恢复机制、optimizer/scheduler/RNG/环境状态的保存以及原 run 重启事件尚未核验。`save_freq=10` 不能证明每种状态都可恢复。可先固定 rollout 做代码核对，但本轮未执行 GPU 实验。

## 7. 发布、反馈与独立检索缺口

公开入口连接 [权重](https://huggingface.co/agentica-org/DeepSWE-Preview)、[数据集](https://huggingface.co/datasets/R2E-Gym/R2E-Gym-Subset)、训练与评测工程。[README](https://github.com/agentica-project/rllm/tree/main/examples/swe)

本项目继续独立追踪：W&B 的原始 run/export；评测包内逐题输出；历史训练 SHA 与环境镜像；所有 loss/稳定性曲线；Docker/Kubernetes 故障时间线；checkpoint/恢复；发布后真实样本与回归反馈。各项缺口不会因为别的项目已公开同类数据而结束检索。

返回：[项目目录](/papers/projects/coverage)、[指标证据索引](/papers/evidence/project-metrics)。
