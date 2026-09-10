import { useMemo, useState } from 'react'
import { UploadZone } from './components/UploadZone'
import { ReferenceTable, STATUS_LABEL } from './components/ReferenceTable'
import { extractText } from './lib/extractText'
import { parseEntry, parseReferences } from './lib/parseReferences'
import { runPool, verifyReference } from './lib/verify'
import type { RefRow, VerifyStatus } from './types'

const FILTERS: (VerifyStatus | 'all')[] = [
  'all',
  'verified',
  'mismatch',
  'not_found',
  'error',
]

export default function App() {
  const [rows, setRows] = useState<RefRow[]>([])
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<VerifyStatus | 'all'>('all')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [warn, setWarn] = useState('')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) c[r.result.status] = (c[r.result.status] ?? 0) + 1
    return c
  }, [rows])

  function patch(id: string, result: RefRow['result']) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, result } : r)))
  }

  async function verifyAll(targets: RefRow[]) {
    setBusy(true)
    let done = 0
    await runPool(targets, 4, async (row) => {
      patch(row.id, { status: 'checking' })
      const res = await verifyReference(row)
      patch(row.id, res)
      done++
      setProgress(`正在核实 ${done}/${targets.length} 条…`)
    })
    setProgress(`核实完成，共 ${targets.length} 条`)
    setBusy(false)
  }

  /** 抽取 + 核实的公共流程 */
  async function runOn(text: string, label: string) {
    setError('')
    setWarn('')
    setRows([])
    setFilter('all')
    setFileName(label)
    setBusy(true)
    try {
      setProgress('正在抽取参考文献…')
      const refs = parseReferences(text)
      if (!refs.length) {
        setError(
          '未能识别出参考文献。请确认文档包含「参考文献 / References」章节；' +
            '若是扫描版 PDF（图片），本工具无法提取文字。可改用下方「手动粘贴」。',
        )
        setBusy(false)
        setProgress('')
        return
      }
      // 切分失败的典型症状：条目极少但每条极长
      const avgLen = refs.reduce((s, r) => s + r.raw.length, 0) / refs.length
      if (refs.length <= 2 || avgLen > 600) {
        setWarn(
          `只切分出 ${refs.length} 条、平均长度 ${Math.round(avgLen)} 字符，` +
            '疑似多条参考文献被并成了一条。请检查下表，或用「手动粘贴」把参考文献单独贴进来。',
        )
      }
      const initial: RefRow[] = refs.map((r) => ({ ...r, result: { status: 'pending' } }))
      setRows(initial)
      await verifyAll(initial)
    } catch (e: any) {
      setError(String(e?.message ?? e))
      setBusy(false)
      setProgress('')
    }
  }

  async function handleFile(file: File) {
    setError('')
    setWarn('')
    setRows([])
    setFileName(file.name)
    setBusy(true)
    try {
      const text = await extractText(file, setProgress)
      setBusy(false)
      await runOn(text, file.name)
    } catch (e: any) {
      setError(String(e?.message ?? e))
      setBusy(false)
      setProgress('')
    }
  }

  function handleEdit(id: string, raw: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const reparsed = parseEntry(raw, 0)
        return { ...r, ...reparsed, id, result: { status: 'pending' as const } }
      }),
    )
    setTimeout(() => recheck(id), 0)
  }

  function recheck(id: string) {
    setRows((prev) => {
      const row = prev.find((r) => r.id === id)
      if (row) {
        patch(id, { status: 'checking' })
        verifyReference(row).then((res) => patch(id, res))
      }
      return prev
    })
  }

  function exportCsv() {
    const head = ['序号', '参考文献原文', '状态', '匹配标题', '匹配年份', '来源', '问题']
    const lines = rows.map((r, i) =>
      [
        i + 1,
        r.raw,
        STATUS_LABEL[r.result.status].replace(/[✅⚠️❌➖]\s*/g, ''),
        r.result.match?.title ?? '',
        r.result.match?.year ?? '',
        r.result.match?.source ?? '',
        (r.result.issues ?? []).join('；') || r.result.message || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = '﻿' + [head.join(','), ...lines].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName || '参考文献'}-核实结果.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visible = filter === 'all' ? rows : rows.filter((r) => r.result.status === filter)

  return (
    <div className="wrap">
      <header>
        <h1>参考文献核实工具</h1>
        <p>
          上传论文，自动抽取参考文献并在 Crossref / OpenAlex 开放学术数据库中逐条核实，
          标出无法证实或信息有误的条目。
        </p>
      </header>

      <UploadZone onFile={handleFile} disabled={busy} />

      <div className="card">
        <button onClick={() => setPasteOpen((v) => !v)}>
          {pasteOpen ? '收起手动粘贴' : '解析不准？改为手动粘贴参考文献'}
        </button>
        {pasteOpen && (
          <div style={{ marginTop: 10 }}>
            <textarea
              style={{ minHeight: 160 }}
              placeholder={
                '直接粘贴参考文献列表，一条一行效果最好，例如：\n' +
                '[1] 王小明. 基于深度学习的中文分词方法研究[J]. 计算机学报, 2018, 41(5): 1023-1035.\n' +
                '[2] Vaswani A. Attention is all you need. NeurIPS, 2017.'
              }
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div style={{ marginTop: 8 }}>
              <button
                className="primary"
                disabled={busy || !pasteText.trim()}
                onClick={() => runOn(pasteText, '手动粘贴')}
              >
                开始核实
              </button>
            </div>
          </div>
        )}
      </div>

      {(progress || error || warn) && (
        <div className="card">
          {progress && <div className="progress">{progress}</div>}
          {warn && <div className="notice" style={{ marginTop: 8 }}>{warn}</div>}
          {error && <div className="err">{error}</div>}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="toolbar">
            <div className="summary">
              {FILTERS.map((f) => {
                const n = f === 'all' ? rows.length : (counts[f] ?? 0)
                if (f !== 'all' && n === 0) return null
                return (
                  <button
                    key={f}
                    className={`chip${filter === f ? ' active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? '全部' : STATUS_LABEL[f]} {n}
                  </button>
                )
              })}
            </div>
            <div className="spacer" />
            <button onClick={() => verifyAll(rows)} disabled={busy}>
              全部重查
            </button>
            <button className="primary" onClick={exportCsv}>
              导出 CSV
            </button>
          </div>

          <ReferenceTable rows={visible} onEdit={handleEdit} onRecheck={recheck} />
        </>
      )}

      <div className="card notice" style={{ marginTop: 20 }}>
        <strong>关于核实范围</strong>
        <ul>
          <li>
            核实基于 <b>Crossref</b> 与 <b>OpenAlex</b> 两个开放学术数据库。如需进一步确认，
            可访问{' '}
            <a href="https://www.cnki.net" target="_blank" rel="noreferrer">
              中国知网 www.cnki.net
            </a>{' '}
            或{' '}
            <a href="https://www.webofscience.com" target="_blank" rel="noreferrer">
              Web of Science www.webofscience.com
            </a>
            。
          </li>
          <li>
            中文期刊、会议论文、书籍、学位论文的收录率较低，
            <b>「未找到」不等于该文献不存在</b>，请点击条目下方链接到知网 / WoS 人工确认。
          </li>
          <li>
            PDF 参考文献解析基于启发式规则，复杂排版可能切分出错，可点「编辑」修正后重查。
          </li>
        </ul>
      </div>
    </div>
  )
}
