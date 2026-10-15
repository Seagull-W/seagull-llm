---
title: Miles GLM-5.2：终端 Agent 的大型异步 RL 参考运行
description: 整理终端环境、GRPO/TIS、Slurm/Ray、KV 与路由排错及 replay。
tags: ["论文与项目随谈","Miles","后训练","异步训练"]
---

# Miles GLM-5.2：终端 Agent 的大型异步 RL 参考运行

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 研究对象、规模与版本

对象是 Miles 团队公开的 GLM-5.2 744B-A40B 参考实验。2026-08-18 的[作者工程文章](https://www.lmsys.org/blog/2026-08-18-miles-v0-1/)报告 64 GB300，训练/rollout 各 32 卡，65k context、batch 64、100 rollout steps。它是具体模型上的训练实验；材料没有覆盖 GLM-5.2 基础模型自身的全部后训练。

本轮同时读取了当前 main 的 [README](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/README.md)、[Python recipe](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/run_glm5_2_744b_a40b_daytona.py)和 [Slurm launcher](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/launch_16node_slurm.sh)。抓取日及 hash 已保存，历史实验 SHA 尚未核验。文章中的推理 TP8 与当前默认 DP-attention 配置需要分别保留。

## 2. 数据 → 环境 → reward

训练任务来自 terminal-bench-2 checkout。数据生成器将任务整理为 JSONL，`metadata.task_id` 选择对应任务目录及镜像；评测需使用不相交的 held-out task set。每条 episode 在独立 Daytona sandbox 中执行终端任务，以任务的 `tests/test.sh` 评分。recipe 连接 agent function、reward hook 与 aborted-sample filter。[README](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/README.md)、[recipe](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/run_glm5_2_744b_a40b_daytona.py)

依赖需要逐层准备：Miles/SGLang 运行镜像、OpenEnv checkout 的 editable 环境包、任务定义、模型的训练分片与 FP8 推理格式、Megatron disk-streaming checkpoint hooks、Daytona 配额。原运行的数据 manifest、全部题目和过滤后样本尚未取得；本轮未核验该实验另有 SFT 或偏好训练阶段。

## 3. 算法、批次与异步采样

以下为当前 recipe 的可读默认值，不自动等于文章发表时的配置。[recipe](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/run_glm5_2_744b_a40b_daytona.py)

| 环节 | 当前代码值/行为 | 应核对的语义 |
|---|---|---|
| 优势与修正 | GRPO；TIS 区间 0–2 | 实际 mask、归约及 off-policy 修正需连同后端代码核验 |
| 采样/更新 | 8 prompts × 8 samples；global batch 64 | 与 128 条在途轨迹分开统计 |
| 正则/裁剪 | KL 系数 0、entropy 系数 0；clip 0.2/0.28 | 系数为 0 不代表没有监控或概率比值处理 |
| 优化器 | Adam，LR 1e-6，constant schedule，weight decay 0.1 | scheduler 与原 run 的 rollout 数绑定 |
| episode | 30 turns、3,600s、每轮 8,192 tokens、会话约 65k | generation、环境耗时和会话预算是不同边界 |
| 并发 | fully async；128 in-flight；sample 级释放提交槽 | 完成一条即可补入，避免等待同组最长样本 |

多轮 token 的一致性还涉及 TITO，见团队的[轨迹工程说明](https://www.lmsys.org/blog/2026-05-13-no-token-left-behind/)。使用之前需核对模板、工具输出、采样 token 与训练 token 的实际连接；本轮没有在集群运行 recipe。

## 4. 分布式布局与启动路径

当前 README 为 16 节点×4 卡：8 个训练节点采用 TP2/CP4/PP4/EP8，8 个推理节点运行 FP8 DP-attention engines。训练 DP1 的 optimizer state 未按 DP 分片，依赖 node-local disk streaming。Slurm 负责节点和容器，Ray 负责进程资源；launcher 将实验参数交给 Python recipe。[README](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/README.md)、[launcher](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/launch_16node_slurm.sh)

启动前需匹配 compute-fabric 地址、共享挂载、node-local scratch 和模型格式。launcher 明确指出：误用管理网地址可能让 Ray 启动静默卡住，worker 首次连接过早也可能失败，因此脚本会重试加入。模型预置本地磁盘用于减少 engine 重启时的 NFS 读取等待。

## 5. 训练 loss、性能与 benchmark

| 证据 | 已读到的内容 | 不能据此声称 |
|---|---|---|
| 作者文章性能 | 约 4.5 分钟 trainer step、平均 weight lag 1.7、prefix cache 约 96% | 总墙钟每步都等于 trainer 时间 |
| 当前 README 性能 | 100 rollout steps、21h；同时称约 6.5min/step 含定期 eval | 两个口径已自洽；21h÷100=12.6min，尚缺分项解释 |
| 指标入口 | `dump_details`、raw_reward、truncated_ratio、queue、rollout dumps | 已下载原运行的完整训练 loss 或 reward 曲线 |
| benchmark 协议 | 每 10 rollouts，在共享 engines 上暂停 producer 做 held-out eval；示例 20 tasks×2 samples | 已获得全部逐步分数，或小幅变化已显著 |

出处分别为[文章](https://www.lmsys.org/blog/2026-08-18-miles-v0-1/)和 [README](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/README.md)。README 作者给出该 eval 示例约 0.08 的 σ，这是其说明，不是本轮重新计算的置信区间。loss 数值序列和每题评测输出仍是本项目的重点检索缺口。

## 6. 故障、修复与恢复

| 症状 | 来源给出的解释/行动 | 验证入口 |
|---|---|---|
| 长轨迹硬失败，截断达 84% | 旧 KV budget 约 26k；当前设置扩大缓存预算 | 同模型/布局检查真实 KV token 容量与截断原因 |
| 一个 DP rank 忙，其余空闲 | 需要 DP-aware routing | 每 rank 并发与任务分布 |
| 并行修改后 OOM 或训练异常 | recipe 支持读取保存的 batch 做 trainer-only replay | 8 训练节点，无 engines/sandbox 的固定数据重放 |
| 已有 checkpoint 需评测 | `--load-from`、`--start-rollout-id 0`；保持原 `--num-rollout` | 加载后的 eval0 与 scheduler 检查 |

这些是[作者 README 的排错与重放说明](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/README.md)。本轮取得的是方法和配置，没有完整事故时间线、修复前后 loss 文件或成功恢复日志。故障索引见 [F11](/papers/engineering/failure-handbook)。

## 7. 产物、反馈与下一步

当前可复核产物包括 recipe、launcher、模型转换路径、checkpoint/dump 目录约定；原 run 的完整公开 checkpoint 集及部署后用户反馈未核验。后续独立追踪：原始 commit/镜像；任务与 eval manifest；loss/reward/KL/梯度/版本滞后完整序列；100 步性能分解；重启与恢复样本。各项均需保留运行 ID，避免把不同模式拼成一个 run。

返回：[项目目录](/papers/projects/coverage)、[指标证据索引](/papers/evidence/project-metrics)。
