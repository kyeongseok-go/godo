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

/** 화면에 보이는 것과 별개로 IndexedDB 에 실제로 저장됐는지 기다린다. 저장이 끝나기 전에 새로고침하면 쓰기가 끊겨 테스트가 흔들린다. */
export async function expectPersisted(page: Page, title: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        (wanted) =>
          new Promise<boolean>((resolve) => {
            const open = indexedDB.open('godo')
            open.onerror = () => resolve(false)
            open.onsuccess = () => {
              const db = open.result
              const all = db.transaction('tasks', 'readonly').objectStore('tasks').getAll()
              all.onerror = () => resolve(false)
              all.onsuccess = () => {
                db.close()
                resolve((all.result as Array<{ title: string }>).some((task) => task.title === wanted))
              }
            }
          }),
        title,
      ),
    )
    .toBe(true)
}
