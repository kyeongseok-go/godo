import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openQuickAdd } from './helpers'

// 핵심 사용자 흐름. 매 테스트는 새 브라우저 컨텍스트(빈 IndexedDB)에서 시작한다.

async function openApp(page: Page, hash = '/inbox') {
  await page.goto(`/#${hash}`)
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible()
}

async function quickAdd(page: Page, text: string) {
  const input = await openQuickAdd(page)
  await input.fill(text)
  await page.keyboard.press('Enter')
  await expect(input).toBeHidden()
}

test.describe('할 일 기본 흐름', () => {
  test('빠른 추가로 만든 할 일이 받은편지함에 나타나고 새로고침해도 남는다', async ({ page }) => {
    await openApp(page)
    await quickAdd(page, '우유 사기')

    await expect(page.getByText('우유 사기')).toBeVisible()
    await page.reload()
    await expect(page.getByText('우유 사기')).toBeVisible()
  })

  test('자연어 날짜와 우선순위를 인식해 오늘 목록에 넣는다', async ({ page }) => {
    await openApp(page, '/today')
    await quickAdd(page, '오늘 오후 3시 팀 회의 p1')

    const row = page.locator('.task-row', { hasText: '팀 회의' })
    await expect(row).toBeVisible()
    await expect(row.getByText('15:00')).toBeVisible()
  })

  test('체크박스로 완료하면 목록에서 사라지고 되돌리기로 복구한다', async ({ page }) => {
    await openApp(page)
    await quickAdd(page, '보고서 쓰기')

    await page.getByRole('checkbox', { name: '"보고서 쓰기" 완료' }).click()
    await expect(page.locator('.task-row', { hasText: '보고서 쓰기' })).toHaveAttribute('data-done', 'true')
    await page.getByRole('button', { name: '되돌리기' }).click()
    await expect(page.locator('.task-row', { hasText: '보고서 쓰기' })).toHaveAttribute('data-done', 'false')
  })

  test('상세 패널에서 제목과 우선순위를 바꾸고 하위 작업을 추가한다', async ({ page }) => {
    await openApp(page)
    await quickAdd(page, '여행 준비')
    await page.locator('.task-row', { hasText: '여행 준비' }).click()

    const detail = page.getByRole('complementary', { name: '할 일 상세' })
    await expect(detail).toBeVisible()
    const title = detail.getByLabel('제목')
    await title.fill('제주 여행 준비')
    await title.press('Enter')

    const subtask = detail.getByPlaceholder('하위 작업 추가')
    await subtask.fill('항공권 예약')
    await subtask.press('Enter')

    await expect(detail.getByText('항공권 예약')).toBeVisible()
    await expect(page.getByText('제주 여행 준비')).toBeVisible()
  })

  test('실행 취소 단축키로 방금 추가한 할 일을 지운다', async ({ page }) => {
    await openApp(page)
    await quickAdd(page, '취소할 일')
    await expect(page.getByText('취소할 일')).toBeVisible()

    await page.locator('body').click({ position: { x: 700, y: 600 } })
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Meta+z')

    await expect(page.getByText('취소할 일')).toBeHidden()
  })
})

test.describe('키보드 조작', () => {
  test('G 다음 T로 오늘로, G 다음 I로 받은편지함으로 이동한다', async ({ page }) => {
    await openApp(page, '/upcoming')

    await page.keyboard.press('g')
    await page.keyboard.press('t')
    await expect(page).toHaveURL(/#\/today/)

    await page.keyboard.press('g')
    await page.keyboard.press('i')
    await expect(page).toHaveURL(/#\/inbox/)
  })

  test('J로 이동하고 E로 완료한다', async ({ page }) => {
    await openApp(page)
    await quickAdd(page, '첫째')
    await quickAdd(page, '둘째')

    await page.keyboard.press('j')
    await expect(page.locator('.task-row').first()).toBeFocused()
    await page.keyboard.press('e')

    await expect(page.locator('.task-row').first()).toHaveAttribute('data-done', 'true')
  })

  test('? 로 단축키 도움말을 열고 Esc로 닫는다', async ({ page }) => {
    await openApp(page)

    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: '단축키 도움말' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '단축키 도움말' })).toBeHidden()
  })
})

test.describe('명령 팔레트', () => {
  test('Cmd/Ctrl+K로 열어 화면을 이동한다', async ({ page }) => {
    await openApp(page)

    await page.keyboard.press('Control+k')
    await page.keyboard.press('Meta+k')
    const palette = page.getByRole('dialog', { name: '명령 팔레트' })
    await expect(palette).toBeVisible()
    await palette.getByRole('combobox').fill('캘린더')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/#\/calendar/)
  })

  test('할 일을 검색해서 연다', async ({ page }) => {
    await openApp(page)
    await quickAdd(page, '치과 예약하기')

    await page.keyboard.press('Control+k')
    await page.keyboard.press('Meta+k')
    await page.getByRole('combobox').fill('치과')
    await page.getByRole('option', { name: /치과 예약하기/ }).first().click()

    await expect(page.getByRole('complementary', { name: '할 일 상세' }).getByLabel('제목')).toHaveValue('치과 예약하기')
  })
})

test.describe('프로젝트와 보기', () => {
  test('프로젝트를 만들면 사이드바에 나타나고 칸반으로 전환할 수 있다', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: '프로젝트 추가' }).click()
    await page.getByLabel('이름').fill('사이드 프로젝트')
    await page.getByRole('button', { name: '추가', exact: true }).click()

    await expect(page.getByRole('navigation', { name: '주 메뉴' }).getByText('사이드 프로젝트')).toBeVisible()
    await page.getByRole('tab', { name: '칸반' }).click()
    await expect(page).toHaveURL(/view=board/)
    await expect(page.getByRole('button', { name: '열 추가' })).toBeVisible()
  })

  test('칸반 열을 만들어 할 일을 추가한다', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: '프로젝트 추가' }).click()
    await page.getByLabel('이름').fill('보드')
    await page.getByRole('button', { name: '추가', exact: true }).click()
    await page.getByRole('tab', { name: '칸반' }).click()

    await page.getByRole('button', { name: '할 일 · 진행 중 · 완료로 시작' }).click()
    await expect(page.getByRole('region', { name: '진행 중' })).toBeVisible()
    await page.getByRole('region', { name: '진행 중' }).getByRole('button', { name: '작업 추가' }).click()
    await page.getByLabel('새 할 일').fill('디자인 검토')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('region', { name: '진행 중' }).getByText('디자인 검토')).toBeVisible()
  })

  test('필터를 만들면 조건에 맞는 할 일만 보인다', async ({ page }) => {
    await openApp(page)
    await quickAdd(page, '급한 일 p1')
    await quickAdd(page, '느긋한 일')

    await page.getByRole('button', { name: '필터 추가' }).click()
    await page.getByLabel('이름').fill('급한 것')
    await page.getByLabel('조건').fill('p1')
    await page.getByRole('button', { name: '추가', exact: true }).click()

    await expect(page.getByText('급한 일')).toBeVisible()
    await expect(page.getByText('느긋한 일')).toBeHidden()
  })
})

test.describe('캘린더', () => {
  test('월간 달력에서 날짜를 눌러 그 날짜로 할 일을 만든다', async ({ page }) => {
    await openApp(page, '/calendar')

    await page.locator('.mcell').nth(15).click()
    await page.getByLabel('새 할 일').fill('달력에서 만든 일')
    await page.keyboard.press('Enter')

    await expect(page.locator('.mchip', { hasText: '달력에서 만든 일' })).toBeVisible()
  })
})
