// 디자인 토큰 안전망. CSS 는 타입 검사도 린트도 받지 않아서, 토큰 이름을 잘못 쓰면
// 조용히 "값 없음"이 되어 화면에서만 티가 난다. 이 검사가 그 구멍을 막는다.
// 실행: node scripts/check-tokens.mjs   (pnpm lint 에 묶여 있다)
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src')

/** 확장자로 걸러 src 아래를 훑는다. */
function filesWith(extension, dir = src) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return filesWith(extension, path)
    return entry.isFile() && entry.name.endsWith(extension) ? [path] : []
  })
}

const read = (path) => ({ path: relative(root, path), text: readFileSync(path, 'utf8') })
const cssFiles = filesWith('.css').map(read)
const tsxFiles = filesWith('.tsx').map(read)
const tokens = readFileSync(join(src, 'styles', 'tokens.css'), 'utf8')

/** `--이름:` 으로 정의된 토큰 이름. */
const definitionsIn = (text) => new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]))
/** `var(--이름)` 으로 참조된 토큰 이름. */
const referencesIn = (text) => [...text.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1])

const problems = []

// 1. 참조하는 토큰은 모두 어딘가에 정의돼 있어야 한다.
const defined = new Set(cssFiles.flatMap(({ text }) => [...definitionsIn(text)]))
// 컴포넌트가 style={{ '--이름': … }} 으로 넘기는 값과, 설정에서 주입하는 사용자 지정 강조색
for (const { text } of tsxFiles) {
  for (const m of text.matchAll(/['"](--[a-z0-9-]+)['"]/gi)) defined.add(m[1])
}
defined.add('--accent-custom')
defined.add('--accent-custom-dark')

for (const { path, text } of cssFiles) {
  for (const name of new Set(referencesIn(text))) {
    if (!defined.has(name)) problems.push(`${path} 의 ${name} 은 어디에도 정의돼 있지 않아요`)
  }
}

// 2. 다크 값은 미디어쿼리용과 data-theme 용 두 곳에 따로 적어야 한다(CSS 한계).
//    한쪽만 고치면 자동 전환과 수동 전환의 색이 달라지므로 여기서 묶어 둔다.
const darkBlocks = [
  ...tokens.matchAll(/:root(?:\[data-theme='dark'\]|:not\(\[data-theme='light'\]\))\s*\{([^}]*)\}/g),
]
if (darkBlocks.length !== 2) {
  problems.push(`다크 테마 선언 블록이 2개여야 하는데 ${darkBlocks.length}개예요`)
} else {
  const [auto, manual] = darkBlocks.map((m) => [...definitionsIn(m[1])].sort())
  const onlyAuto = auto.filter((name) => !manual.includes(name))
  const onlyManual = manual.filter((name) => !auto.includes(name))
  for (const name of onlyAuto) problems.push(`${name} 이 자동 전환 블록에만 있어요`)
  for (const name of onlyManual) problems.push(`${name} 이 수동 전환 블록에만 있어요`)
}

// 3. 다크에서 바꾼 토큰은 라이트에도 기본값이 있어야 한다.
const lightNames = definitionsIn(tokens.slice(0, tokens.indexOf('@media (prefers-color-scheme: dark)')))
for (const block of darkBlocks) {
  for (const name of definitionsIn(block[1])) {
    if (!lightNames.has(name)) problems.push(`${name} 은 다크에만 있고 라이트 기본값이 없어요`)
  }
}

if (problems.length > 0) {
  for (const problem of problems) process.stderr.write(`✗ ${problem}\n`)
  process.stderr.write(`\n토큰 검사 실패: ${problems.length}건\n`)
  process.exit(1)
}

process.stdout.write(`토큰 검사 통과: CSS ${cssFiles.length}개, 정의된 토큰 ${defined.size}개\n`)
