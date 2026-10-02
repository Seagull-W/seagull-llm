import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent } from 'vue'
import Layout from './Layout.vue'
import './styles/custom.css'

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

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('TokenDemo', TokenDemo)
    app.component('AttentionViz', AttentionViz)
    app.component('WordEmbedViz', WordEmbedViz)
    app.component('NextTokenViz', NextTokenViz)
    app.component('RewardTrainingResults', RewardTrainingResults)
    app.component('SeagullLens', SeagullLens)
    app.component('HilbertQuote', HilbertQuote)
  }
}
