import type { Reference, VerifyResult, WorkRecord } from '../types'
import { authorAppears, normalizeTitle, titleSimilarity } from './similarity'

/** Crossref polite pool 标识，换成你自己的邮箱可获得更稳定的配额 */
const MAILTO = 'ref-check@example.com'

const VERIFIED_THRESHOLD = 0.82
const CANDIDATE_THRESHOLD = 0.62

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getJSON(url: string, timeoutMs = 15000, attempt = 0): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    if (res.status === 404) return null
    // 429/5xx 是限流或临时故障，退避后重试
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      clearTimeout(timer)
      const retryAfter = Number(res.headers.get('retry-after'))
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1000 * 2 ** attempt + Math.random() * 500
      await sleep(Math.min(wait, 10000))
      return getJSON(url, timeoutMs, attempt + 1)
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function crossrefToRecord(item: any): WorkRecord | null {
  const title = Array.isArray(item?.title) ? item.title[0] : item?.title
  if (!title) return null
  const parts =
    item['published-print']?.['date-parts']?.[0] ??
    item['published-online']?.['date-parts']?.[0] ??
    item.issued?.['date-parts']?.[0]
  return {
    source: 'Crossref',
    title: String(title),
    authors: (item.author ?? [])
      .map((a: any) => [a.given, a.family].filter(Boolean).join(' '))
      .filter(Boolean),
    year: parts?.[0],
    container: Array.isArray(item['container-title'])
      ? item['container-title'][0]
      : item['container-title'],
    doi: item.DOI,
    url: item.DOI ? `https://doi.org/${item.DOI}` : item.URL,
  }
}

