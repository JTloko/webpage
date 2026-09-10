import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 使用相对路径 base，这样无论部署在 user.github.io 根目录
// 还是 user.github.io/<repo>/ 子目录下都能正常加载资源。
export default defineConfig({
  base: './',
  plugins: [react()],
})
