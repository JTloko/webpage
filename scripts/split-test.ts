import { splitEntries, parseReferences } from '../src/lib/parseReferences'

// 场景 A：PDF 抽取后整块无换行（用户遇到的失败模式）
const blob = `参考文献 [1] 王小明, 李华. 基于深度学习的中文分词方法研究[J]. 计算机学报, 2018, 41(5): 1023-1035. [2] 张伟. 神经网络在自然语言处理中的应用[J]. 软件学报, 2019, 30(2): 200-215. [3] Vaswani A, Shazeer N. Attention is all you need[C]//NeurIPS. 2017: 5998-6008. [4] He K, Zhang X. Deep residual learning for image recognition[C]//CVPR. 2016: 770-778. [5] 李强, 赵敏. 图卷积网络综述[J]. 计算机研究与发展, 2020, 57(9): 1800-1820.`

// 场景 B：数字点号式，且断行位置混乱
const messy = `References
1. Smith J, Doe A. A study of
things. Nature, 2015, 521:
436-444.
2. Brown B. Another
paper title here. Science, 2016.
3. Chen L, Wang Q. 深度学习综述. 计算机学报,
2017.
4. Taylor R. Final paper. Cell, 2018.`

// 场景 C：无编号（APA 风格）
const apa = `References
Smith, J. (2015). A study of things. Nature, 521, 436-444.
Brown, B. (2016). Another paper title here. Science, 350, 1-10.
Chen, L., & Wang, Q. (2017). A review of deep learning. Cell, 12, 55-70.`

for (const [name, text] of [['A 整块无换行', blob], ['B 断行混乱', messy], ['C 无编号APA', apa]] as const) {
  const refs = parseReferences(text)
  console.log(`\n=== ${name} → ${refs.length} 条 ===`)
  refs.forEach((r, i) => console.log(`  ${i + 1}. [${r.lang}] ${r.raw.slice(0, 70)}`))
}

// 场景 D：直接对已知块调用 splitEntries
console.log('\n=== D splitEntries(blob) ===', splitEntries(blob).length, '条')
