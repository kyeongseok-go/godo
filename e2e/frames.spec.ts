import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openQuickAdd } from './helpers'

// F12: 작업 유형별 시간대 템플릿과 유연한 습관 블록.
// 지금 시각에 따라 배치되는 자리가 달라지므로, 시각과 무관한 것만 단정한다.

async function start(page: Page, hash = '/inbox') {
  await page.goto(`/#${hash}`)
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible()
}

test.describe('시간대 템플릿', () => {
  test('추천 조합으로 만든 시간대가 새로고침 뒤에도 남는다', async ({ page }) => {
    await start(page, '/settings/general')

    await page.getByRole('button', { name: '딥워크·잡무로 시작하기' }).click()
    await expect(page.getByLabel('시간대 이름').first()).toHaveValue('딥워크')

    await page.reload()

    const names = page.getByLabel('시간대 이름')
    await expect(names.first()).toHaveValue('딥워크')
    await expect(names.nth(1)).toHaveValue('잡무')
  })

  test('조건에 맞는 일은 아침 계획에서 그 시간대로 다뤄진다', async ({ page }) => {
    await start(page, '/settings/general')
    await page.getByRole('button', { name: '딥워크·잡무로 시작하기' }).click()
    await expect(page.getByLabel('시간대 이름').first()).toHaveValue('딥워크')

    await start(page, '/today')
    const input = await openQuickAdd(page)
    await input.fill('오늘 영수증 정리 p4 ~30분')
    await page.keyboard.press('Enter')
    await expect(page.locator('.task-row', { hasText: '영수증 정리' })).toBeVisible()

    // 오후에는 저녁 회고 탭이 먼저 열리므로 아침 계획 탭을 명시한다
    await start(page, '/plan?tab=morning')
    await page.getByRole('button', { name: /시간 배치/ }).click()

    // 자리를 찾았으면 제안에 시간대 이름이 붙고, 못 찾았으면 이유에 그 이름이 나온다.
    await expect(page.getByText('잡무').first()).toBeVisible()
  })

  test('시간대를 지우면 목록에서 사라진다', async ({ page }) => {
    await start(page, '/settings/general')
    await page.getByRole('button', { name: '딥워크·잡무로 시작하기' }).click()
    await expect(page.getByLabel('시간대 이름')).toHaveCount(2)

    await page.getByRole('button', { name: '딥워크 삭제' }).click()

    await expect(page.getByLabel('시간대 이름')).toHaveCount(1)
    await page.reload()
    await expect(page.getByLabel('시간대 이름')).toHaveCount(1)
  })
})

test.describe('유연한 습관 블록', () => {
  test('블록을 켜서 만든 습관이 저장되고 오늘 화면에 비워 둔 시간이 보인다', async ({ page }) => {
    await start(page, '/habits')

    await page.getByRole('button', { name: /새 습관/ }).first().click()
    await page.getByLabel('이름').fill('스트레칭')
    await page.getByRole('checkbox', { name: /빈 자리에 매일 다시 잡기/ }).check()
    await page.getByLabel('블록 시작 시각').fill('00:00')
    await page.getByLabel('블록 종료 시각').fill('23:45')
    await page.getByLabel('블록 길이(분)').fill('15')
    await page.getByRole('button', { name: '만들기', exact: true }).click()

    await expect(page.getByRole('dialog', { name: '습관 만들기' })).toBeHidden()

    await start(page, '/today')
    await expect(page.getByText(/비워 둔 시간/)).toBeVisible()

    // 새로고침해도 블록 설정이 남아 있다
    await page.reload()
    await expect(page.getByText(/비워 둔 시간/)).toBeVisible()
  })
})
