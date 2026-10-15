---
title: MiMo 训练损失、稳定性与 benchmark
description: 结合 MiMo 归档联合分析 loss、梯度、KL、reward 与 benchmark。
tags: ["论文与项目随谈","MiMo","训练实验","模型评估"]
---

# MiMo 训练损失、稳定性与 benchmark

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

各项目均需独立检查 benchmark 和训练 loss，当前证据状态见 [各项目指标索引](/papers/evidence/project-metrics)。下面以已保存的 MiMo 原始序列解释联合分析方法；各项目的具体数值和缺口保存在自己的档案中。

## 1. 已保存的数据

两个模型各 30 个最终保留训练步，全部公开 tag 都保存在 [全量指标长表](/papers/projects/mimo-v2-6/evidence/全量指标长表.csv)。[关键指标逐步表](/papers/projects/mimo-v2-6/evidence/关键指标逐步.csv)额外集中 43 个指标，包含 reward、advantage、policy loss、entropy、LR、gradient、clip/TIS、KL、更新状态、penalty 前后优势、长度、错误率和耗时。

序列来源：[Flash](https://mimo.xiaomi.com/rl/data.04135c89/series-flash.json)、[Pro](https://mimo.xiaomi.com/rl/data.04135c89/series-pro.json)。每条曲线是保留分支的逐步观测，不包含全部回滚尝试。

## 2. 先看关键数值

| 指标 | Flash step 1 → 30 | Pro step 1 → 30 | 解释边界 |
|---|---:|---:|---|
| `actor/pg_loss` | 0.000840813 → 0.0261328 | 0.00411032 → 0.0182077 | 不能像固定数据 SFT loss 一样解读 |
| `actor/entropy_loss` | 0.413307 → 0.470623 | 0.395265 → 0.461504 | 看板描述为平均 token entropy；名称不证明正则系数 |
| `actor/grad_norm` | 0.00603667 → 0.00628155 | 0.00533389 → 0.00485110 | 看板定义为 clipping 前全局梯度范数 |
| `actor/lr` | 3e-6 → 3e-6 | 3e-6 → 3e-6 | 已公开 30 步内为该值，不能反推此前 warmup |
| `train_infer_diff/new_infer/kl` | 0.00286778 → 0.0105611 | 0.00218940 → 0.00277385 | 同一 token 上 trainer 与 inference logprob 差异 |
| `critic/rewards/mean` | 0.516717 → 0.600520 | 0.552211 → 0.596393 | 训练轨迹数值 reward，不是 avg@n |
| `ctx_total_length/mean` | 71,633.5 → 147,751 | 72,177.6 → 137,239 | 包含 prompt 与 response；不是仅输出长度 |

定义参考：[runs.json](https://mimo.xiaomi.com/rl/data.04135c89/runs.json)。精度保留自 JSON，不能把多个小数位视为统计置信度。

![训练损失与稳定性指标](/papers/projects/mimo-v2-6/evidence/训练损失与稳定性.png)

## 3. 为什么 pg_loss 上升并不自动等于训练失败

这次 Flash 的 pg_loss 上升，同时 DeepSWE step 1→30 从 48.67 到 65.68。[benchmark](https://mimo.xiaomi.com/rl/data.04135c89/benchmarks.json) 两个观测可以同时成立：RL 优化的样本、优势、概率比值、mask 和课程持续变化，loss 的数值不必随泛化能力单调下降。

建议检查同一步的优势正负质量、任务构成、有效训练 token 数和聚合方式，再解释 pg_loss。不能仅从这两条序列反推出上升的具体原因；没有每个 batch 的原始数据与完整生产 loss 实现。

同样，entropy 增加不能单独证明质量更好，entropy 降低也不能单独证明“能力收敛”。需要结合重复行为、样本多样性、成功率与 held-out 结果。

## 4. 两种看起来相同的 0，可能有完全不同含义

公开序列里的 `actor/ppo_kl` 和 `actor/pg_clipfrac` 为 0，但 `actor/pg_tis_clipfrac` 与 `train_infer_diff/new_infer/kl` 非零。应分清记录对象；0 不保证“没有旧策略”“没有任何 clipping”或“训练推理完全一致”。

公开 `actor/clip_low=0.2`、`actor/clip_high=0.27` 是这次生产运行的 tag 值。9B 开源复现脚本的 clip 设置不同，因此不能跨对象合并成一份训练配方。[Pro 序列](https://mimo.xiaomi.com/rl/data.04135c89/series-pro.json)、[9B 训练脚本](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/code/run_train.sh)

## 5. 值得深入排查的点，而非已经证明的原因

| 归档观测 | 下一步应关联的证据 | 目前不能得出的结论 |
|---|---|---|
| Pro grad_norm 最大值 step 19 为 0.0335148 | 该步任务、advantage、长度、expert/rank 梯度 | 这次峰值由专家不均或某次重启直接导致 |
| Flash new-infer KL 最大值在 step 30，为 0.0105611 | 权重版本、token/精度/路由、长度、采样配置 | 模型已经训练崩溃 |
| 两模型 mean context 大约翻倍 | turn 数、输出/输入、任务/harness 分布 | 模型只在生成更长答案、能力没有提升 |
| Flash 最后一步 benchmark 低于 step 28 | 重复评测、每题结果、课程与 checkpoint | 最后两步必然造成退化 |
| Pro 后期过滤简单任务 | 任务 manifest、配额、固定评测 | training avg@n 前后可直接归因于能力 |

数值取自上述公开序列和 derived-summary；“下一步”属于整理建议，未执行原集群复盘。

## 6. 推荐的一套联合读图顺序

1. 确认实际 optimizer step 与更新成功状态，排除跳过更新却 step 前进。
2. 看 infra error、group 有效量、全成功/全失败比例，排除反馈失真。
3. 看 raw reward、penalty 和最终 advantage，确认在优化预期行为。
4. 看 pg_loss、entropy、gradient、KL/TIS，与采样权重和任务长度关联。
5. 看每任务族、每 harness、匿名 dataset 的分布，排除总体均值掩盖差异。
6. 结合固定 benchmark、真实行为回放与成本，判断训练收益。

以上属于整理方法。所有公开子指标均保留，但匿名 dataset ID 的业务名称和部分内部 penalty 定义尚未公开，不能强行解释。

继续阅读：[指标字典与 CSV](/papers/projects/mimo-v2-6/dashboard-guide)、[benchmark 与发布](/papers/engineering/evaluation-and-feedback)。
