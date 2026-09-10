export type Lang = 'zh' | 'en'

export type VerifyStatus =
  | 'pending'
  | 'checking'
  | 'verified'
  | 'mismatch'
  | 'not_found'
  | 'error'

export interface Reference {
  id: string
  /** 参考文献原文（可被用户手动编辑） */
  raw: string
  title?: string
  /** 中英对照条目中的英文译名，检索命中率通常更高 */
  altTitle?: string
  authors?: string[]
  year?: number
  journal?: string
  doi?: string
  lang: Lang
}

/** 从开放数据库取回的权威元数据 */
export interface WorkRecord {
  source: 'Crossref' | 'OpenAlex'
  title: string
  authors: string[]
  year?: number
  container?: string
  doi?: string
  url?: string
}

export interface VerifyResult {
  status: VerifyStatus
  /** 标题相似度 0~1 */
  score?: number
  match?: WorkRecord
  /** 与原文不符之处的说明 */
  issues?: string[]
  message?: string
}

export interface RefRow extends Reference {
  result: VerifyResult
}
