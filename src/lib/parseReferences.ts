import type { Lang, Reference } from '../types'

/**
 * 全角标点归一化。
 * 中文期刊 PDF 普遍使用全角 ［1］ 与 ．作为编号和字段分隔符，
 * 不转成半角的话所有结构化正则都会失效（整篇被切成一条）。
 * 注意：保留 ，与 。—— 它们是正常中文标点，转半角会让原文显示变丑。
 */
export function normalizePunct(text: string): string {
  return text
    .replace(/［/g, '[')
    .replace(/］/g, ']')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/．/g, '.')
    .replace(/：/g, ':')
    .replace(/；/g, ';')
    .replace(/－/g, '-')
    .replace(/／/g, '/')
}

export const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>[\]]+/

/** 排版时 DOI 里常被插入空格，如 "10. 1016 /j.tust.2024.106008" */
const SPACED_DOI_RE = /\b10\.\s*\d{4,9}\s*\/\s*(?:[-._;()/:A-Za-z0-9]+\s*)+/

function extractDoi(body: string): string | undefined {
  const direct = body.match(DOI_RE)?.[0]
  if (direct) return direct.replace(/[.,;)\]]+$/, '')
  const spaced = body.match(SPACED_DOI_RE)?.[0]
  if (spaced) {
    const cleaned = spaced.replace(/\s+/g, '').replace(/[.,;)\]]+$/, '')
    if (DOI_RE.test(cleaned)) return cleaned
  }
  return undefined
}

/**
 * 中英对照条目：切出纯英文部分。
 * 中文期刊常在每条中文文献后附英文译名，而英文译名在 Crossref/OpenAlex
 * 里的命中率远高于中文题名，是核实这类文献的关键。
 */
export function splitEnglishPart(body: string): string | undefined {
  for (let i = 0; i < body.length; i++) {
    if (!/[A-Z]/.test(body[i])) continue
    const tail = body.slice(i)
    if (tail.length < 40) break
    const cjk = tail.match(/[一-鿿]/g)?.length ?? 0
    if (cjk / tail.length < 0.02) return tail.trim()
  }
  return undefined
}


/** 参考文献章节起始标题 */
const HEADING_RE =
  /^[\s　]*(?:\d+[.、]?\s*)?(?:references?|bibliography|works\s+cited|literature\s+cited|参\s*考\s*文\s*献|引\s*用\s*文\s*献)[\s:：]*$/i

/** 内联形式的标题（PDF 里标题可能和正文在同一行） */
const HEADING_INLINE_RE =
  /(?:^|\n)[^\S\n]*(?:\d+[.、]?\s*)?(references?|bibliography|参\s*考\s*文\s*献)[\s:：]*(?=\n|$)/gi

/** 参考文献之后可能出现的章节，用于截断 */
const TAIL_RE =
  /^[\s　]*(?:\d+[.、]?\s*)?(?:appendix(?:\s+[A-Z0-9]+)?|acknowledge?ments?|supplementary(?:\s+\w+)*|author\s+contributions?|conflicts?\s+of\s+interest|附\s*录|致\s*谢|作者简介|基金项目)\b[\s:：]*/i

/** 编号前缀：[1] / 1. / (1) / ①  */
const NUMBERED_RE = /^\s*(?:\[(\d{1,3})\]|\((\d{1,3})\)|(\d{1,3})[.、)]\s|([①-⑳]))\s*/

function isCJK(s: string): boolean {
  const cjk = s.match(/[一-鿿]/g)?.length ?? 0
  return cjk / Math.max(s.replace(/\s/g, '').length, 1) > 0.2
}

export function detectLang(s: string): Lang {
  return isCJK(s) ? 'zh' : 'en'
}

/** 从全文中截出参考文献章节 */
export function sliceReferenceSection(text: string): string {
  const lines = text.split('\n')

  // 优先找独占一行的标题，取最后一个（避免命中目录）
  let start = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (HEADING_RE.test(lines[i])) {
      // 标题后应还有足够内容
      if (lines.length - i > 3) {
        start = i + 1
        break
      }
    }
  }

  if (start === -1) {
    // 退化：找内联标题的最后一次出现
    let m: RegExpExecArray | null
    let last = -1
    HEADING_INLINE_RE.lastIndex = 0
    while ((m = HEADING_INLINE_RE.exec(text))) last = m.index + m[0].length
    if (last >= 0) return cutTail(text.slice(last))
    return ''
  }

  return cutTail(lines.slice(start).join('\n'))
}

function cutTail(section: string): string {
  const lines = section.split('\n')
  for (let i = 5; i < lines.length; i++) {
    if (TAIL_RE.test(lines[i])) return lines.slice(0, i).join('\n')
  }
  return section
}

