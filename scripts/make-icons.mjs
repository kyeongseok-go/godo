// PWA 아이콘 생성기: public/favicon.svg 의 마크를 Playwright(chromium)로 렌더링해 PNG 로 저장한다.
// 실행: node scripts/make-icons.mjs   (마크를 바꾸면 다시 실행해서 PNG 를 갱신한다)
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
const favicon = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8')

// favicon.svg 에서 배경 타일과 마크를 따로 꺼낸다. 아이콘마다 타일 모양과 마크 크기가 달라서다.
const background = favicon.match(/<rect[^>]*fill="(#[0-9a-fA-F]+)"\s*\/>/)?.[1]
const mark = favicon.match(/<g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)">([\s\S]*?)<\/g>/)
if (!background || !mark) throw new Error('favicon.svg 에서 배경과 마크를 읽지 못했어요')

const [, , , faviconScale, shapes] = mark
const MARK_WIDTH = 92
const MARK_HEIGHT = 100

/** 마크를 64x64 타일 한가운데에 놓는다. ratio 는 마크 높이가 타일 높이에서 차지하는 비율이다. */
const placed = (ratio) => {
  const scale = (64 * ratio) / MARK_HEIGHT
  const x = (64 - MARK_WIDTH * scale) / 2
  const y = (64 - MARK_HEIGHT * scale) / 2
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})">${shapes}</g>`
}

const svgOf = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${body}</svg>`

const rounded = `<rect width="64" height="64" rx="14" fill="${background}"/>`
const square = `<rect width="64" height="64" fill="${background}"/>`
const faviconRatio = (Number(faviconScale) * MARK_HEIGHT) / 64

/** 파일명, 픽셀 크기, SVG 본문. maskable 은 어떤 모양으로 잘려도 마크가 남도록 안전 영역(지름 80%) 안으로 모은다. */
const icons = [
  { file: 'icon-192.png', size: 192, body: rounded + placed(faviconRatio) },
  { file: 'icon-512.png', size: 512, body: rounded + placed(faviconRatio) },
  { file: 'maskable-512.png', size: 512, body: square + placed(0.6) },
  { file: 'apple-touch-icon.png', size: 180, body: square + placed(0.62) },
]

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  for (const { file, size, body } of icons) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svgOf(size, body)}`,
    )
    await page.screenshot({ path: join(outDir, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
    process.stdout.write(`${file} (${size}x${size})\n`)
  }
} finally {
  await browser.close()
}
