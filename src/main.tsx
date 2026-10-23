import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/pages.css'
import { StrictMode } from 'react'
import { z } from 'zod'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

if (import.meta.env.DEV) {
  // 개발 중에만 콘솔과 E2E에서 샘플 데이터를 넣을 수 있게 노출한다.
  void Promise.all([import('./dev/seed'), import('./store/app')]).then(([{ seedDemo }, { useApp }]) => {
    ;(window as unknown as { __godo: unknown }).__godo = { seedDemo, store: useApp }
  })
}

// CSP가 eval/new Function을 막으므로 zod의 JIT 컴파일을 끈다(검증은 그대로 동작한다).
z.config({ jitless: true })

const container = document.getElementById('root')
if (!container) throw new Error('root 요소를 찾을 수 없어요')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