/** 文本中的一个编号标记 */
interface Marker {
  start: number
  num: number
  /** 方括号形式 [12] 歧义最小，优先采用 */
  bracketed: boolean
}

/**
 * 在整段文本中扫描编号标记（不依赖换行）。
 * PDF 抽取常把整个参考文献表压成一行或断行混乱，此时按行切分会完全失效。
 */
function findMarkers(text: string): Marker[] {
  const re = /\[(\d{1,3})\]|(?:^|[\s.。;；)\]])(\d{1,3})[.、)]\s|([①-⑳])/g
  const out: Marker[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const num = m[1] ? +m[1] : m[2] ? +m[2] : m[3]!.charCodeAt(0) - 0x2460 + 1
    if (num < 1 || num > 999) continue
    const off = m[0].search(/[[\d①-⑳]/)
    out.push({
      start: m.index + (off < 0 ? 0 : off),
      num,
      bracketed: !!m[1],
    })
  }
  return out
}

/**
 * 从标记中挑出最长的一条「1,2,3,…」严格递增链。
 * 严格 +1 是必要的：一旦允许跳号，卷期号（如 "29 ( 3) :"）就会混入编号链，
 * 把真正的条目边界冲掉。
 */
function longestAscendingChain(markers: Marker[]): Marker[] {
  let best: Marker[] = []
  for (let i = 0; i < markers.length; i++) {
    if (markers[i].num > 2) continue // 编号应从 1（偶尔 2）起
    const chain = [markers[i]]
    let expect = markers[i].num + 1
    for (let j = i + 1; j < markers.length; j++) {
      if (markers[j].num === expect) {
        chain.push(markers[j])
        expect++
      }
    }
    if (chain.length > best.length) best = chain
  }
  return best
}

/** 基于编号标记切分（对整块无换行文本同样有效） */
function splitByMarkers(text: string): string[] {
  const all = findMarkers(text)

  // 文中若存在成链的 [n] 方括号编号，只用它们——
  // 混入 "1." "(2)" 之类的宽松形式反而会被卷期、页码干扰。
  const bracketChain = longestAscendingChain(all.filter((m) => m.bracketed))
  const chain =
    bracketChain.length >= 3 ? bracketChain : longestAscendingChain(all)

  if (chain.length < 3) return []
  return chain.map((mk, i) =>
    text.slice(mk.start, i + 1 < chain.length ? chain[i + 1].start : undefined),
  )
}

