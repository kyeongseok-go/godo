import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 빠른 추가 창을 연다. 화면이 보이자마자 누른 단축키는 리스너가 붙기 전이면 무시되므로,
 * 창이 뜰 때까지 짧게 재시도한다(사용자는 이 간격에 키를 누르지 못한다).
 */
export async function openQuickAdd(page: Page) {
  const input = page.getByLabel('새 할 일')
  await expect(async () => {
    if (!(await input.isVisible())) await page.keyboard.press('q')
    await expect(input).toBeVisible({ timeout: 600 })
  }).toPass({ timeout: 10_000 })
  await expect(input).toBeFocused()
  return input
}
