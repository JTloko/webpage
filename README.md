# 参考文献核实工具

上传论文 → 自动抽取参考文献 → 逐条在开放学术数据库中核实 → 输出带状态标记的表格。
纯前端、零后端，可直接部署到 GitHub Pages。

## 功能

- 支持 **PDF / DOCX / TXT**，文件在浏览器本地解析，**不会上传服务器**
- 自动定位「参考文献 / References」章节并切分条目（支持 `[1]` `1.` `(1)` `①` 及无编号格式）
- 逐条在 **Crossref** 与 **OpenAlex** 中检索比对，按标题相似度 + 年份 + 作者综合打分
- 四种状态：✅ 已核实 / ⚠️ 信息不符（列出具体差异）/ ❌ 未找到 / ➖ 查询失败
- 每条可手动编辑后重查；支持按状态筛选、导出 CSV
- 未命中条目提供知网 / Web of Science / Google 学术检索直达链接，供人工确认

## 本地开发

```bash
npm install
npm run dev
```

冒烟测试（校验抽取与核实逻辑，会真实请求 API）：

```bash
npx esbuild scripts/smoke.ts --bundle --platform=node --format=esm \
  --outfile=scripts/smoke.mjs --external:pdfjs-dist --external:mammoth && node scripts/smoke.mjs
```

## 部署到 GitHub Pages

1. 推送到 GitHub 仓库的 `main` 分支
2. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**
3. `.github/workflows/deploy.yml` 会自动构建并发布

`vite.config.ts` 中 `base: './'` 为相对路径，因此部署在
`user.github.io` 根目录或 `user.github.io/<repo>/` 子目录下均可正常工作。

## 建议修改

`src/lib/verify.ts` 顶部的 `MAILTO` 改成你自己的邮箱，可进入 Crossref 的
polite pool，获得更稳定的请求配额。

## 已知限制

- **不直接查询知网 / Web of Science**：二者均无公开免费 API，需机构订阅且限制跨域，
  静态站点无法访问。核实基于 Crossref + OpenAlex 两个开放数据库。
- 中文期刊、会议论文、书籍、学位论文收录率较低，**「未找到」不等于该文献不存在**。
- PDF 解析基于启发式规则，双栏、脚注式引用等复杂排版可能切分出错，可手动编辑修正。
- 扫描版（图片型）PDF 无法提取文字。