/** 无编号时的启发式切分：按「上一条已结束 + 本行像新条目开头」断开 */
function splitUnnumbered(lines: string[]): string[] {
  const entries: string[] = []
  let cur = ''
  for (const line of lines) {
    if (!cur) {
      cur = line
      continue
    }
    const endsEntry = /[.。\]]\s*$/.test(cur)
    const startsNew =
      /^[A-Z一-鿿]/.test(line) &&
      (/^[A-Z][a-z]+,\s*[A-Z]/.test(line) || // Smith, J.
        /^[一-鿿]{2,4}[,，、]/.test(line) || // 张三,
        /^[A-Z][A-Za-z'`-]+\s+[A-Z]{1,3}[,.]/.test(line))
    if (endsEntry && startsNew) {
      entries.push(cur.trim())
      cur = line
    } else {
      cur += ' ' + line
    }
  }
  if (cur.trim()) entries.push(cur.trim())
  return entries
}

/** 把章节文本切成一条条参考文献 */
export function splitEntries(section: string): string[] {
  const lines = section
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return []

  // 优先用编号标记在整段文本上切分——对「整块无换行」和「断行混乱」都稳健
  let entries = splitByMarkers(lines.join('\n'))

  if (entries.length < 3) {
    entries = splitUnnumbered(lines)
  }

  // 兜底：某条异常长说明它内部还粘着多条，再尝试按编号拆一次
  entries = entries.flatMap((e) => {
    if (e.length <= 600) return [e]
    const sub = splitByMarkers(e)
    return sub.length >= 2 ? sub : [e]
  })

  return entries
    .map((e) => e.replace(/\s+/g, ' ').trim())
    .filter((e) => e.length >= 15)
}

/** 去掉编号前缀 */
export function stripNumber(entry: string): string {
  return entry.replace(NUMBERED_RE, '').trim()
}

/** GB/T 7714 文献类型标识及其后缀，如 [J]、[C]//会议名、[M]、[D]、[EB/OL] */
const TYPE_MARKER_RE = /\s*\[[A-Z]{1,2}(?:\/[A-Z]{1,2})?\](?:\/\/.*)?$/

/** 清理标题里的类型标识、尾随标点 */
function cleanTitle(s: string): string {
  return s
    .replace(TYPE_MARKER_RE, '')
    .replace(/\s*\[[A-Z]{1,2}(?:\/[A-Z]{1,2})?\]\s*/g, ' ')
    .replace(/^[\s.,:;、]+|[\s.,:;、。]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 该片段看起来像标题吗（而不是刊名/卷期/页码块） */
function looksLikeTitle(s: string): boolean {
  const t = s.trim()
  if (t.length < 8 || t.length > 300) return false
  if (/^\d/.test(t)) return false
  // 数字占比过高说明是卷期页码
  const digits = (t.match(/\d/g)?.length ?? 0) / t.length
  return digits < 0.25
}

/** 猜测条目中的标题 */
function guessTitle(body: string, lang: Lang): string | undefined {
  // GB/T 7714 类型标识法，中英文条目都可能用（作者. 题名[J]. 刊名…）
  const marker = body.match(/[.。]\s*([^.。]{4,250}?)\s*\[[A-Z]{1,2}(?:\/[A-Z]{1,2})?\]/)
  if (marker) return cleanTitle(marker[1])

  if (lang === 'zh') {
    const parts = body.split(/[.。]\s*/).filter((p) => p.trim().length > 3)
    return cleanTitle(parts[1] ?? parts[0] ?? '') || undefined
  }

  // 英文：引号内
  const quoted = body.match(/["“”'']([^"“”]{10,250})["“”'']/)
  if (quoted) return cleanTitle(quoted[1])

  // (2017). Title.
  const afterYear = body.match(/\((?:19|20)\d{2}[a-z]?\)\.?\s*([^.?!]{10,250})[.?!]/)
  if (afterYear) return cleanTitle(afterYear[1])

  const segs = body
    .split(/(?<=[.?!])\s+/)
    .map((s) => cleanTitle(s))
    .filter(Boolean)

  // 典型顺序是「作者块. 标题. 刊名…」，第二段最可能是标题
  if (segs.length >= 2 && looksLikeTitle(segs[1])) return segs[1]

  const candidates = segs.filter(looksLikeTitle)
  candidates.sort((a, b) => b.length - a.length)
  return candidates[0]
}

function guessAuthors(body: string, lang: Lang): string[] | undefined {
  const head = body.split(/[.。]/)[0]
  if (!head || head.length > 200) return undefined
  const sep = lang === 'zh' ? /[,，、;；]/ : /,|;|\band\b|&/
  const names = head
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 40)
  return names.length ? names.slice(0, 12) : undefined
}

export function parseEntry(entry: string, index: number): Reference {
  const raw = normalizePunct(entry).replace(/\s+/g, ' ').trim()
  const body = stripNumber(raw)

  // 先切出英文译名部分，再判定语种。
  // 直接对整条判定会失败：中英对照条目里英文占了一半以上，
  // 会被误判成英文文献，进而拿不到中文题名、也给不出知网链接。
  let englishPart = splitEnglishPart(body)
  let head = body
  if (englishPart) {
    const at = body.indexOf(englishPart)
    head = at > 0 ? body.slice(0, at).trim() : ''
    // head 太短说明整条本来就是英文文献，不存在中英对照
    if (head.length < 10) {
      head = body
      englishPart = undefined
    }
  }

  const lang = detectLang(head)
  const doi = extractDoi(body)
  const year = (() => {
    const years = [...body.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => +m[1])
    const now = new Date().getFullYear()
    const valid = years.filter((y) => y >= 1800 && y <= now + 1)
    return valid.length ? valid[0] : undefined
  })()

  const journal =
    head.match(/\[[A-Z]\]\.\s*([^.,，。]{2,60})/)?.[1]?.trim() ??
    head.match(/\.\s*([A-Z][A-Za-z&\s.:'-]{5,70}),\s*\d/)?.[1]?.trim()

  const altTitle =
    lang === 'zh' && englishPart ? guessTitle(englishPart, 'en') : undefined

  return {
    id: `ref-${index + 1}`,
    raw,
    title: guessTitle(head, lang),
    altTitle: altTitle && altTitle.length >= 10 ? altTitle : undefined,
    authors: guessAuthors(head, lang),
    year,
    journal,
    doi,
    lang,
  }
}

/** 主入口：全文 → 参考文献列表 */
export function parseReferences(fullText: string): Reference[] {
  const text = normalizePunct(fullText)
  let section = sliceReferenceSection(text)
  if (!section.trim()) section = text
  return splitEntries(section).map(parseEntry)
}
