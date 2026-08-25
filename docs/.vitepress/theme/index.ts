import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './styles/custom.css'

// 直接导入组件，避免异步 import 导致 SSR 下 [object Promise]
import TokenDemo from '../components/TokenDemo.vue'
import AttentionViz from '../components/AttentionViz.vue'
import WordEmbedViz from '../components/WordEmbedViz.vue'
import NextTokenViz from '../components/NextTokenViz.vue'
import SeagullLens from '../components/SeagullLens.vue'
import HilbertQuote from '../components/HilbertQuote.vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('TokenDemo', TokenDemo)
    app.component('AttentionViz', AttentionViz)
    app.component('WordEmbedViz', WordEmbedViz)
    app.component('NextTokenViz', NextTokenViz)
    app.component('SeagullLens', SeagullLens)
    app.component('HilbertQuote', HilbertQuote)
  }
}
