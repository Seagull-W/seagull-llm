---
title: 实际故障与反馈手册
description: 按症状查找奖励、显存、调度、路由、恢复和容器故障的公开证据。
tags: ["论文与项目随谈","后训练","故障恢复","分布式训练"]
---

# 实际故障与反馈手册

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

本手册按症状组织。每项区分来源中的观察、提出的解释、修复状态和建议验证。Issue 的标题或关闭状态不能替代修复 commit；本次未在对应 GPU 集群复现。

## 快速定位

| 症状 | 先查 |
|---|---|
| reward 全零、训练进程正常 | F01、F02 |
| reward 或 success rate 突变 | F02、F03、F04、F18 |
| GPU OOM | F05、F06、F07 |
| 主机 RAM OOM / Ray worker 被杀 / offload 泄漏 | F08、F09、F15 |
| Ray 长期 pending / 任务不开始 | F10、F17 |
| rollout 截断严重、部分 rank 空闲 | F11 |
| train/infer KL 异常或乱码、长上下文精度下降 | F12、F18 |
| Docker daemon 崩溃、任务环境起不来 | F16 |
| 线上重复工具调用 / 修复后拒绝正常调用 | F13 |
| 重启后数据/step/结果对不上 | F14 |

## F01：Music 评分依赖缺失，静默零奖励

**可见证据：** MiMo Music 环境说明指出，缺少 `abc2midi` 会让 scorer 跳过样本并返回 0，看起来像健康运行。启动器在 worker 上探测该程序，防止静默启动。[环境说明](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/music.env.example)

**处理与验证：** 在实际 worker 镜像中检查依赖，运行已知可评分的音乐样本，确认不仅进程成功，而且产生有效非零分数。不能靠 driver 上安装依赖证明所有 worker 可用。来源给出预检机制，本次未执行。

## F02：基础设施错误漏检，错误反馈参与训练

