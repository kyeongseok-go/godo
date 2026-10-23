import { expect, test } from '@playwright/test'
import { openQuickAdd } from './helpers'

// 코드 리뷰에서 실제로 재현된 버그들의 회귀 테스트.

async function start(page: import('@playwright/test').Page, hash = '/inbox') {
  await page.goto(`/#${hash}`)
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible()
}

test.describe('빠른 추가 대화상자 안의 팝오버', () => {
  test('날짜 팝오버가 대화상자 위에 떠서 눌리고, 선택이 반영된다', async ({ page }) => {
    await start(page)
    const input = await openQuickAdd(page)
    await input.fill('팝오버 확인')

    await page.getByRole('dialog', { name: '빠른 추가' }).getByRole('button', { name: /날짜/ }).click()
    // 팝오버는 대화상자 안에 있어야 클릭할 수 있다(최상위 레이어 뒤로 숨지 않는다).
    const popover = page.getByRole('dialog', { name: '날짜 선택' })
    await expect(popover).toBeVisible()
    await popover.getByRole('button', { name: '내일' }).click()

    await expect(page.locator('.qa .pick-btn', { hasText: '내일' })).toBeVisible()
  })

  test('팝오버에서 Esc를 누르면 팝오버만 닫히고 입력한 글은 남는다', async ({ page }) => {
    await start(page)
    const input = await openQuickAdd(page)
    await input.fill('지우면 안 되는 글')
    await page.getByRole('dialog', { name: '빠른 추가' }).getByRole('button', { name: /날짜/ }).click()
    await expect(page.getByRole('dialog', { name: '날짜 선택' })).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: '날짜 선택' })).toBeHidden()
    await expect(page.getByLabel('새 할 일')).toHaveValue('지우면 안 되는 글')
  })
})

test.describe('입력 중 전역 단축키', () => {
  test('입력창에서 Cmd/Ctrl+Z는 앱의 마지막 작업을 되돌리지 않는다', async ({ page }) => {
    await start(page)
    let input = await openQuickAdd(page)
    await input.fill('남아 있어야 하는 일')
    await page.keyboard.press('Enter')
    await expect(page.locator('.task-row', { hasText: '남아 있어야 하는 일' })).toBeVisible()

    input = await openQuickAdd(page)
    await input.fill('임시로 쓰는 글')
    await page.keyboard.press('Meta+z')
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Escape')

    await expect(page.locator('.task-row', { hasText: '남아 있어야 하는 일' })).toBeVisible()
  })
})

test.describe('주간 시간표 드래그', () => {
  test('블록을 아래로 끌면 시작 시각이 바뀌어 저장된다', async ({ page }) => {
    await start(page, '/today')
    const input = await openQuickAdd(page)
    await input.fill('오늘 오전 10시 드래그 시험 ~1h')
    await page.keyboard.press('Enter')

    await page.goto('/#/calendar?cal=week')
    const block = page.locator('.tblock', { hasText: '드래그 시험' })
    await expect(block).toBeVisible()
    await expect(block).toContainText('10:00')
    const box = await block.boundingBox()
    if (!box) throw new Error('블록 위치를 찾지 못했어요')

    // 시간당 56px이므로 112px 아래는 2시간 뒤(12:00)다.
    await page.mouse.move(box.x + box.width / 2, box.y + 12)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 12 + 60, { steps: 5 })
    await page.mouse.move(box.x + box.width / 2, box.y + 12 + 112, { steps: 5 })
    await page.mouse.up()

    await expect(page.locator('.tblock', { hasText: '드래그 시험' })).toContainText('12:00')
    await page.reload()
    await expect(page.locator('.tblock', { hasText: '드래그 시험' })).toContainText('12:00')
  })
})

test.describe('선택 상태', () => {
  test('화면을 옮기면 선택이 비워진다', async ({ page }) => {
    await start(page)
    const input = await openQuickAdd(page)
    await input.fill('선택 시험')
    await page.keyboard.press('Enter')
    const row = page.locator('.task-row', { hasText: '선택 시험' })
    await row.focus()
    await page.keyboard.press('x')
    await expect(page.getByRole('toolbar', { name: '선택한 할 일 작업' })).toBeVisible()

    await page.goto('/#/all')

    await expect(page.getByRole('toolbar', { name: '선택한 할 일 작업' })).toBeHidden()
  })
})
