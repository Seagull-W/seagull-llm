<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick, watch } from 'vue'
import { useModelManager, type Candidate } from '../composables/useModelManager'

// 模型管理：状态提升到模块级，切换文档时组件卸载但模型状态保留
const {
  modelState, modelProgress, modelError, modelErrorDetail,
  useMirror, useRealModel, lastInferenceOk,
  loadRealModel, unloadRealModel, predictWithModel,
} = useModelManager()

// ============================================================
//  大型语料库 —— 用于构建统计语言模型（默认模拟模式使用）
// ============================================================
const corpus = `
今天天气很好我们出去走走吧天气预报说这几天都很暖和春天的风很舒服阳光也特别好不过到了晚上可能会变凉记得多穿一件衣服昨天下午下了一场大雨街上的人都打着伞路面湿滑走路要小心秋天的树叶慢慢变黄了一片片落下来像金色的蝴蝶在空中飞舞冬天的雪很白很美孩子们在雪地里堆雪人打雪仗开心极了夏天的太阳很烈要注意防晒多喝水
大语言模型正在改变世界它可以根据上文预测下一个词然后一个字一个字地生成回答这种技术让机器能够理解和生成人类语言人工智能的发展速度很快越来越多的领域开始使用这些技术机器学习是其中的核心深度学习则是更进一步的分支训练数据的质量决定了模型的能力参数规模越大模型的能力通常也越强但这并不意味着更大的模型就一定更好模型的架构训练方法数据质量都很重要
我昨天去了图书馆看书那里很安静适合学习和思考我借了几本关于历史和科学的书准备这个周末慢慢看读书是一件很快乐的事情可以让人增长知识开阔眼界不过也不能只读书还要多出去走走看看外面的世界路上的风景也很美人生就像一场旅行重要的不是目的地而是沿途的风景和心情
健康是最重要的财富平时要注意饮食均衡多吃蔬菜水果少吃油腻的食物每天坚持运动哪怕只是散步半小时也对身体有好处如果感觉不舒服应该及时去医院看看不要拖延预防比治疗更重要定期体检可以早发现问题早治疗早睡觉早起床身体好精神好心情也好
工作中遇到问题是正常的关键是要保持冷静一步一步地分析和解决可以先把大问题拆成小问题然后逐个攻克如果实在解决不了也可以请教同事或者上网搜索答案团队合作很重要大家互相帮助才能把事情做好沟通是解决问题的关键学会倾听别人的意见尊重不同的观点
猫坐在垫子上睡觉很舒服的样子它偶尔睁开眼睛看看四周然后又闭上了小狗在旁边跑来跑去想要找猫玩但是猫懒得理它窗外的阳光照进来洒在地板上温暖而安静这是一个平常的午后鸟儿在树上唱歌花儿在园子里开放一切看起来都很美好
学习一门新语言需要时间和耐心刚开始可能会觉得很难但只要坚持下去就会越来越好先从基础的字母和发音学起然后慢慢积累词汇和语法多听多说多读多写不要怕犯错每一次错误都是进步的机会熟能生巧只要勤加练习就一定能掌握
科技的发展给生活带来了很多便利手机电脑互联网已经成为我们每天都要用的工具我们可以随时随地获取信息与人沟通处理工作但也要注意不要过度依赖电子产品适当的休息和运动对身心健康都很重要保护眼睛很重要看屏幕久了要休息一下
教育不只是传授知识更重要的是培养学生的思考能力和创造力好的老师不只是教学生记住答案更要教学生学会提问和探索每个学生都有自己的特点和优势教育的目标是帮助他们发现并发展这些优势兴趣是最好的老师只有对一件事真正感兴趣才能做得好
旅行可以让人放松心情开阔眼界去不同的地方体验不同的文化和生活方式是一件很有意义的事情在旅途中我们会遇到各种各样的人和事这些经历会让我们成长不过旅行前要做好准备计划好路线和预算安全第一不要去危险的地方
时间是最公平的资源每个人每天都只有二十四小时关键在于你怎么利用它有人用它来学习有人用它来工作有人用它来休息也有人浪费了它珍惜时间就是珍惜生命不要把时间花在无意义的事情上做有意义的事让每一天都过得充实
朋友是人生中重要的财富好的朋友会在你困难的时候帮助你开心的时候和你分享快乐友谊需要用心经营多关心身边的人学会感恩和付出真正的朋友不在于数量而在于质量一两个知心朋友比一百个普通朋友更有意义
音乐可以陶冶情操缓解压力开心的时候听欢快的歌难过的时候听舒缓的旋律每个人的喜好不同但音乐的魅力是共通的学习一种乐器也是不错的选择可以锻炼大脑提高记忆力更重要的是能给自己和身边的人带来快乐
运动对身体健康非常重要跑步游泳打球都是很好的运动方式选择自己喜欢的运动坚持下去不要半途而废运动不仅能强身健体还能让人心情愉快释放压力每天运动一小时健康生活一辈子
梦想是人生的动力有梦想的人才有前进的方向但梦想不能只是空想要付诸行动一步一个脚印地去实现它路上可能会遇到困难和挫折但只要不放弃就一定能成功成功的路上并不拥挤因为坚持下来的人不多
做饭是一件有趣的事情自己动手做出的饭菜总是特别香从简单的菜开始学起慢慢尝试更复杂的菜品注意营养搭配不仅要好吃还要健康和家人一起吃饭是最幸福的时光餐桌上的欢声笑语是生活中最美好的回忆
阅读是获取知识最直接的方式书籍是人类进步的阶梯选择好书很重要好的书可以让人受益匪浅读书时要学会思考不能只是被动地接受要有自己的判断做笔记是一个好习惯可以帮助记忆和理解
环保是每个人的责任节约用水节约用电减少使用塑料袋垃圾分类这些小事都能为保护环境出一份力地球是我们共同的家园如果不好好保护它将来我们的后代就没有好的生活环境了从现在开始从小事做起
沟通是人际交往中最重要的技能学会表达自己的想法也要学会倾听别人的意见好的沟通可以消除误解增进感情坏沟通则会造成矛盾和冲突说话之前先想一想这句话会不会伤害到别人用善意和尊重去对待每一个人
春天来了万物复苏花儿开了草儿绿了小鸟在枝头唱歌一切都充满了生机和希望夏天热的时候可以吃冰激凌游泳秋天是收获的季节果园里果实累累冬天虽然冷但可以滑雪打雪仗每个季节都有它独特的美
思考是人类区别于其他动物的重要能力遇到问题不要急于求成要静下心来好好想一想为什么会这样应该怎么办只有经过深入思考才能找到最好的解决办法不要人云亦云要有自己的独立思考能力
`
const enCorpus = `
the weather is nice today we can go out for a walk the sun is shining and the birds are singing it is a beautiful day I want to learn more about artificial intelligence and how it works machine learning is a subset of ai that focuses on training models with data large language models can generate text by predicting the next word I think this technology will change the world in many ways it is important to understand both the capabilities and limitations of these models the future of technology is exciting and full of possibilities we should embrace change while being mindful of the risks education is the key to success reading books is a great way to learn new things health is the most important wealth we should eat well exercise regularly and get enough sleep
`

