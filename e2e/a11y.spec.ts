import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openQuickAdd } from './helpers'

// 자동 접근성 검사(WCAG 2 A/AA). 화면마다 위반이 0개여야 한다.

async function seedThroughUi(page: Page) {
  await page.goto('/#/inbox')
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible()
  for (const text of ['오늘 오후 3시 회의 p1 @집중', '내일 보고서 쓰기', '장보기 ~30분']) {
    const input = await openQuickAdd(page)
    await input.fill(text)
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('새 할 일')).toBeHidden()
  }
}

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = results.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help} → ${v.nodes[0]?.target.join(' ')}`)
  expect(summary, summary.join('\n')).toEqual([])
}

const ROUTES = [
  '/inbox', '/today', '/upcoming', '/now', '/calendar', '/calendar?cal=week', '/matrix', '/timeline', '/search?q=회의',
  '/help', '/habits', '/focus', '/countdown', '/productivity', '/summary', '/review', '/replan', '/plan',
  '/settings/general', '/settings/appearance', '/settings/modules', '/settings/notifications', '/settings/shortcuts', '/settings/data', '/settings/templates', '/settings/about',
]

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`접근성 (${scheme})`, () => {
    // 모션을 줄이면 앱이 애니메이션을 끈다(base.css). 페이드 중간 상태에서 명암비를 재지 않으려는 것이다.
    test.use({ colorScheme: scheme, reducedMotion: 'reduce' })

    for (const route of ROUTES) {
      test(`${route}`, async ({ page }) => {
        await seedThroughUi(page)
        await page.goto(`/#${route}`)
        await page.waitForTimeout(400)
        await audit(page)
      })
    }

    test('상세 패널이 열린 상태', async ({ page }) => {
      await seedThroughUi(page)
      await page.locator('.task-row', { hasText: '회의' }).click()
      await expect(page.getByRole('complementary', { name: '할 일 상세' })).toBeVisible()
      await page.waitForTimeout(400)
      await audit(page)
    })

    test('빠른 추가 대화상자가 열린 상태', async ({ page }) => {
      await seedThroughUi(page)
      await openQuickAdd(page)
      await audit(page)
    })

    test('명령 팔레트가 열린 상태', async ({ page }) => {
      await seedThroughUi(page)
      await expect(async () => {
        await page.keyboard.press('Meta+k')
        await page.keyboard.press('Control+k')
        await expect(page.getByRole('dialog', { name: '명령 팔레트' })).toBeVisible({ timeout: 600 })
      }).toPass({ timeout: 10_000 })
      await audit(page)
    })
  })
}

test.describe('키보드 접근성', () => {
  test('건너뛰기 링크가 첫 Tab에서 보이고 본문으로 이동한다', async ({ page }) => {
    await page.goto('/#/inbox')
    await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('button', { name: '본문으로 건너뛰기' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })

  test('모션 줄이기 설정에서는 전환이 사실상 즉시 끝난다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/inbox')
    await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible()
    const duration = await page.evaluate(() => getComputedStyle(document.querySelector('.nav-item') as Element).transitionDuration)
    expect(parseFloat(duration)).toBeLessThan(0.01)
  })
})