function openalexToRecord(item: any): WorkRecord | null {
  if (!item?.title && !item?.display_name) return null
  return {
    source: 'OpenAlex',
    title: String(item.display_name ?? item.title),
    authors: (item.authorships ?? [])
      .map((a: any) => a.author?.display_name)
      .filter(Boolean),
    year: item.publication_year,
    container: item.primary_location?.source?.display_name,
    doi: item.doi?.replace(/^https?:\/\/doi\.org\//, ''),
    url: item.doi ?? item.id,
  }
}

async function queryCrossrefByDoi(doi: string): Promise<WorkRecord | null> {
  const data = await getJSON(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${MAILTO}`,
  )
  return data?.message ? crossrefToRecord(data.message) : null
}

async function queryCrossref(q: string): Promise<WorkRecord[]> {
  const url =
    `https://api.crossref.org/works?rows=5&mailto=${MAILTO}` +
    `&select=title,author,issued,published-print,published-online,container-title,DOI,URL` +
    `&query.bibliographic=${encodeURIComponent(q.slice(0, 500))}`
  const data = await getJSON(url)
  return (data?.message?.items ?? [])
    .map(crossrefToRecord)
    .filter(Boolean) as WorkRecord[]
}

async function queryOpenAlex(q: string): Promise<WorkRecord[]> {
  const url =
    `https://api.openalex.org/works?per-page=5&mailto=${MAILTO}` +
    `&search=${encodeURIComponent(q.slice(0, 350))}`
  const data = await getJSON(url)
  return (data?.results ?? [])
    .map(openalexToRecord)
    .filter(Boolean) as WorkRecord[]
}

/** 对候选打分，返回最佳匹配 */
function pickBest(
  ref: Reference,
  candidates: WorkRecord[],
): { record: WorkRecord; score: number } | null {
  let best: { record: WorkRecord; score: number } | null = null
  const rawNorm = normalizeTitle(ref.raw)
  // 中英对照条目要同时和中文题名、英文译名比对，取较高者
  const refTitles = [ref.title, ref.altTitle].filter(Boolean) as string[]
  if (!refTitles.length) refTitles.push(ref.raw)

  for (const c of candidates) {
    let score = Math.max(...refTitles.map((t) => titleSimilarity(t, c.title)))
    // 标题解析可能失败：若原文整段包含数据库标题，视为强证据
    const cNorm = normalizeTitle(c.title)
    if (cNorm.length >= 12 && rawNorm.includes(cNorm)) score = Math.max(score, 0.92)

    // 年份与作者作为判别项：相符加分，明显不符则扣分。
    // 否则「同名/改名论文」（如同题的后续综述）会盖过真正被引的那一篇。
    if (ref.year && c.year) {
      const diff = Math.abs(ref.year - c.year)
      if (diff <= 1) score += 0.05
      else if (diff <= 3) score -= 0.1
      else score -= 0.25
    }
    if (c.authors.length) {
      score += authorAppears(c.authors, ref.raw) ? 0.05 : -0.15
    }
    score = Math.max(0, Math.min(score, 1))
    if (!best || score > best.score) best = { record: c, score }
  }
  return best
}

/** 比对细节，找出不一致之处 */
function findIssues(ref: Reference, rec: WorkRecord): string[] {
  const issues: string[] = []
  if (ref.year && rec.year && ref.year !== rec.year) {
    issues.push(`年份不符：原文 ${ref.year}，数据库为 ${rec.year}`)
  }
  if (rec.authors.length && !authorAppears(rec.authors, ref.raw)) {
    issues.push(`作者存疑：数据库记录为 ${rec.authors.slice(0, 3).join(', ')}`)
  }
  if (ref.doi && rec.doi && ref.doi.toLowerCase() !== rec.doi.toLowerCase()) {
    issues.push(`DOI 不符：数据库为 ${rec.doi}`)
  }
  return issues
}

export async function verifyReference(ref: Reference): Promise<VerifyResult> {
  try {
    // 1) 有 DOI 直接解析，最可靠
    if (ref.doi) {
      const rec = await queryCrossrefByDoi(ref.doi)
      if (rec) {
        // 标题解析可能不准，用「原文是否包含数据库标题」作为兜底判据
        const score = Math.max(
          titleSimilarity(ref.title ?? ref.raw, rec.title),
          normalizeTitle(ref.raw).includes(normalizeTitle(rec.title)) ? 0.95 : 0,
        )
        const issues = findIssues(ref, rec)
        if (score < CANDIDATE_THRESHOLD) {
          issues.unshift(`DOI 指向的文献标题与原文差异较大：《${rec.title}》`)
        }
        return {
          status: issues.length ? 'mismatch' : 'verified',
          score,
          match: rec,
          issues: issues.length ? issues : undefined,
        }
      }
      // DOI 解析不到，继续走标题检索
    }

    // 2) 书目检索。中英对照条目优先用英文译名——中文题名在这两个库里几乎检索不到
    const queries = [ref.altTitle, ref.title, ref.raw].filter(Boolean) as string[]
    const primary = queries[0]

    let best = pickBest(ref, await queryCrossref(primary))

    // 3) Crossref 不理想时用 OpenAlex 补一次（中文文献尤其需要）
    if (!best || best.score < VERIFIED_THRESHOLD) {
      const alt = pickBest(ref, await queryOpenAlex(primary))
      if (alt && (!best || alt.score > best.score)) best = alt
    }

    // 4) 仍不理想且存在中英双题名时，换另一个题名再试一次
    if ((!best || best.score < VERIFIED_THRESHOLD) && queries[1] && queries[1] !== primary) {
      const alt = pickBest(ref, await queryCrossref(queries[1]))
      if (alt && (!best || alt.score > best.score)) best = alt
    }

    if (!best || best.score < CANDIDATE_THRESHOLD) {
      return {
        status: 'not_found',
        score: best?.score,
        message:
          ref.lang === 'zh'
            ? '开放数据库中未收录，中文文献请点击右侧链接到知网人工确认'
            : '开放数据库中未找到匹配记录，该文献可能不存在或信息有误',
      }
    }

    const issues = findIssues(ref, best.record)
    if (best.score >= VERIFIED_THRESHOLD && issues.length === 0) {
      return { status: 'verified', score: best.score, match: best.record }
    }
    if (best.score < VERIFIED_THRESHOLD) {
      issues.unshift(`标题仅部分匹配（相似度 ${(best.score * 100).toFixed(0)}%）`)
    }
    return {
      status: 'mismatch',
      score: best.score,
      match: best.record,
      issues,
    }
  } catch (e: any) {
    return {
      status: 'error',
      message: e?.name === 'AbortError' ? '请求超时' : String(e?.message ?? e),
    }
  }
}

/** 简单并发池：限制同时请求数，每条完成立即回调 */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      await worker(items[i], i)
    }
  })
  await Promise.all(runners)
}

/** 知网检索直达链接（仅拼 URL，不抓取） */
export function cnkiSearchUrl(ref: Reference): string {
  const kw = ref.title || ref.raw.slice(0, 60)
  return `https://kns.cnki.net/kns8s/search?crossDbcodes=CJFQ&kw=${encodeURIComponent(kw)}&korder=TI`
}

/** Web of Science 检索链接 */
export function wosSearchUrl(ref: Reference): string {
  const kw = ref.title || ref.raw.slice(0, 80)
  return `https://www.webofscience.com/wos/woscc/basic-search?q=${encodeURIComponent(kw)}`
}

/** Google Scholar 兜底链接 */
export function scholarSearchUrl(ref: Reference): string {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(ref.title || ref.raw.slice(0, 120))}`
}
