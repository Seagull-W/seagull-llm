<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue'
import { useBookPlayback } from '../composables/useBookPlayback'
import './book-visuals.css'

const { stage, playing, reducedMotion, goTo, togglePlay, next, previous, reset } = useBookPlayback(3)
const graphicId = useId()
const stages = [
  { name: '切分文字', text: '先把输入切成离散单元，给每个单元一个编号。这里的“今天 / 天气”只是示意切分。' },
  { name: '查表表示', text: '用编号从已学习的嵌入表取出向量。向量是一组数字；各个坐标不一定对应一个能直接命名的含义。' },
  { name: '处理上下文', text: '在网络中混合来自可用位置的信息，再进行其他变换。表示逐层更新；这里将多层计算合并为一步。' },
  { name: '形成分布', text: '把最后位置的表示转为候选分数和概率。选择一个 Token 后，它加入上下文，下一步要依据新的上下文生成。' }
]
const firstCandidates = [
  { token: '晴朗', probability: 50 },
  { token: '阴沉', probability: 30 },
  { token: '寒冷', probability: 20 }
]
const selected = shallowRef<string | null>(null)
const continuations: Record<string, { token: string; probability: number }[]> = {
  晴朗: [{ token: '。', probability: 55 }, { token: '，适合', probability: 30 }, { token: '，但', probability: 15 }],
  阴沉: [{ token: '，可能', probability: 50 }, { token: '。', probability: 30 }, { token: '，但', probability: 20 }],
  寒冷: [{ token: '，记得', probability: 60 }, { token: '。', probability: 25 }, { token: '，但', probability: 15 }]
}
const candidates = computed(() => selected.value ? continuations[selected.value] : firstCandidates)
const context = computed(() => `今天天气${selected.value ?? ''}`)
function resetAll() { reset(); selected.value = null }
</script>

<template>
  <section class="book-viz" :class="{ 'is-playing': playing }" aria-label="一次生成步骤的分步演示">
    <p class="book-viz-title">从输入到候选分布</p>
    <p class="book-viz-meta">概念示意：切分、向量和概率由作者设定，未运行真实模型。虚构候选表的概率合计为 100%。</p>
    <p class="book-viz-question">先猜一猜：第一步选择“晴朗”或“阴沉”，后续分布还会一样吗？</p>
    <nav class="book-viz-steps" aria-label="生成阶段">
      <button v-for="(item, index) in stages" :key="item.name" type="button" :aria-current="stage === index ? 'step' : undefined" @click="goTo(index)">{{ index + 1 }}. {{ item.name }}</button>
    </nav>

    <svg class="book-viz-svg" viewBox="0 0 640 210" role="img" :aria-labelledby="`${graphicId}-title`">
      <title :id="`${graphicId}-title`">{{ stages[stage].name }}的概念示意</title>
      <defs><marker :id="`${graphicId}-arrow`" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" class="book-flow" /></marker></defs>
      <g v-if="stage === 0" text-anchor="middle">
        <text x="320" y="36">今天天气</text>
        <path d="M320 52V80M320 80H165V102M320 80H475V102" class="book-flow" />
        <rect x="70" y="112" width="190" height="57" rx="8" class="book-token" />
        <rect x="380" y="112" width="190" height="57" rx="8" class="book-token" />
        <text x="165" y="147">今天</text><text x="475" y="147">天气</text>
        <text x="320" y="201" class="book-small">两个示意 Token；真实切分依赖分词器</text>
      </g>
      <g v-else-if="stage === 1" text-anchor="middle">
        <rect x="30" y="32" width="140" height="56" rx="8" class="book-token"/><text x="100" y="67">今天</text>
        <rect x="30" y="125" width="140" height="56" rx="8" class="book-token"/><text x="100" y="160">天气</text>
        <path d="M170 60H265M170 153H265" class="book-flow" :marker-end="`url(#${graphicId}-arrow)`"/>
        <rect x="280" y="32" width="325" height="56" rx="8" class="book-box"/><text x="442" y="67">[0.2, 0.7, 0.1, …]</text>
        <rect x="280" y="125" width="325" height="56" rx="8" class="book-box"/><text x="442" y="160">[0.4, 0.1, 0.8, …]</text>
        <text x="320" y="207" class="book-small">查表取得初始表示；数字没有预设的语义标签</text>
      </g>
      <g v-else-if="stage === 2" text-anchor="middle">
        <rect x="15" y="28" width="135" height="56" rx="8" class="book-box"/><text x="82" y="63">今天的表示</text>
        <rect x="15" y="124" width="135" height="56" rx="8" class="book-box"/><text x="82" y="159">天气的表示</text>
        <path d="M150 56L275 104" class="book-flow"/><path d="M150 152L275 104" class="book-flow" stroke-width="5"/>
        <rect x="278" y="72" width="148" height="68" rx="8" class="book-box"/><text x="352" y="113">按权重汇总</text>
        <path d="M426 106H480" class="book-flow" :marker-end="`url(#${graphicId}-arrow)`"/>
        <rect x="492" y="72" width="135" height="68" rx="8" class="book-box"/><text x="559" y="113">继续变换</text>
        <circle cx="0" cy="0" r="6" class="book-accent book-data-particle"/>
        <text x="320" y="205" class="book-small">网络更新表示；连线为示意，不是实测权重</text>
      </g>
      <g v-else>
        <g v-for="(candidate, index) in candidates" :key="index" :transform="`translate(0, ${index * 62})`">
          <text x="30" y="36">{{ candidate.token }}</text>
          <rect x="175" y="13" width="350" height="32" rx="4" class="book-box"/>
          <rect x="175" y="13" :width="candidate.probability * 3.5" height="32" rx="4" class="book-value book-probability-bar"/>
          <text x="548" y="36">{{ candidate.probability }}%</text>
        </g>
        <text x="320" y="205" text-anchor="middle" class="book-small">{{ selected ? '选择改变后：另一张预设的下一步分布' : '第一步：预设的示意候选分布' }}</text>
      </g>
    </svg>

    <div class="book-viz-explanation" aria-live="polite">
      <strong>{{ stage + 1 }}. {{ stages[stage].name }}</strong>
      <p>{{ stages[stage].text }}</p>
    </div>
    <div v-if="stage === 3">
      <p class="book-viz-context">{{ context }}</p>
      <p class="book-viz-notice">改变第一步的选择，比较上方显示的后续分布：</p>
      <div class="book-viz-choices" aria-label="第一步候选选择">
        <button v-for="candidate in firstCandidates" :key="candidate.token" type="button" :aria-pressed="selected === candidate.token" @click="selected = candidate.token">选“{{ candidate.token }}”</button>
      </div>
      <p v-if="selected" class="book-viz-notice">选中的“{{ selected }}”加入上下文。本演示切换到另一组预设概率，说明下一步的条件变了；没有计算真实模型概率。</p>
    </div>
    <div class="book-viz-controls">
      <button type="button" :disabled="stage === 0" @click="previous">上一步</button>
      <button type="button" :disabled="stage === 3" @click="next">下一步</button>
      <button v-if="!reducedMotion" type="button" class="book-primary" @click="togglePlay">{{ playing ? '暂停' : '播放动画' }}</button>
      <button type="button" @click="resetAll">重置</button>
    </div>
    <p v-if="reducedMotion" class="book-viz-notice">已减少动态效果，可以用上一步、下一步或阶段按钮观察。</p>
  </section>
</template>
