---
title: 启动、观测与恢复：把训练做成可追溯的运行
description: 核对启动配置、运行证据、checkpoint 与采样器的恢复边界。
tags: ["论文与项目随谈","后训练","故障恢复","训练实验"]
---

# 启动、观测与恢复：把训练做成可追溯的运行

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 启动前先使配置可检查

MiMo Code 脚本先生成 Hydra resolved config，再验证关键参数，写入 run manifest；支持 `PREFLIGHT_ONLY=1` 只完成这一阶段。[启动脚本](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/code/run_train.sh)、[validator](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/code/validate_resolved_config.py)

示例属于 Linux/bash 集群入口，需要先完成该项目环境、数据、镜像与变量准备；本次没有执行：

```bash
PREFLIGHT_ONLY=1 bash scripts/code/train.sh
```

生成配置不等于环境已成功创建，也不等于 GPU 数值一致。后续建议按单任务、单 group、单更新、保存/恢复短跑递进。

## 2. 建议的运行证据包

| 类别 | 最小记录 |
|---|---|
| 身份 | run ID、attempt ID、Git SHA、submodule SHA、开始时间与时区 |
| 配置 | 合并后的实际配置、命令行覆盖、镜像 digest、环境变量白名单 |
| 数据 | manifest/hash、split、task/harness/grader 版本、数据变化 step |
| 模型 | 起点权重/tokenizer/template、训练与推理转换版本、精度 |
| 系统 | GPU 型号/卡数/节点、rank 布局、网络、RAM、存储、服务地址类型 |
| 轨迹 | token/logprob、policy version、group、mask、reward 与错误分类 |
| 更新 | loss/entropy/KL/clip/梯度、实际 optimizer step、接受/丢弃数量 |
| 保存 | checkpoint 完成标记、optimizer/scheduler/RNG、数据源进度与队列 |
| 评测 | checkpoint、harness、协议、每题结果、统计区间、失败样本 |

这是整理建议。敏感凭据不应进入 manifest；可记录 endpoint 类型与 grader model 版本。MiMo manifest 工具体现了为代码、组件、配置与命令建立 provenance 的做法。[manifest 工具](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/write_run_manifest.py)

## 3. 不要默认“重启就是续训”

MiMo Code 开源 `run_train.sh` 明确传入 `trainer.resume_mode=disable`。原运行发生回滚，并不说明这个公开脚本默认启用了同样的恢复逻辑。[代码](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/code/run_train.sh)

恢复前建议核对：加载了哪个 checkpoint；是否恢复 Adam 状态与 LR；是否重放已更新但未保存的 batch；推理权重与队列数据是不是同一 run；数据源游标是否重复/跳过；不同并行布局是否需要 reshard。

## 4. slime 当前恢复机制与边界

当前公开文档支持保留 serving cluster：trainer 失败后，在 **同一仍运行的 Ray 集群**重新提交，并借助 straw 或保存的 rollout debug data 重放 checkpoint 后的训练批次。它不等于自动重试整个作业。[slime 容错文档](https://github.com/THUDM/slime/blob/main/docs/en/advanced/fault-tolerance.md)

恢复数据需从首次启动就保存。常规 Adam 要保存 optimizer、scheduler、RNG 等状态；stateless optimizer 的例外不能推广为任意 Adam 可省略状态。改变 TP/PP 等布局时，RNG 与精度重建可能使更新不再逐位一致。完整 Ray 集群或 ServingCluster 丢失则仍需重新启动服务并从 checkpoint 恢复。[同一文档](https://github.com/THUDM/slime/blob/main/docs/en/advanced/fault-tolerance.md)

操作建议：先确认失败作业退出和恢复边界，再更改 microbatch/token budget 或受支持的并行参数；保留健康 serving 与数据队列。不要把启动器里清理所有 Ray/SGLang 的命令原封不动用于保留服务的恢复路径。

## 5. 三种不同事故的恢复判断

| 事故 | 核心问题 | 建议的恢复检查 |
|---|---|---|
| trainer OOM，反馈有效 | 计算资源与峰值 | 固定同批数据复现，调整布局，检查状态恢复 |
| grader 不可达，状态识别正确 | 暂时不可评分 | 暂停/重试、隔离错误样本，控制队列与任务分布 |
| infra error 漏检并参与训练 | 学习数据可信度 | 定位影响的更新区间，验证修分类规则，选择回滚边界 |

MiMo 公开公告确实存在后两种关联事件：Pro grader 连通问题与 Flash infra 分类漏检回滚。缺少原始污染样本与修复代码，不能为该次事故给出完整可执行复原。[公告](https://mimo.xiaomi.com/rl/data.04135c89/notices.json)

## 6. 报错的采集顺序

建议先收集原始异常和最早失败 rank，再收集 Ray/Slurm worker 状态、资源峰值、最后的 trajectory/group/step、resolved config 与版本。分清 GPU OOM、主机 RAM OOM、Pod 配额不足、grader 错误和连带通信超时。不同问题需要不同修复。

下一步查 [故障手册](/papers/engineering/failure-handbook)；判断训练是否有效则查 [损失与指标](/papers/projects/mimo-v2-6/loss-and-metrics)。
