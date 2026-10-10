<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue'
import { useBookPlayback } from '../composables/useBookPlayback'
import './book-visuals.css'

type Scenario = 'misleading' | 'corrected' | 'missing'
interface Claim { text: string; supported: boolean; reason: string }
const scenario = shallowRef<Scenario>('misleading')
const { stage, playing, reducedMotion, goTo, togglePlay, next, previous, reset } = useBookPlayback(3)
const graphicId = useId()
const stageNames = ['明确问题', '准备资料', '生成草稿', '核验草稿']
const scenarios: { id: Scenario; label: string }[] = [
  { id: 'misleading', label: '引用错位' },
  { id: 'corrected', label: '修正后' },
  { id: 'missing', label: '资料不足' }
]
const documents = computed(() => [
  { id: 'A', title: '本学期普通周开放安排', text: '普通教学周，周一至周五 08:00–22:00 开放。' },
  { id: 'B', title: '考试周延时通知', text: '仅考试周的周一至周五，延长至 23:00；其他日期沿用普通安排。' },
  ...(scenario.value === 'missing' ? [] : [{ id: 'C', title: '区域预约规则', text: '安静自习室需预约；普通阅览区域无需预约。' }])
])
const claims = computed<Claim[]>(() => {
  if (scenario.value === 'misleading') return [
    { text: '普通周周三，图书馆 23:00 闭馆。[B]', supported: false, reason: '× B 只适用于考试周，不能支持普通周的 23:00。' },
    { text: '所有阅览区域都需要预约。[C]', supported: false, reason: '× C 区分两种区域，不能支持“所有区域”。' }
  ]
  return [
    { text: '普通周周三，图书馆 22:00 闭馆。[A]', supported: true, reason: '✓ A 的日期范围和星期与问题一致，支持这一结论。' },
    scenario.value === 'missing'
      ? { text: '普通阅览区域无需预约。', supported: false, reason: '? 本次缺少 C；A、B 都没有预约规则，资料不足以判断。' }
      : { text: '普通阅览区域无需预约；安静自习室需预约。[C]', supported: true, reason: '✓ C 明确分别说明了两种区域，结论保留了这个范围。' }
  ]
})
const allSupported = computed(() => claims.value.every(claim => claim.supported))
const outcome = computed(() => allSupported.value
  ? '可交付：两条结论都获得对应资料支持。'
  : scenario.value === 'missing'
    ? '先处理缺口：补充预约规则，或把第二条改为“现有资料无法确定”。'
    : '停在核验：修正日期与区域的范围，再检查草稿。')
function selectScenario(value: Scenario) { scenario.value = value; reset() }
</script>

<template>
  <section class="book-viz" :class="{ 'is-playing': playing }" aria-label="资料与结论的支持关系演示">
    <p class="book-viz-title">跟着一条结论检查它的出处</p>
    <p class="book-viz-meta">虚构教学例子：资料、草稿和检查结果均由作者设定。此脚本展示核查方法，没有调用模型或自动判断任意事实。</p>
    <div class="book-viz-choices" aria-label="核验情形">
      <button v-for="item in scenarios" :key="item.id" type="button" :aria-pressed="scenario === item.id" @click="selectScenario(item.id)">{{ item.label }}</button>
    </div>
    <nav class="book-viz-steps" aria-label="证据流程阶段">
      <button v-for="(name, index) in stageNames" :key="name" type="button" :aria-current="stage === index ? 'step' : undefined" @click="goTo(index)">{{ index + 1 }}. {{ name }}</button>
    </nav>
    <svg class="book-viz-svg" viewBox="0 0 640 110" role="img" :aria-labelledby="`${graphicId}-title`">
      <title :id="`${graphicId}-title`">问题、资料、草稿与核验之间的信息流，当前为{{ stageNames[stage] }}</title>
      <g v-for="(name, index) in ['问题', '资料', '草稿', '核验']" :key="name" :transform="`translate(${index * 165}, 0)`" :class="{ 'book-dim': stage < index }">
        <rect x="3" y="20" width="134" height="64" rx="8" class="book-box" :style="stage === index ? { stroke: 'var(--book-info)', strokeWidth: 3 } : {}"/>
        <text x="70" y="61" text-anchor="middle">{{ name }}</text>
        <path v-if="index < 3" d="M137 52H163M155 46L163 52L155 58" class="book-flow"/>
      </g>
      <circle :cx="70 + stage * 165" cy="99" r="5" class="book-accent book-svg-flow-dot"/>
    </svg>
    <div class="book-viz-explanation" aria-live="polite">
      <strong>{{ stage + 1 }}. {{ stageNames[stage] }}</strong>
      <p v-if="stage === 0">问题：本学期普通周的周三，图书馆几点闭馆？普通阅览区域需要预约吗？先把“普通周”和“普通阅览”记下来。</p>
      <p v-else-if="stage === 1">逐份保留资料的编号和适用条件。{{ scenario === 'missing' ? '这一次只有 A、B，没有预约规则 C。' : 'A、B 涉及不同日期；C 区分不同区域。' }}</p>
      <p v-else-if="stage === 2">草稿把回答拆成两条可核查的结论。先不要因为看到了引用编号就接受它。</p>
      <p v-else>分别比较结论和引用材料：内容是否支持，日期与区域是否一致？缺资料时，把缺口明确说出来。</p>
    </div>
    <div v-if="stage >= 1" class="book-viz-docs" aria-label="本次使用的资料">
      <article v-for="document in documents" :key="document.id" class="book-viz-doc">
        <span class="book-doc-id">{{ document.id }}</span>
        <div><strong>{{ document.title }}</strong><p>{{ document.text }}</p></div>
      </article>
    </div>
    <div v-if="stage >= 2" class="book-viz-claims" aria-label="待核验的草稿">
      <strong>草稿</strong>
      <div v-for="claim in claims" :key="claim.text" class="book-viz-claim">
        <p>{{ claim.text }}</p>
        <p v-if="stage === 3" class="book-viz-check" :class="{ 'is-supported': claim.supported }">{{ claim.reason }}</p>
      </div>
    </div>
    <p v-if="stage === 3" class="book-viz-outcome" :class="{ 'is-supported': allSupported }" role="status">{{ outcome }}</p>
    <div class="book-viz-controls">
      <button type="button" :disabled="stage === 0" @click="previous">上一步</button>
      <button type="button" :disabled="stage === 3" @click="next">下一步</button>
      <button v-if="!reducedMotion" type="button" class="book-primary" @click="togglePlay">{{ playing ? '暂停' : '播放动画' }}</button>
      <button type="button" @click="reset">重置</button>
    </div>
    <p v-if="reducedMotion" class="book-viz-notice">已减少动态效果，可以用阶段按钮逐步核查。</p>
  </section>
</template>
