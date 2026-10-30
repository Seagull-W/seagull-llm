import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent } from 'vue'
import Layout from './Layout.vue'
import './styles/custom.css'
import './styles/reading.css'
import './styles/sections.css'
import './styles/native-html.css'
import './styles/notebook-design.css'
import ChapterCards from '../components/ChapterCards.vue'
import TagsIndex from '../components/TagsIndex.vue'
import NoteFlowIcon from '../components/NoteFlowIcon.vue'

// 首页 / 全局必需组件：同步导入
import SeagullLens from '../components/SeagullLens.vue'
import HilbertQuote from '../components/HilbertQuote.vue'

// 章节页专用重组件：异步注册，Vite 自动按组件 split chunk。
// 首页主 bundle 不再含这些组件代码（含 NextTokenViz → useModelManager →
// @huggingface/transformers 链路）。SSR 下配合 .md 中的 <ClientOnly> 包裹使用，
// 避免 [object Promise]。
const TokenDemo = defineAsyncComponent(() => import('../components/TokenDemo.vue'))
const AttentionViz = defineAsyncComponent(() => import('../components/AttentionViz.vue'))
const WordEmbedViz = defineAsyncComponent(() => import('../components/WordEmbedViz.vue'))
const NextTokenViz = defineAsyncComponent(() => import('../components/NextTokenViz.vue'))
const RewardTrainingResults = defineAsyncComponent(() => import('../components/RewardTrainingResults.vue'))
const GenerationWalkthrough = defineAsyncComponent(() => import('../components/GenerationWalkthrough.vue'))
const EvidenceWalkthrough = defineAsyncComponent(() => import('../components/EvidenceWalkthrough.vue'))

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ChapterCards', ChapterCards)
    app.component('TagsIndex', TagsIndex)
    app.component('NoteFlowIcon', NoteFlowIcon)
    app.component('TokenDemo', TokenDemo)
    app.component('AttentionViz', AttentionViz)
    app.component('WordEmbedViz', WordEmbedViz)
    app.component('NextTokenViz', NextTokenViz)
    app.component('RewardTrainingResults', RewardTrainingResults)
    app.component('GenerationWalkthrough', GenerationWalkthrough)
    app.component('EvidenceWalkthrough', EvidenceWalkthrough)
    app.component('SeagullLens', SeagullLens)
    app.component('HilbertQuote', HilbertQuote)
  }
}

import './styles/navigation.css'

import './styles/coastal.css'
import './styles/interiors.css'

import './styles/reader-navigation.css'
import './styles/academic-reading.css'
import './styles/note-flow.css'