**运行事实：** 小米 Flash 公告称某数据集约三小时内有一类 infra error 未正确检测，随后从 step 15 重启。末尾事件窗口保留 step 16、17 的重做。[公告](https://mimo.xiaomi.com/rl/data.04135c89/notices.json)、[事件](https://mimo.xiaomi.com/rl/data.04135c89/status-flash.json)

**建议排查：** 对照错误分类、原始 grader 输出与 batch 接受记录，确定受影响的更新区间；修分类规则后回放代表性成功/失败/infra 样本。错误类型和补丁未公开，不能直接复制一份“官方修复”。

## F03：训练集群与 grader 连接异常

**运行事实：** Pro 官方公告明确网络连接异常并重启，同次说明还移除了 cyber 数据。[公告](https://mimo.xiaomi.com/rl/data.04135c89/notices.json)

**建议排查：** 从实际执行节点验证 grader 连通、超时、认证、服务负载与响应 schema；分别看 inference、tool、judge 延迟。不能因同一公告提到两个行动，就断言网络错误导致了 cyber 的不良 rollout 行为。

## F04：训练成功率变化，其实来自任务分布调整

**运行事实：** Pro 后期筛去了相对简单的任务；公开任务混合也有调整。[公告](https://mimo.xiaomi.com/rl/data.04135c89/notices.json)

**建议验证：** 对比数据 manifest、任务配额、每任务族指标和固定 benchmark。总体 avg@n 变化不构成能力单独变化的证据。原始筛选清单和阈值未公开。

## F05：MoE 专家负载不均引起 GPU OOM

**团队说明：** 小米 Pro 在 step 17 重启，公告将 OOM 归因于 expert load imbalance，并称调整了训练并行策略。[公告](https://mimo.xiaomi.com/rl/data.04135c89/notices.json)

**建议排查：** 收集最早失败 rank、具体层、token 长度、expert token 分布与 dispatch 峰值，固定同批轨迹比较并行布局。新布局数值未公开，不能声称官方只是提高了 EP 或 CP。

## F06：长序列最后一个 PP stage 的 entropy OOM

**用户反馈：** slime #1523 报告 H200、TP4/PP4/CP2、超过约 30k token 时在 entropy 路径 OOM，entropy 系数为 0 仍保留 backward 中间张量；建议把仅监控的 entropy 与训练反向分开。[Issue #1523](https://github.com/THUDM/slime/issues/1523)

**状态与验证：** 有维护者讨论，但本次没有核验到已合并、覆盖该版本的修复。应对实际版本 profile logits/entropy 保存张量、peak memory 和梯度语义；不能仅关掉监控就宣称损失实现正确。

## F07：单节点 VRAM 问题，根因不详

**运行事实：** 小米 Pro 公告记录某节点 VRAM 问题并重启，没有提供硬件日志或具体栈。[公告](https://mimo.xiaomi.com/rl/data.04135c89/notices.json)

**建议排查：** 区分显存峰值、残留进程、碎片、allocator 行为和硬件异常；比较该节点与健康节点。不要把这一条与后来的 expert load OOM 自动合并成同一事故。

## F08：Router replay payload 广播造成主机 RAM 峰值

**用户反馈：** slime #2384 描述大量 `[tokens, MoE layers, top-k]` 路由 metadata 被广播给不需要完整数据的 rank，主机 RAM 迅速增长。[Issue #2384](https://github.com/THUDM/slime/issues/2384)

**候选修复：** #2385 提议按接收 actor 的 CP/TP/DP 数据需求分片，仅获取对应 payload。作者报告 memory spikes 消失，但 PR 截至 2026-10-11 仍为 **Open**，不能写成上游已经修复。[PR #2385](https://github.com/THUDM/slime/pull/2385)

**建议验证：** 同样 token/group/并行布局比较每 rank RAM 与传输字节，同时核对 replay token/expert 索引一致性。GPU 显存正常不能排除此问题。

## F09：CPU optimizer offload 后 Ray 因 RAM 耗尽杀 worker

**用户反馈：** slime #1851 的 Qwen3-30B-A3B、8×H100 配置，在约 1TB 主机上出现多个训练 actor 各约 102GB 的 RAM 占用，Ray 在总 RAM 超阈值时杀 worker。[Issue #1851](https://github.com/THUDM/slime/issues/1851)

**状态与建议：** Issue 为 Closed，不代表已证明固定根因或合并修复。统计 optimizer/master/gradient、初始化副本和 object store，比较 per-process 与总 RAM。调高 Ray 阈值不增加物理内存，不能当作容量修复。

## F10：Ray GPU 资源调度 pending

**文档线索：** slime QA 说明共置与分离部署需要不同的资源规划；分离模式不能仅申请 trainer GPU 数。[QA](https://github.com/THUDM/slime/blob/main/docs/en/get_started/qa.md)

**建议验证：** 比较 cluster 可见 GPU、trainer/rollout 请求、placement group 与每节点布局；确认没有残留作业占用。资源不匹配应先解决，不能用无限等待掩盖。

## F11：KV budget 太小，长轨迹硬失败；路由不感知 DP

**作者工程记录：** Miles GLM-5.2 参考 recipe 的 README 描述，旧 KV 设置只剩约 26k token pool，长输入硬失败、截断率达 84%；当前说明采用更大的缓存预算。另指出缺少 DP-aware routing 会把请求集中到单个 DP rank，其余 rank 空闲。[参考运行 README](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/README.md)

**建议验证：** 在同一模型精度/布局下检查真实 KV tokens、最长会话、截断原因、各 rank 并发和 prefix-cache 命中。文档中的内存比例值只适用于该配置；不能从 0.75→0.85 推导通用提升比例。

## F12：生成乱码或初始 logprob 对不上

**文档线索：** slime debug 提示检查 Megatron→SGLang 权重转换、PP 层索引和 buffer；QA 还列出 checkpoint 路径、stop token 和端口/编译缓存等问题。[debug](https://github.com/THUDM/slime/blob/main/docs/en/developer_guide/debug.md)、[QA](https://github.com/THUDM/slime/blob/main/docs/en/get_started/qa.md)

**建议验证：** 固定 token 上下文、权重、精度与采样协议比较 logprob，再逐层检查映射与内核。不要把禁用 NaN 检查视为修好数值错误；查出首次非有限值的计算才有根因证据。

## F13：重复工具调用与修复后的过度抑制

**实际材料：** MiMo #98 是重复调用反馈；官方后来发布阈值、checkpoint 回放和教师修复说明；#102 报告修复后可能抑制有效第三次工具调用。[#98](https://github.com/XiaomiMiMo/MiMo/issues/98)、[官方修复](https://mimo.xiaomi.com/blog/mimo-v2-6-tool-call-repetition)、[#102](https://github.com/XiaomiMiMo/MiMo/issues/102)

**证据边界：** 官方选定实验样本的重复率不是所有线上请求比例；#102 是用户报告。建议固定 tools/harness/request，对多个权重版本测试重复、正常多工具调用和工具异常后的恢复能力。不能只测“重复下降”。

## F14：重启后采样器、optimizer 和 checkpoint 边界不一致

**代码与文档：** MiMo Code 开源默认禁用 resume；slime 当前文档支持 checkpoint 后已保存 batch 重放，且要求保留 serving/session 与相关状态。[MiMo 训练脚本](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/code/run_train.sh)、[slime 恢复文档](https://github.com/THUDM/slime/blob/main/docs/en/advanced/fault-tolerance.md)

**建议验证：** 对照 attempt ID、实际 optimizer step、已提交 checkpoint、队列 receipt、数据源游标与推理权重版本。重启后的曲线连续不证明无重复/丢样本。保留服务的恢复路径不能随意重建整个 Ray 集群。

## F15：异步 activation offload 的 CUDA-stream 内存泄漏

**作者实验反馈：** INTELLECT-3 报告说明异步 offload 实现出现内存泄漏，因此采用同步变体。[报告 §2.1.6](https://arxiv.org/html/2512.16144v1)

**状态与建议：** 尚未取得原始栈、最小复现或修复 commit。建议固定 batch 比较分配/释放、stream 生命周期与长时间内存曲线，并确认梯度一致性。不能将作者采用同步实现等同于当前上游所有版本已修好异步实现。

## F16：数百容器并发使 dockerd 崩溃

**作者运行反馈：** DeepSWE-Preview 的作者说明，大量并发环境过载 Docker API，随后引入 Kubernetes 分摊调度并预置镜像。[作者文章](https://www.together.ai/blog/deepswe)

**状态与建议：** 原始 daemon 日志和事故时间线尚未取得。建议区分容器创建/清理、镜像拉取、CPU/磁盘和 API 延迟；GPU 空闲时先检查环境供给。架构调整的说明不自动证明任意 Kubernetes 布局能够满足相同并发。

## F17：Ray 启动选错网络地址，或 worker 过早加入

**代码线索：** Miles Slurm launcher 按 compute-fabric 前缀选择 head IP，并说明管理网地址不可跨节点路由；worker 首次连接可能早于 head GCS 就绪，因此包含重试。[launcher](https://github.com/radixark/miles/blob/main/examples/experimental/openenv/glm52_tbench2/launch_16node_slurm.sh)

**建议验证：** 从实际节点核对所选 IP、路由、端口和 head readiness，再检查 Ray 注册资源。此处有明确代码/注释，尚无对应原 run 的完整故障日志。

## F18：高 off-policy 下 reward 崩塌，或 CP 扩展导致精度下降

**作者实验反馈：** INTELLECT-3 记录了 async-8 算法消融中的 GSPO 指标崩塌，以及长上下文 CP 尝试的精度下降；最终配方和生产路径未直接沿用失败尝试。[报告 §2.1.6/§3.3](https://arxiv.org/html/2512.16144v1)

**证据边界与建议：** 两个现象有不同触发条件，不合并为同一根因。建议分别固定 rollout/概率版本检查 loss 与 mask，以及固定 tokens 检查 CP 前后 logprob/梯度；本轮未取得原始失败 batch，也未复测该结论。

## 未整理成已证实根因的现象

端口冲突、compile cache 解析错误、stop token 配置错误有文档线索，但本轮没有完整公开事故时间线；只作为进一步检索/调试入口。NCCL timeout、训练 NaN、模型崩溃也不能凭错误字符串直接认定某一固定根因。
