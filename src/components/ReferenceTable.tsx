import { useState } from 'react'
import type { RefRow, VerifyStatus } from '../types'
import { cnkiSearchUrl, scholarSearchUrl, wosSearchUrl } from '../lib/verify'

export const STATUS_LABEL: Record<VerifyStatus, string> = {
  pending: '待核实',
  checking: '核实中…',
  verified: '✅ 已核实',
  mismatch: '⚠️ 信息不符',
  not_found: '❌ 未找到',
  error: '➖ 查询失败',
}

interface Props {
  rows: RefRow[]
  onEdit: (id: string, raw: string) => void
  onRecheck: (id: string) => void
}

export function ReferenceTable({ rows, onEdit, onRecheck }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <table>
      <thead>
        <tr>
          <th className="idx">#</th>
          <th>参考文献</th>
          <th className="status">状态</th>
          <th className="act">操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const { result: res } = r
          return (
            <tr key={r.id}>
              <td className="idx">{i + 1}</td>
              <td>
                {editing === r.id ? (
                  <>
                    <textarea
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="links" style={{ marginTop: 8 }}>
                      <button
                        className="primary"
                        onClick={() => {
                          onEdit(r.id, draft)
                          setEditing(null)
                        }}
                      >
                        保存并重新核实
                      </button>
                      <button onClick={() => setEditing(null)}>取消</button>
                    </div>
                  </>
                ) : (
                  <div className="raw">{r.raw}</div>
                )}

                {res.match && (
                  <div className="detail">
                    <div>
                      数据库记录（{res.match.source}
                      {res.score != null && `，相似度 ${(res.score * 100).toFixed(0)}%`}）：
                      《{res.match.title}》
                      {res.match.year ? ` (${res.match.year})` : ''}
                      {res.match.container ? `，${res.match.container}` : ''}
                    </div>
                    {res.match.authors.length > 0 && (
                      <div>作者：{res.match.authors.slice(0, 6).join(', ')}</div>
                    )}
                    {res.issues?.map((it, k) => (
                      <div className="issue" key={k}>
                        · {it}
                      </div>
                    ))}
                  </div>
                )}
                {!res.match && res.message && (
                  <div className="detail">{res.message}</div>
                )}

                <div className="links">
                  {res.match?.url && (
                    <a href={res.match.url} target="_blank" rel="noreferrer">
                      查看原记录
                    </a>
                  )}
                  {r.lang === 'zh' ? (
                    <a href={cnkiSearchUrl(r)} target="_blank" rel="noreferrer">
                      去知网检索
                    </a>
                  ) : (
                    <a href={wosSearchUrl(r)} target="_blank" rel="noreferrer">
                      去 WoS 检索
                    </a>
                  )}
                  <a href={scholarSearchUrl(r)} target="_blank" rel="noreferrer">
                    Google 学术
                  </a>
                </div>
              </td>
              <td className="status">
                <span className={`badge ${res.status}`}>{STATUS_LABEL[res.status]}</span>
              </td>
              <td className="act">
                <button
                  onClick={() => {
                    setEditing(r.id)
                    setDraft(r.raw)
                  }}
                  disabled={res.status === 'checking'}
                >
                  编辑
                </button>{' '}
                <button
                  onClick={() => onRecheck(r.id)}
                  disabled={res.status === 'checking'}
                >
                  重查
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
