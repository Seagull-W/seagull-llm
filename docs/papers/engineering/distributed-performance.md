---
title: 分布式调度、显存与端到端性能
description: 从资源预算、并行策略、权重传输与集群调度分析训练性能。
tags: ["论文与项目随谈","后训练","分布式训练","显存优化"]
---

# 分布式调度、显存与端到端性能

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 至少有三套资源预算

| 资源 | 消费者 | 常见限制 | 观测重点 |
|---|---|---|---|
| 训练 GPU | forward/backward、optimizer、checkpoint | 权重/梯度/激活、通信、保存峰值 | 每 rank 峰值、最长样本、step 分解 |
| 推理 GPU | prefill/decode、KV cache、权重切换 | 上下文、并发、缓存、路由 | TTFT、token/s、cache 命中、排队、截断 |
| CPU/环境/评分服务 | 工具、容器、测试、judge | Pod 配额、RAM、镜像、网络、API 并发 | 冷启动、评分尾延迟、infra error、清理 |

MiMo Code 的最大 session 数受 task Pod quota 限制，而不是 GPU 数。General 另需外部 judge 服务；公开运行真的因训练集群与 grader 的连接问题重启。[Code 环境](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/env.example)、[运行公告](https://mimo.xiaomi.com/rl/data.04135c89/notices.json)

因此容量规划应先构建一个完整 task 的关键路径，再扩大并发。只扩训练卡数，可能只增加等待。

## 2. 并行策略解决不同的瓶颈

| 策略 | 分割对象 | 可能改善什么 | 新成本/约束 |
|---|---|---|---|
| TP | 层内矩阵/张量 | 单层权重与计算压力 | 高频通信、模型头数/维度约束 |
| PP | 模型层 | 每 rank 层数与权重 | 流水线 bubble、末段 loss 峰值 |
| CP | 单个长序列的上下文 | 激活与长上下文压力 | 注意力通信、模型/内核支持 |
| EP | MoE 专家 | 专家权重布局与计算 | dispatch 通信、专家负载不均 |
| DP/FSDP | 样本/参数状态 | 数据吞吐或状态分片 | all-gather、reduce、组间复制 |

表格用于工程理解。EP 常与其他 mesh 共享/重组维度，不能将所有 degree 相乘视为总卡数。应保存实际 process group/rank 映射与框架约束。

prime-rl 当前 scaling 文档提供 FSDP2、EP、CP、激活重算/offload、LM head chunking 与 Slurm 布局；这些是当前实现能力，不能倒推 2025 年 INTELLECT-3 每个阶段使用相同默认值。[scaling 文档](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/scaling.md)

## 3. 同卡共置与分离部署

共置可节省常驻权重、减少部分传输需求，但训练、推理的内存切换与时间协调更复杂。分离可以持续 rollout 并同时训练，需要按采样/训练吞吐配置比例并处理权重传输。

MiMo Code 开源默认 `TRAIN_NNODES=8`、每节点 8 卡，`ROLLOUT_NNODES=0` 走 colocate；actor TP8，rollout TP2。General 和 Visual 等路径有自己的默认布局，不应一份 env 文件通用。[Code 启动器](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/train.sh)、[General 环境](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/general/general.env.example)

## 4. 显存排查必须先定位阶段

整理建议：分别测加载、prefill、decode、logprob、entropy、backward、optimizer、权重同步、checkpoint 保存的峰值。对照样本长度、token budget、expert load 与 rank 分布。

- microbatch 与 per-GPU token budget 控制计算峰值；global batch 控制一次更新的训练量，不要随意把二者都减半。
- CP 要先确认模型/内核支持；Music 开源说明将 CP 固定为 1，线性注意力的分片路径未充分验证。[Music 环境](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/music.env.example)
- entropy/logprob 可能物化 `[tokens, vocab]` 大张量，即使 entropy 系数为 0，监控计算仍可能耗显存；有实际 Issue，见故障手册。
- CPU optimizer offload 转移压力到主机 RAM；disk streaming 转移到本地盘容量与 I/O，均不是免费优化。

verl 性能文档还提示：vLLM 与 SGLang 的 GPU 内存比例参数语义不同；梯度累计减少同步可能提高内存峰值；remove-padding、chunk/recompute 应结合实际路径比较。[verl 性能文档](https://verl.readthedocs.io/en/latest/perf/perf_tuning.html)

## 5. 权重传输是训练闭环的一部分

大模型训练与推理布局通常不同。需要把 trainer shards 转成目标 rollout shards，确认接收方完整加载，再推进版本。不能仅记录发送完成。

Miles 的 P2P 方案按接收 rank 需要的分片规划传输，避免把完整模型广播到每个 rank，并用多个源 rank 并行发送；文章给出的收益依赖其模型、拓扑和链路，不是普遍保证。[P2P 工程设计](https://www.lmsys.org/blog/2026-04-29-p2p-update/)

建议保留：payload 字节、重分片时间、传输时间、推理暂停时间、量化/后处理时间、版本确认、失败重试。对低精度 rollout，还要检查训练和推理是否对同一表示计算概率。

## 6. 调度与集群启动

prime-rl 当前多节点入口通过 Slurm 生成任务布局与 rendezvous。其文档要求代码和 uv 环境放在所有节点可见的共享文件系统，以免节点使用不同依赖。[Slurm 启动说明](https://github.com/PrimeIntellect-ai/prime-rl/blob/main/docs/scaling.md#slurm)

INTELLECT-3 团队公开介绍了 Ansible、预运行 InfiniBand 检查、Slurm+Cgroup v2 清理、Lustre/NFS、DCGM+Prometheus 等组合；这是团队说明，而非本次独立测得的集群日志。[INTELLECT-3 工程说明](https://www.primeintellect.one/blog/intellect-3)

对 Ray 调度长期 pending，先检查可见资源、placement 与共置/分离配置；对 NCCL 超时，先找最早失败的 rank 和前置异常，避免把所有连带通信错误当成网络根因。后一句为诊断建议。

## 7. 性能实验怎么做才有解释力

按“trainer 固定样本 → 推理固定请求 → 环境固定任务 → 全链路”逐层做短实验，改变一个变量并保存 resolved config。记录 warmup 和稳态分开，至少检查最长样本、不同任务族、节点尾延迟与实际训练接受率。

slime 提供 rollout/train 分离调试与 trace/profiling 材料，分别定位生成、reward、model call 与内核耗时。[debug](https://github.com/THUDM/slime/blob/main/docs/en/developer_guide/debug.md)、[trace](https://github.com/THUDM/slime/blob/main/docs/en/developer_guide/trace.md)、[profiling](https://github.com/THUDM/slime/blob/main/docs/en/developer_guide/profiling.md)

最终优化目标建议写成“固定预算下的 held-out 能力改善及行为回归通过”，再用有效训练 tokens、step time 和利用率解释原因。
