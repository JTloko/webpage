import { parseReferences } from '../src/lib/parseReferences'
import { verifyReference } from '../src/lib/verify'

const sample = `
3. Discussion
Some concluding text here about the study and its implications for future work.

References
[1] Vaswani A, Shazeer N, Parmar N, et al. Attention is all you need[C]//Advances in Neural Information Processing Systems. 2017: 5998-6008.
[2] Devlin J, Chang M W, Lee K, et al. BERT: Pre-training of deep bidirectional transformers for language understanding. NAACL, 2019.
[3] He K, Zhang X, Ren S, et al. Deep residual learning for image recognition[C]//CVPR. 2016: 770-778.
[4] Zhang W, Li Q. Quantum-entangled neural manifolds for hyperdimensional reasoning[J]. Journal of Imaginary Science, 2021, 12(3): 45-59.
[5] 王小明, 李华. 基于深度学习的中文分词方法研究[J]. 计算机学报, 2018, 41(5): 1023-1035.
[6] LeCun Y, Bengio Y, Hinton G. Deep learning. Nature, 2015, 521(7553): 436-444. doi:10.1038/nature14539

Acknowledgements
We thank everyone.
`

const refs = parseReferences(sample)
console.log(`=== 抽取到 ${refs.length} 条 ===`)
for (const r of refs) {
  console.log(`- [${r.lang}] year=${r.year} doi=${r.doi ?? '-'}\n  title: ${r.title}`)
}

console.log('\n=== 核实 ===')
for (const r of refs) {
  const res = await verifyReference(r)
  console.log(
    `${r.id} ${res.status} score=${res.score?.toFixed(2) ?? '-'} :: ${res.match?.title ?? res.message ?? ''}`,
  )
  if (res.issues) console.log('   issues:', res.issues.join(' | '))
}