// ============================================================
//  统计语言模型 —— 线性插值 n-gram
// ============================================================
type FreqMap = Map<string, number>

function buildNgram(text: string, n: number): Map<string, FreqMap> {
  const map = new Map<string, FreqMap>()
  for (let i = 0; i <= text.length - n; i++) {
    const key = text.slice(i, i + n - 1)
    const next = text[i + n - 1]
    if (!key || !next) continue
    if (!map.has(key)) map.set(key, new Map())
    const inner = map.get(key)!
    inner.set(next, (inner.get(next) || 0) + 1)
  }
  return map
}

function buildUnigram(text: string): FreqMap {
  const map: FreqMap = new Map()
  for (const ch of text) {
    if (/\s/.test(ch)) continue
    map.set(ch, (map.get(ch) || 0) + 1)
  }
  return map
}

// 英文按「词」切分（而非字符），否则英文候选会退化成单个字母
function enWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-zA-Z]+/).filter(Boolean)
}

function buildWordNgram(words: string[], n: number): Map<string, FreqMap> {
  const map = new Map<string, FreqMap>()
  for (let i = 0; i <= words.length - n; i++) {
    const key = words.slice(i, i + n - 1).join(' ')
    const next = words[i + n - 1]
    if (!key || !next) continue
    if (!map.has(key)) map.set(key, new Map())
    const inner = map.get(key)!
    inner.set(next, (inner.get(next) || 0) + 1)
  }
  return map
}

function buildWordUnigram(words: string[]): FreqMap {
  const map: FreqMap = new Map()
  for (const w of words) map.set(w, (map.get(w) || 0) + 1)
  return map
}

const trigrams = buildNgram(corpus, 3)
const bigrams = buildNgram(corpus, 2)
const unigrams = buildUnigram(corpus)
const enWordList = enWords(enCorpus)
const enWordTrigrams = buildWordNgram(enWordList, 3)
const enWordBigrams = buildWordNgram(enWordList, 2)
const enWordUnigrams = buildWordUnigram(enWordList)

const LAMBDA3 = 0.55
const LAMBDA2 = 0.30
const LAMBDA1 = 0.15

function normalize(counts: FreqMap): Map<string, number> {
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const probs = new Map<string, number>()
  for (const [k, v] of counts) probs.set(k, v / total)
  return probs
}

