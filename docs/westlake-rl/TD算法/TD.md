算法7.1处 更新贪心策略时，$a=argmin_a q_{t+1}(s_t,a)$，此处对于a的动作价值，应当是初始值与估计值混合的状态。

Q-learning似乎相当于在新息中就考虑了下一步的最佳动作（贪心策略）

sarsa，MC是on-policy，q-learning是off-policy的，这里的在线策略离线策略和在线学习离线学习是两码事。主要是看目标策略和行为策略是否相同。

Q-learning可以在线也可以离线学习。