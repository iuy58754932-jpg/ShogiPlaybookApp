import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// デプロイ後に開きっぱなしのタブ/PWA で古いチャンクの動的 import が
// 失敗したとき（SW 更新で旧キャッシュが消えた直後など）、再読み込みで復旧する
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