function topN(probs: Map<string, number>, n: number): Candidate[] {
  return [...probs.entries()]
    .map(([text, prob]) => ({ text, prob }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, n)
}

const uniProbs = normalize(unigrams)
const enUniProbs = normalize(enWordUnigrams)

// ============================================================
//  上下文规则引擎
// ============================================================
type RuleFn = (text: string) => Candidate[] | null

const contextRules: RuleFn[] = [
  (text) => {
    if (text.endsWith('的') && !text.endsWith('目的') && !text.endsWith('地的')) {
      return blend([
        { text: '人', w: 3 }, { text: '时候', w: 3 }, { text: '事情', w: 2 },
        { text: '地方', w: 2 }, { text: '方法', w: 2 }, { text: '问题', w: 2 },
        { text: '孩子', w: 1 }, { text: '方式', w: 1 }, { text: '能力', w: 1 },
        { text: '书', w: 1 }, { text: '话', w: 1 }, { text: '东西', w: 1 },
        { text: '心', w: 1 }, { text: '事', w: 1 }, { text: '感觉', w: 1 }
      ])
    }
    return null
  },
  (text) => {
    if (text.endsWith('了') && !text.endsWith('了解')) {
      return blend([
        { text: '，', w: 3 }, { text: '。', w: 3 }, { text: '一', w: 2 },
        { text: '很', w: 2 }, { text: '就', w: 2 }, { text: '也', w: 1 },
        { text: '后', w: 1 }, { text: '的话', w: 1 }, { text: '以后', w: 1 },
        { text: '很多', w: 1 }, { text: '一些', w: 1 }, { text: '点', w: 1 }
      ])
    }
    return null
  },
  (text) => {
    if (text.endsWith('不') && !text.endsWith('部分') && !text.endsWith('不止')) {
      return blend([
        { text: '是', w: 3 }, { text: '能', w: 3 }, { text: '会', w: 3 },
        { text: '到', w: 2 }, { text: '要', w: 2 }, { text: '过', w: 2 },
        { text: '好', w: 2 }, { text: '同', w: 1 }, { text: '仅', w: 1 },
        { text: '如', w: 1 }, { text: '管', w: 1 }, { text: '用', w: 1 },
        { text: '对', w: 1 }, { text: '行', w: 1 }
      ])
    }
    return null
  },
  (text) => {
    if (text.endsWith('是') && !text.endsWith('但是') && !text.endsWith('不是') && !text.endsWith('总是')) {
      return blend([
        { text: '的', w: 3 }, { text: '一', w: 2 }, { text: '不', w: 2 },
        { text: '个', w: 2 }, { text: '因为', w: 1 }, { text: '什么', w: 1 },
        { text: '为', w: 1 }, { text: '在', w: 1 }, { text: '有', w: 1 },
        { text: '要', w: 1 }, { text: '很', w: 1 }, { text: '最', w: 1 }
      ])
    }
    return null
  },
  (text) => {
    if (text.endsWith('在') && !text.endsWith('现在') && !text.endsWith('存在') && !text.endsWith('实在')) {
      return blend([
        { text: '一', w: 2 }, { text: '家', w: 2 }, { text: '那', w: 2 },
        { text: '这', w: 2 }, { text: '做', w: 2 }, { text: '上', w: 2 },
        { text: '下', w: 1 }, { text: '里', w: 1 }, { text: '外', w: 1 },
        { text: '一起', w: 1 }, { text: '学习', w: 1 }, { text: '说', w: 1 }
      ])
    }
    return null
  },
  (text) => {
    if (text.endsWith('会') && !text.endsWith('社会') && !text.endsWith('机会') && !text.endsWith('学会')) {
      return blend([
        { text: '有', w: 3 }, { text: '是', w: 2 }, { text: '不', w: 2 },
        { text: '让', w: 1 }, { text: '变', w: 1 }, { text: '更', w: 1 },
        { text: '做', w: 1 }, { text: '来', w: 1 }, { text: '去', w: 1 },
        { text: '说', w: 1 }, { text: '出', w: 1 }, { text: '给', w: 1 }
      ])
    }
    return null
  },
  (text) => {
    if (text.endsWith('很') && !text.endsWith('很多')) {
      return blend([
        { text: '好', w: 3 }, { text: '重要', w: 2 }, { text: '快', w: 2 },
        { text: '大', w: 2 }, { text: '多', w: 2 }, { text: '难', w: 1 },
        { text: '美', w: 1 }, { text: '舒服', w: 1 }, { text: '快乐', w: 1 },
        { text: '安静', w: 1 }, { text: '暖和', w: 1 }, { text: '棒', w: 1 }
      ])
    }
    return null
  },
  (text) => {
    if (text.endsWith('一') && !text.endsWith('一些') && !text.endsWith('一定') && !text.endsWith('一起') && !text.endsWith('一般')) {
      return blend([
        { text: '个', w: 3 }, { text: '天', w: 2 }, { text: '定', w: 2 },
        { text: '些', w: 2 }, { text: '起', w: 2 }, { text: '本', w: 1 },
        { text: '种', w: 1 }, { text: '次', w: 1 }, { text: '步', w: 1 },
        { text: '件', w: 1 }, { text: '点', w: 1 }, { text: '般', w: 1 }
      ])
    }
    return null
  },
  (text) => {
    if (text.endsWith('有') && !text.endsWith('没有') && !text.endsWith('拥有') && !text.endsWith('所有')) {
      return blend([
        { text: '很', w: 2 }, { text: '一', w: 2 }, { text: '什', w: 2 },
        { text: '的', w: 2 }, { text: '些', w: 1 }, { text: '个', w: 1 },
        { text: '意', w: 1 }, { text: '关', w: 1 }, { text: '人', w: 1 },
        { text: '好处', w: 1 }, { text: '可能', w: 1 }, { text: '机会', w: 1 }
      ])
    }
    return null
  },
  (text) => {
    if (text.endsWith('和') && !text.endsWith('温和') && !text.endsWith('饱和') && !text.endsWith('柔和')) {
      return blend([
        { text: '我', w: 2 }, { text: '他', w: 2 }, { text: '家', w: 2 },
        { text: '学', w: 1 }, { text: '工', w: 1 }, { text: '生', w: 1 },
        { text: '自', w: 1 }, { text: '好', w: 1 }, { text: '谐', w: 1 },
        { text: '别人', w: 1 }, { text: '家人', w: 1 }, { text: '同事', w: 1 }
      ])
    }
    return null
  },
]

function blend(items: { text: string; w: number }[]): Candidate[] {
  const total = items.reduce((s, i) => s + i.w, 0)
  return items
    .map(i => ({ text: i.text, prob: i.w / total }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 6)
}

// ============================================================
//  n-gram 预测函数
// ============================================================
function predictNgram(text: string): Candidate[] {
  if (!text || text.length === 0) return []

  const isEnglish = /^[a-zA-Z\s.,!?;'"]+$/.test(text.trim())
  return isEnglish ? predictEnglishNgram(text) : predictChineseNgram(text)
}

/** 中文按「字」插值：trigram + bigram + unigram */
function predictChineseNgram(text: string): Candidate[] {
  const tri = trigrams
  const bi = bigrams
  const uni = uniProbs

  const scores = new Map<string, number>()
  const candidatesSet = new Set<string>()
  const last2 = text.length >= 2 ? text.slice(-2) : ''
  const last1 = text.slice(-1)

  if (last2 && tri.has(last2)) {
    for (const ch of tri.get(last2)!.keys()) candidatesSet.add(ch)
  }
  if (last1 && bi.has(last1)) {
    for (const ch of bi.get(last1)!.keys()) candidatesSet.add(ch)
  }
  for (const ch of topN(uni, 15).map(c => c.text)) {
    candidatesSet.add(ch)
  }

  for (const ch of candidatesSet) {
    let p3 = 0, p2 = 0, p1 = 0
    if (last2 && tri.has(last2)) {
      const inner = tri.get(last2)!
      const total = [...inner.values()].reduce((a, b) => a + b, 0)
      p3 = (inner.get(ch) || 0) / total
    }
    if (last1 && bi.has(last1)) {
      const inner = bi.get(last1)!
      const total = [...inner.values()].reduce((a, b) => a + b, 0)
      p2 = (inner.get(ch) || 0) / total
    }
    p1 = uni.get(ch) || 0
    const score = LAMBDA3 * p3 + LAMBDA2 * p2 + LAMBDA1 * p1
    if (score > 0.001) scores.set(ch, score)
  }

  let ruleCandidates: Candidate[] | null = null
  for (const rule of contextRules) {
    ruleCandidates = rule(text)
    if (ruleCandidates) break
  }

  let result: Candidate[]
  if (ruleCandidates && scores.size < 4) {
    const ruleTexts = new Set(ruleCandidates.map(c => c.text))
    const extra = topN(scores, 6).filter(c => !ruleTexts.has(c.text)).slice(0, 2)
    result = [...ruleCandidates.slice(0, 4), ...extra]
  } else if (ruleCandidates && scores.size >= 4) {
    result = topN(scores, 6)
    if (!result.some(c => c.text === ruleCandidates![0].text)) {
      result.splice(1, 0, ruleCandidates![0])
      result = result.slice(0, 6)
    }
  } else if (scores.size > 0) {
    result = topN(scores, 6)
  } else if (ruleCandidates) {
    result = ruleCandidates
  } else {
    result = cnFallback()
  }

  const total = result.reduce((s, c) => s + c.prob, 0)
  if (total > 0) result = result.map(c => ({ text: c.text, prob: c.prob / total }))
  return result
}

/** 英文按「词」插值：trigram + bigram + unigram，候选为完整单词 */
function predictEnglishNgram(text: string): Candidate[] {
  const words = enWords(text)
  if (words.length === 0) return enFallback()

  const tri = enWordTrigrams
  const bi = enWordBigrams
  const uni = enUniProbs

  const scores = new Map<string, number>()
  const candidatesSet = new Set<string>()
  const last2 = words.length >= 2 ? words.slice(-2).join(' ') : ''
  const last1 = words[words.length - 1]

  if (last2 && tri.has(last2)) {
    for (const w of tri.get(last2)!.keys()) candidatesSet.add(w)
  }
  if (last1 && bi.has(last1)) {
    for (const w of bi.get(last1)!.keys()) candidatesSet.add(w)
  }
  for (const w of topN(uni, 15).map(c => c.text)) {
    candidatesSet.add(w)
  }

  for (const w of candidatesSet) {
    let p3 = 0, p2 = 0, p1 = 0
    if (last2 && tri.has(last2)) {
      const inner = tri.get(last2)!
      const total = [...inner.values()].reduce((a, b) => a + b, 0)
      p3 = (inner.get(w) || 0) / total
    }
    if (last1 && bi.has(last1)) {
      const inner = bi.get(last1)!
      const total = [...inner.values()].reduce((a, b) => a + b, 0)
      p2 = (inner.get(w) || 0) / total
    }
    p1 = uni.get(w) || 0
    const score = LAMBDA3 * p3 + LAMBDA2 * p2 + LAMBDA1 * p1
    if (score > 0.001) scores.set(w, score)
  }

  let result: Candidate[]
  if (scores.size > 0) {
    result = topN(scores, 6)
  } else {
    result = enFallback()
  }

  // 英文候选带前导空格，保证拼接时词与词之间有间隔
  result = result.map(c => ({
    text: c.text.startsWith(' ') ? c.text : ' ' + c.text,
    prob: c.prob
  }))
  const total = result.reduce((s, c) => s + c.prob, 0)
  if (total > 0) result = result.map(c => ({ text: c.text, prob: c.prob / total }))
  return result
}

function cnFallback(): Candidate[] {
  return blend([
    { text: '的', w: 3 }, { text: '，', w: 3 }, { text: '。', w: 2 },
    { text: '了', w: 2 }, { text: '是', w: 2 }, { text: '在', w: 2 },
    { text: '和', w: 1 }, { text: '也', w: 1 }, { text: '就', w: 1 },
    { text: '都', w: 1 }, { text: '不', w: 1 }, { text: '有', w: 1 }
  ])
}

function enFallback(): Candidate[] {
  return [
    { text: ' the', prob: 0.20 }, { text: ' and', prob: 0.15 },
    { text: ' is', prob: 0.15 }, { text: ' to', prob: 0.12 },
    { text: ' of', prob: 0.10 }, { text: ' in', prob: 0.08 }
  ]
}

// ============================================================
//  预设短语
// ============================================================
const presetDict: Record<string, Candidate[]> = {
  '今天天气很': [
    { text: '好', prob: 0.38 }, { text: '不错', prob: 0.18 },
    { text: '差', prob: 0.10 }, { text: '热', prob: 0.10 },
    { text: '冷', prob: 0.08 }, { text: '暖和', prob: 0.16 }
  ],
  '大语言模型': [
    { text: '是', prob: 0.18 }, { text: '的', prob: 0.16 },
    { text: '正在', prob: 0.18 }, { text: '可以', prob: 0.14 },
    { text: '将', prob: 0.10 }, { text: '通过', prob: 0.24 }
  ],
  '大语言模型正在': [
    { text: '改变', prob: 0.26 }, { text: '发展', prob: 0.18 },
    { text: '学习', prob: 0.14 }, { text: '生成', prob: 0.12 },
    { text: '训练', prob: 0.10 }, { text: '涌现', prob: 0.20 }
  ],
  '大语言模型正在改变': [
    { text: '世界', prob: 0.28 }, { text: '生活', prob: 0.20 },
    { text: '未来', prob: 0.18 }, { text: '教育', prob: 0.12 },
    { text: '医疗', prob: 0.10 }, { text: '工作', prob: 0.12 }
  ],
  '猫坐在': [
    { text: '垫子', prob: 0.26 }, { text: '沙发', prob: 0.20 },
    { text: '椅子', prob: 0.15 }, { text: '地上', prob: 0.12 },
    { text: '窗台', prob: 0.10 }, { text: '门口', prob: 0.17 }
  ],
  '猫坐在垫子': [
    { text: '上', prob: 0.52 }, { text: '里', prob: 0.15 },
    { text: '旁边', prob: 0.12 }, { text: '下面', prob: 0.10 },
    { text: '附近', prob: 0.11 }
  ],
  'The weather is': [
    { text: ' nice', prob: 0.22 }, { text: ' bad', prob: 0.14 },
    { text: ' sunny', prob: 0.18 }, { text: ' rainy', prob: 0.12 },
    { text: ' cold', prob: 0.12 }, { text: ' hot', prob: 0.22 }
  ],
  'I want to': [
    { text: ' learn', prob: 0.18 }, { text: ' go', prob: 0.16 },
    { text: ' eat', prob: 0.14 }, { text: ' read', prob: 0.12 },
    { text: ' sleep', prob: 0.10 }, { text: ' play', prob: 0.30 }
  ]
}

const sentenceStarters: Candidate[] = [
  { text: '我', prob: 0.18 }, { text: '他', prob: 0.12 },
  { text: '这', prob: 0.15 }, { text: '不过', prob: 0.10 },
  { text: '所以', prob: 0.08 }, { text: '但是', prob: 0.37 }
]

function predictWithPreset(text: string): Candidate[] {
  if (!text || text.length === 0) return []
  const preset = presetDict[text]
  if (preset) return preset
  const lastChar = text[text.length - 1]
  if (/[。！？.!?]/.test(lastChar)) return sentenceStarters
  return predictNgram(text)
}

// ============================================================
//  统一候选管理（兼容同步 n-gram 和异步真实模型）
// ============================================================
const candidates = ref<Candidate[]>([])
let isPredicting = false
const isInferring = ref(false) // 真实模型推理中（用于 UI 提示）
const predictionSource = ref<'model' | 'ngram' | 'none'>('none') // 上次预测来源

async function updateCandidates() {
  if (isPredicting) return
  isPredicting = true
  try {
    if (currentText.value.length === 0) {
      candidates.value = []
      predictionSource.value = 'none'
    } else if (useRealModel.value) {
      isInferring.value = true
      const result = await predictWithModel(currentText.value, () => predictWithPreset(currentText.value))
      candidates.value = result
      predictionSource.value = lastInferenceOk.value ? 'model' : 'ngram'
      isInferring.value = false
    } else {
      candidates.value = predictWithPreset(currentText.value)
      predictionSource.value = 'ngram'
    }
  } finally {
    isPredicting = false
    isInferring.value = false
  }
}

// ============================================================
//  组件状态与交互
// ============================================================
const presets = [
  { label: '今天天气很', text: '今天天气很' },
  { label: '大语言模型', text: '大语言模型' },
  { label: '猫坐在', text: '猫坐在' },
  { label: 'I want to', text: 'I want to' }
]

const currentText = ref('今天天气很')
const customInput = ref('')
const history = ref<string[]>([])
const isAutoPlaying = ref(false)
const lastSelected = ref<string | null>(null)
let autoPlayActive = false

const MAX_LENGTH = 80

const isFinished = computed(() => {
  if (!currentText.value) return false
  return /[。！？.!?]$/.test(currentText.value)
})

const isTooLong = computed(() => currentText.value.length >= MAX_LENGTH)

const engineLabel = computed(() => {
  if (useRealModel.value) return 'Qwen2.5-0.5B 真实模型'
  return 'n-gram 统计模拟'
})

async function selectCandidate(candidate: Candidate) {
  if (isTooLong.value) return
  currentText.value += candidate.text
  history.value.push(candidate.text)
  lastSelected.value = candidate.text
  nextTick(() => {
    setTimeout(() => { lastSelected.value = null }, 600)
  })
  await updateCandidates()
}

function loadPreset(text: string) {
  stopAutoPlay()
  currentText.value = text
  history.value = []
  lastSelected.value = null
  updateCandidates()
}

function applyCustomInput() {
  if (customInput.value.trim().length === 0) return
  stopAutoPlay()
  currentText.value = customInput.value.trim()
  history.value = []
  lastSelected.value = null
  customInput.value = ''
  updateCandidates()
}

function reset() {
  stopAutoPlay()
  currentText.value = '今天天气很'
  history.value = []
  lastSelected.value = null
  updateCandidates()
}

function toggleAutoPlay() {
  if (isAutoPlaying.value) stopAutoPlay()
  else startAutoPlay()
}

function nucleusSample(cands: Candidate[], p = 0.92): Candidate {
  const sorted = [...cands].sort((a, b) => b.prob - a.prob)
  let cumProb = 0
  const nucleus: Candidate[] = []
  for (const c of sorted) {
    nucleus.push(c)
    cumProb += c.prob
    if (cumProb >= p) break
  }
  const r = Math.random() * cumProb
  let acc = 0
  for (const c of nucleus) {
    acc += c.prob
    if (r <= acc) return c
  }
  return nucleus[0]
}

async function startAutoPlay() {
  if (isTooLong.value) return
  isAutoPlaying.value = true
  autoPlayActive = true

  while (autoPlayActive && !isTooLong.value) {
    if (candidates.value.length === 0) {
      stopAutoPlay()
      return
    }
    const picked = nucleusSample(candidates.value, 0.92)
    await selectCandidate(picked)
    // 真实模型推理本身有延迟，缩短额外等待；n-gram 模式加长间隔
    const delay = useRealModel.value ? 200 : 600
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  stopAutoPlay()
}

function stopAutoPlay() {
  autoPlayActive = false
  isAutoPlaying.value = false
}

onUnmounted(() => stopAutoPlay())

// 监听模型状态变化：模型加载完成或卸载时，自动刷新候选词
// 这使得即使组件在模型加载期间卸载又重新挂载，也能正确响应
watch(modelState, (newState) => {
  if (newState === 'ready' || newState === 'idle') {
    updateCandidates()
  }
})

// 初始化
updateCandidates()

function pct(p: number): string {
  return (p * 100).toFixed(0) + '%'
}
</script>

<template>
  <div class="next-token-viz">
    <!-- 头部说明 -->
    <div class="viz-header">
      <p class="viz-title">
        下一个词是什么？
        <span class="engine-badge" :class="{ real: useRealModel }">{{ engineLabel }}</span>
        <span
          v-if="useRealModel && predictionSource === 'ngram'"
          class="engine-badge warn"
          title="模型推理失败，当前使用 n-gram 模拟结果"
        >⚠ 已回退模拟</span>
        <span
          v-if="useRealModel && predictionSource === 'model'"
          class="engine-badge ok"
        >✓ 模型推理中</span>
      </p>
      <p class="viz-desc">
        这是大模型的核心动作：根据当前文本，预测下一个词的概率分布。点击候选词来"接龙"，体验"一个字一个字蹦出来"的过程。
      </p>
    </div>

    <!-- 当前文本显示 -->
    <div class="text-display" :class="{ 'text-finished': isFinished }">
      <span class="text-content">
        <span
          v-for="(char, i) in currentText"
          :key="i"
          class="text-char"
          :class="{
            'char-highlight': lastSelected && i >= currentText.length - lastSelected.length
          }"
        >{{ char }}</span>
      </span>
      <span v-if="!isFinished" class="cursor">|</span>
      <span v-if="isFinished" class="finish-badge">句末</span>
    </div>

    <!-- 预设按钮 + 自定义输入 -->
    <div class="controls-row">
      <div class="preset-group">
        <span class="control-label">预设：</span>
        <button
          v-for="p in presets"
          :key="p.text"
          class="preset-btn"
          :class="{ active: currentText === p.text }"
          @click="loadPreset(p.text)"
        >{{ p.label }}</button>
      </div>
    </div>
    <div class="custom-row">
      <input
        v-model="customInput"
        class="custom-input"
        type="text"
        placeholder="或输入自己的文本..."
        @keydown.enter="applyCustomInput"
      />
      <button class="action-btn" @click="applyCustomInput">设置</button>
    </div>

    <!-- 候选词概率分布 -->
    <div v-if="isInferring" class="candidates-section inferring">
      <div class="section-label">
        <span class="thinking-dot"></span>
        模型推理中...
      </div>
    </div>
    <div v-else-if="candidates.length > 0 && !isTooLong" class="candidates-section">
      <div class="section-label">
        候选下一个词
        <span class="section-hint">（点击选择，或开启自动生成）</span>
      </div>
      <div class="candidates-list">
        <button
          v-for="(c, i) in candidates"
          :key="c.text + i"
          class="candidate-row"
          @click="selectCandidate(c)"
        >
          <span class="candidate-text">{{ c.text === ' ' ? '␣' : c.text }}</span>
          <span class="candidate-bar-wrapper">
            <span class="candidate-bar" :style="{ width: (c.prob * 100) + '%' }"></span>
          </span>
          <span class="candidate-prob">{{ pct(c.prob) }}</span>
        </button>
      </div>
    </div>

    <!-- 文本过长提示 -->
    <div v-if="isTooLong" class="too-long-hint">
      文本已较长，请点击"重置"重新开始。
    </div>

    <!-- 句子结束提示 -->
    <div v-if="isFinished && candidates.length > 0" class="finished-hint">
      句子已结束。下面的候选词是下一个句子的可能开头。
    </div>

    <!-- 操作按钮 -->
    <div class="action-row">
      <button
        class="action-btn primary"
        :class="{ playing: isAutoPlaying }"
        :disabled="isTooLong || modelState === 'loading'"
        @click="toggleAutoPlay"
      >
        {{ isAutoPlaying ? '⏸ 暂停' : '▶ 自动生成' }}
      </button>
      <button class="action-btn" @click="reset">↺ 重置</button>
    </div>

    <!-- 真实模型面板 -->
    <div class="model-panel">
      <!-- idle: 加载按钮 + 使用说明 -->
      <template v-if="modelState === 'idle'">
        <details class="model-notice">
          <summary>使用真实模型前请阅读</summary>
          <div class="notice-body">
            <p><strong>将下载什么？</strong>Qwen2.5-0.5B-Instruct 模型的 4-bit 量化版本（ONNX 格式），包含模型权重和分词器，共约 <strong>512MB</strong>。首次加载需要下载，后续访问由浏览器缓存，无需重复下载。</p>
            <p><strong>文件存储在哪里？</strong>模型文件存储在<em>当前浏览器的 Cache Storage</em> 中（并非电脑的普通文件夹）。每个浏览器独立缓存，互不共享。换浏览器或换电脑都需要重新下载。</p>
            <p><strong>如何删除缓存文件？</strong>方式一：按 F12 → Application → Cache Storage → 右键删除对应条目。方式二：浏览器设置 → 清除浏览数据 → 勾选"缓存的图片和文件" → 清除。方式三：点击下方"卸载模型"不会删除缓存，仅释放内存；要彻底删除请用前两种方式。</p>
            <p><strong>注意事项：</strong>① 建议使用 Chrome 或 Edge 最新版浏览器（需要 WebGPU 或 WASM 支持）。② 国内网络请保持"ModelScope 代理"勾选。③ 加载和推理均在浏览器本地完成，不会向服务器发送你的输入文本。④ 0.5B 参数的小模型生成质量有限，主要用于演示"预测下一个 token"的原理。</p>
          </div>
        </details>
        <div class="source-toggle">
          <label class="toggle-label">
            <input type="checkbox" v-model="useMirror" />
            <span>通过 ModelScope 代理下载（推荐，解决 CORS 和网络问题）</span>
          </label>
          <span class="toggle-hint">{{ useMirror ? '当前：ModelScope 代理' : '当前：直连 HuggingFace' }}</span>
        </div>
        <button class="model-btn" @click="loadRealModel">
          🤖 加载真实模型（Qwen2.5-0.5B，约 512MB）
        </button>
      </template>

      <!-- loading: 进度条 -->
      <template v-if="modelState === 'loading'">
        <div class="model-loading">
          <div class="loading-label">{{ modelProgress?.file || '加载中...' }}</div>
          <div class="progress-bar-wrapper" v-if="modelProgress">
            <div class="progress-bar" :style="{ width: modelProgress.progress + '%' }"></div>
            <span class="progress-text">{{ modelProgress.progress }}%</span>
          </div>
          <p class="model-hint">模型较大（约 512MB），请耐心等待。下载完成后浏览器会缓存，下次访问无需重复下载。</p>
        </div>
      </template>

      <!-- ready: 已加载 -->
      <template v-if="modelState === 'ready'">
        <div class="model-ready">
          <span class="ready-badge">✓ 已加载 Qwen2.5-0.5B（4-bit 量化）</span>
          <button class="model-btn-small" @click="unloadRealModel">切换回模拟</button>
        </div>
        <p class="model-hint">模型文件（约 512MB）已缓存在浏览器中。如需彻底删除：F12 → Application → Cache Storage → 删除对应条目，或清除浏览器缓存数据。</p>
      </template>

      <!-- error: 错误 + 切换源 + 重试 -->
      <template v-if="modelState === 'error'">
        <div class="model-error">
          <span class="error-text">⚠ {{ modelError }}</span>
          <div v-if="modelErrorDetail" class="error-detail">{{ modelErrorDetail }}</div>
          <div class="error-actions">
            <label class="toggle-inline">
              <input type="checkbox" v-model="useMirror" />
              <span>ModelScope 代理</span>
            </label>
            <button class="model-btn-small" @click="loadRealModel">重试</button>
          </div>
        </div>
      </template>
    </div>

    <!-- 生成历史 -->
    <div v-if="history.length > 0" class="history-section">
      <span class="history-label">生成历史：</span>
      <div class="history-chips">
        <span v-for="(token, i) in history" :key="i" class="history-chip">
          {{ token === ' ' ? '␣' : token }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.next-token-viz {
  margin: 24px 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.viz-header {
  margin-bottom: 16px;
}

.viz-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.engine-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-3);
}

.engine-badge.real {
  background: var(--vp-custom-block-tip-bg);
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-brand-1);
}

.engine-badge.warn {
  background: var(--vp-custom-block-warning-bg, #fff7e6);
  border-color: var(--vp-c-warning-1, #d4a017);
  color: var(--vp-c-warning-1, #b8860b);
}

.engine-badge.ok {
  background: var(--vp-custom-block-tip-bg, #e6f6ec);
  border-color: var(--vp-c-green-1, #3a9d50);
  color: var(--vp-c-green-1, #2d7a3e);
}

.viz-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

/* ---- 文本显示 ---- */
.text-display {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 16px 18px;
  margin-bottom: 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--vp-c-text-1);
  min-height: 56px;
}

.text-display.text-finished {
  border-color: var(--vp-c-brand-2);
}

.text-char {
  transition: background-color 0.3s ease;
  border-radius: 2px;
  padding: 0 1px;
}

.char-highlight {
  background: rgba(139, 94, 60, 0.18);
}

.dark .char-highlight {
  background: rgba(212, 165, 116, 0.2);
}

.cursor {
  font-weight: 300;
  color: var(--vp-c-brand-2);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.finish-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-bg);
  background: var(--vp-c-brand-2);
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 6px;
}

/* ---- 控制行 ---- */
.controls-row {
  margin-bottom: 10px;
}

.preset-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.control-label {
  font-size: 13px;
  color: var(--vp-c-text-2);
  margin-right: 2px;
}

.preset-btn {
  padding: 4px 12px;
  font-size: 13px;
  font-family: inherit;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-btn:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-2);
}

.preset-btn.active {
  color: var(--vp-c-bg);
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.custom-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.custom-input {
  flex: 1;
  padding: 7px 12px;
  font-size: 13px;
  font-family: inherit;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.custom-input:focus {
  border-color: var(--vp-c-brand-2);
}

/* ---- 候选词列表 ---- */
.candidates-section {
  margin-bottom: 16px;
}

.candidates-section.inferring {
  padding: 12px 0;
}

.thinking-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vp-c-brand-1, #3451b2);
  margin-right: 6px;
  animation: thinking-pulse 1s ease-in-out infinite;
}

@keyframes thinking-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin-bottom: 8px;
}

.section-hint {
  font-weight: 400;
  color: var(--vp-c-text-3);
  font-size: 12px;
}

.candidates-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.candidate-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  text-align: left;
}

.candidate-row:hover {
  border-color: var(--vp-c-brand-2);
  background: var(--vp-custom-block-tip-bg);
  transform: translateX(2px);
}

.candidate-text {
  flex-shrink: 0;
  min-width: 48px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.candidate-bar-wrapper {
  flex: 1;
  height: 22px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  overflow: hidden;
}

.candidate-bar {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--vp-c-brand-1), var(--vp-c-brand-3));
  border-radius: 4px;
  transition: width 0.4s ease;
}

.candidate-prob {
  flex-shrink: 0;
  min-width: 36px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  font-variant-numeric: tabular-nums;
}

/* ---- 提示信息 ---- */
.too-long-hint,
.finished-hint {
  padding: 10px 14px;
  margin-bottom: 16px;
  font-size: 13px;
  border-radius: 6px;
}

.too-long-hint {
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px dashed var(--vp-c-border);
}

.finished-hint {
  color: var(--vp-c-brand-1);
  background: var(--vp-custom-block-tip-bg);
  border: 1px solid var(--vp-c-brand-2);
}

/* ---- 操作按钮 ---- */
.action-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.action-btn {
  padding: 8px 18px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 600;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-brand-1);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.primary {
  color: var(--vp-c-bg);
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.action-btn.primary:hover {
  background: var(--vp-c-brand-2);
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-bg);
}

.action-btn.primary.playing {
  background: var(--vp-c-brand-3);
  border-color: var(--vp-c-brand-3);
}

/* ---- 真实模型面板 ---- */
.model-panel {
  padding: 12px 14px;
  margin-bottom: 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.model-notice {
  margin-bottom: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  overflow: hidden;
}

.model-notice summary {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  cursor: pointer;
  background: var(--vp-c-bg-soft);
  user-select: none;
}

.model-notice summary:hover {
  background: var(--vp-c-bg-mute);
}

.notice-body {
  padding: 10px 14px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.notice-body p {
  margin: 0 0 8px 0;
}

.notice-body p:last-child {
  margin-bottom: 0;
}

.notice-body strong {
  color: var(--vp-c-text-1);
}

.notice-body em {
  color: var(--vp-c-brand-1);
  font-style: normal;
}

.model-btn {
  width: 100%;
  padding: 10px 16px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: var(--vp-custom-block-tip-bg);
  border: 1px solid var(--vp-c-brand-2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.model-btn:hover {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
}

.model-btn-small {
  padding: 4px 12px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.model-btn-small:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-2);
}

.model-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vp-c-text-3);
}

.model-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading-label {
  font-size: 13px;
  color: var(--vp-c-text-2);
  word-break: break-all;
}

.progress-bar-wrapper {
  position: relative;
  height: 20px;
  background: var(--vp-c-bg-soft);
  border-radius: 6px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--vp-c-brand-1), var(--vp-c-brand-3));
  border-radius: 6px;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  font-variant-numeric: tabular-nums;
}

.model-ready {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.ready-badge {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

.model-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.error-text {
  font-size: 13px;
  color: var(--vp-custom-block-danger-border, #b05046);
}

.error-detail {
  font-size: 11px;
  line-height: 1.4;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
  padding: 6px 10px;
  border-radius: 4px;
  word-break: break-all;
  max-height: 60px;
  overflow-y: auto;
}

/* ---- 源切换 ---- */
.source-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  user-select: none;
}

.toggle-label input,
.toggle-inline input {
  width: 14px;
  height: 14px;
  accent-color: var(--vp-c-brand-1);
  cursor: pointer;
}

.toggle-hint {
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.error-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toggle-inline {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  user-select: none;
}

/* ---- 生成历史 ---- */
.history-section {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
}

.history-label {
  font-size: 12px;
  color: var(--vp-c-text-3);
  flex-shrink: 0;
  line-height: 24px;
}

.history-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.history-chip {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  color: var(--vp-c-text-2);
}

/* ---- 移动端 ---- */
@media (max-width: 480px) {
  .next-token-viz {
    padding: 14px;
  }

  .text-display {
    font-size: 14px;
    padding: 12px 14px;
  }

  .candidate-text {
    min-width: 36px;
    font-size: 14px;
  }

  .candidate-prob {
    min-width: 30px;
    font-size: 12px;
  }

  .preset-btn {
    font-size: 12px;
    padding: 3px 8px;
  }
}
</style>
