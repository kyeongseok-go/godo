import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// 종이색. index.html 의 theme-color(라이트), tokens.css 의 --paper 와 같은 값이다.
const PAPER = '#f4efe4'
const MAX_PRECACHE_BYTES = 5 * 1024 * 1024

// 프로덕션 CSP. 스크립트는 같은 출처 파일만 실행하고, 외부로 나가는 연결·프레임·플러그인은 전부 막는다.
// style-src 'unsafe-inline' 은 React 의 style 속성(색·위치 계산)이 쓰므로 남긴다.
// <meta> CSP 는 frame-ancestors 를 지원하지 않는다. 배포 호스트에서 응답 헤더로 따로 걸어야 한다.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
].join('; ')

// 개발 서버(Vite HMR)는 인라인 스크립트를 주입하므로 빌드 결과물에만 CSP 를 넣는다.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'pace:content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig({
  // 상대 경로로 빌드한다. GitHub Pages처럼 하위 경로(/pace/)에 올려도, 루트에 올려도 같은 빌드가 동작한다.
  base: './',
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'autoUpdate',
      // 개발 서버에서는 서비스 워커를 켜지 않는다(HMR·캐시와 충돌).
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Pace',
        short_name: 'Pace',
        description: '나만 쓰는 할 일 앱',
        lang: 'ko',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        categories: ['productivity'],
        theme_color: PAPER,
        background_color: PAPER,
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱 셸(html·js·css)과 정적 자산(글꼴·아이콘)을 설치 때 전부 내려받아 오프라인에서도 그대로 연다.
        globPatterns: ['**/*.{html,js,css,svg,png,ico,webmanifest,woff2,woff}'],
        maximumFileSizeToCacheInBytes: MAX_PRECACHE_BYTES,
        // HashRouter 라서 주소는 늘 '/#/...' 이다. 탐색 요청은 전부 앱 셸로 돌린다.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/dev/**', 'src/main.tsx', 'src/**/*.d.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
})
