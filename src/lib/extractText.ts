import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export type ProgressFn = (msg: string) => void

async function extractPdf(file: File, onProgress?: ProgressFn): Promise<string> {
  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`正在解析 PDF 第 ${i}/${doc.numPages} 页…`)
    const page = await doc.getPage(i)
    const content = await page.getTextContent()

    // 按 y 坐标聚合成行，避免双栏/散乱 item 顺序造成的粘连
    const lines = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items as any[]) {
      if (typeof item.str !== 'string' || !item.str.trim()) continue
      const x = item.transform[4] as number
      const y = Math.round((item.transform[5] as number) / 2) * 2
      const arr = lines.get(y) ?? []
      arr.push({ x, str: item.str })
      lines.set(y, arr)
    }
    const ordered = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean)
    pages.push(ordered.join('\n'))
  }
  await doc.destroy()
  return pages.join('\n')
}

async function extractDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
  return value
}

/** 修复 PDF 抽取常见问题：行尾连字符断词、中文行内多余空格 */
export function cleanupText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/([A-Za-z])-\n([a-z])/g, '$1$2') // 断词连字符
    .replace(/([一-鿿]) +([一-鿿])/g, '$1$2') // 中文字间空格
    .replace(/\n{3,}/g, '\n\n')
}

export async function extractText(
  file: File,
  onProgress?: ProgressFn,
): Promise<string> {
  const name = file.name.toLowerCase()
  let raw: string
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    raw = await extractPdf(file, onProgress)
  } else if (name.endsWith('.docx')) {
    onProgress?.('正在解析 Word 文档…')
    raw = await extractDocx(file)
  } else if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.bib')) {
    raw = await file.text()
  } else {
    throw new Error('暂不支持该文件格式，请上传 PDF、DOCX 或 TXT')
  }
  return cleanupText(raw)
}
