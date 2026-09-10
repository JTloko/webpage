/** 标题归一化：小写、去除标点与多余空白、全角转半角常见符号 */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[　！-～]/g, (c) =>
      c === '　' ? ' ' : String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    )
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CJK = /[一-鿿]/

/** 分词：中文按字切，西文按词切 */
function tokenize(s: string): string[] {
  const norm = normalizeTitle(s)
  if (!norm) return []
  if (CJK.test(norm)) {
    return norm.replace(/\s+/g, '').split('')
  }
  return norm.split(' ')
}

/** 归一化编辑距离相似度（针对短字符串） */
function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  // 长串上编辑距离代价高，截断保护
  const s = a.slice(0, 400)
  const t = b.slice(0, 400)
  let prev = new Array<number>(t.length + 1)
  let cur = new Array<number>(t.length + 1)
  for (let j = 0; j <= t.length; j++) prev[j] = j
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    const tmp = prev
    prev = cur
    cur = tmp
  }
  const dist = prev[t.length]
  return 1 - dist / Math.max(s.length, t.length)
}

/** token Jaccard 相似度 */
function jaccard(a: string, b: string): number {
  const A = new Set(tokenize(a))
  const B = new Set(tokenize(b))
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

/**
 * 标题相似度：取 Jaccard 与编辑距离的较大值。
 * Jaccard 对词序变化鲁棒，编辑距离对轻微拼写差异鲁棒。
 */
export function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  // 一方完整包含另一方（常见于副标题被截断）
  if (na.length > 12 && nb.length > 12 && (na.includes(nb) || nb.includes(na))) {
    return 0.95
  }
  return Math.max(jaccard(na, nb), levenshteinRatio(na, nb))
}

/** 判断候选作者姓氏是否出现在参考文献原文中 */
export function authorAppears(authors: string[], raw: string): boolean {
  const norm = normalizeTitle(raw)
  return authors.some((a) => {
    const parts = normalizeTitle(a).split(' ').filter((p) => p.length > 1)
    const surname = parts[parts.length - 1]
    return !!surname && norm.includes(surname)
  })
}
