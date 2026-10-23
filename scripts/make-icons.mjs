// PWA 아이콘 생성기: public/favicon.svg 의 로고(세리프 P + 주홍 점)를 Playwright(chromium)로 렌더링해 PNG 로 저장한다.
// 실행: node scripts/make-icons.mjs   (로고를 바꾸면 다시 실행해서 PNG 를 갱신한다)
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
const favicon = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8')

// favicon 에서 배경 사각형을 뺀 로고(글자 + 점)와 배경색을 그대로 가져온다.
const glyphs = [...favicon.matchAll(/<(text|circle)\b[\s\S]*?(?:<\/text>|\/>)/g)].map((m) => m[0]).join('')
const background = favicon.match(/<rect[^>]*fill="([^"]+)"/)?.[1]
if (!glyphs || !background) throw new Error('favicon.svg 에서 로고를 읽지 못했어요')

// 로고의 대략적인 경계 상자(64x64 좌표). 맞춤 배치할 때 중심을 맞추는 데 쓴다.
const LOGO_CENTER = { x: 36.5, y: 34.5 }

/**
 * 64x64 좌표계 안에 로고를 놓는다.
 * scale 1 이면 favicon 과 같은 배치이고, 그보다 작으면 가운데로 모아 둔 형태다(maskable 용).
 */
const logo = (scale, recenter) =>
  recenter
    ? `<g transform="translate(32 32) scale(${scale}) translate(${-LOGO_CENTER.x} ${-LOGO_CENTER.y})">${glyphs}</g>`
    : `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${glyphs}</g>`

const svgOf = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${body}</svg>`

const rounded = `<rect width="64" height="64" rx="14" fill="${background}"/>`
const square = `<rect width="64" height="64" fill="${background}"/>`

/** 파일명, 픽셀 크기, SVG 본문. maskable 은 어떤 모양으로 잘려도 로고가 남도록 전체를 채우고 로고를 안전 영역(지름 80%) 안으로 모은다. */
const icons = [
  { file: 'icon-192.png', size: 192, body: rounded + logo(1, false), transparent: true },
  { file: 'icon-512.png', size: 512, body: rounded + logo(1, false), transparent: true },
  { file: 'maskable-512.png', size: 512, body: square + logo(1.05, true), transparent: false },
  { file: 'apple-touch-icon.png', size: 180, body: square + logo(1.12, true), transparent: false },
]

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  for (const { file, size, body, transparent } of icons) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svgOf(size, body)}`,
    )
    await page.screenshot({ path: join(outDir, file), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } })
    process.stdout.write(`${file} (${size}x${size})\n`)
  }
} finally {
  await browser.close()
}
