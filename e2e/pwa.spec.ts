import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// PWA(E9): 설치 가능한 매니페스트, 서비스 워커 활성화, 오프라인에서도 앱이 뜨고 할 일을 추가할 수 있어야 한다.
// 서비스 워커는 프로덕션 빌드에만 있다(playwright.config.ts 의 webServer 가 빌드 후 preview 를 띄운다).

async function waitForControlledPage(page: Page): Promise<void> {
  await page.goto('/#/inbox')
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible()
  // ready 는 서비스 워커가 활성화(= 프리캐시 완료)된 뒤에 풀린다. clientsClaim 으로 이 페이지도 곧 제어 대상이 된다.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
}

async function quickAdd(page: Page, text: string): Promise<void> {
  await page.keyboard.press('q')
  const input = page.getByLabel('새 할 일')
  await expect(input).toBeFocused()
  await input.fill(text)
  await page.keyboard.press('Enter')
  await expect(input).toBeHidden()
}

/** 화면에 보이는 것과 별개로 IndexedDB 에 실제로 저장됐는지 기다린다. 저장이 끝나기 전에 새로고침하면 쓰기가 끊겨 테스트가 흔들린다. */
async function expectPersisted(page: Page, title: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        (wanted) =>
          new Promise<boolean>((resolve) => {
            const open = indexedDB.open('pace') // DB 이름은 바꾸지 않았다
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

test.describe('PWA', () => {
  test('처음 방문하면 서비스 워커가 활성화되고 페이지를 제어한다', async ({ page }) => {
    await waitForControlledPage(page)

    const state = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)
    expect(state).toBe('activated')
  })

  test('설치에 필요한 매니페스트와 아이콘을 내려준다', async ({ page, request }) => {
    await page.goto('/#/inbox')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBeTruthy()

    const manifest = await (await request.get(href ?? '')).json()

    expect(manifest).toMatchObject({
      name: 'godo',
      short_name: 'godo',
      lang: 'ko',
      display: 'standalone',
      start_url: './',
      scope: './',
      theme_color: '#f4f6f8',
      background_color: '#f4f6f8',
    })
    const purposes = manifest.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes}:${icon.purpose}`)
    expect(purposes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']))
    for (const icon of manifest.icons as Array<{ src: string }>) {
      const response = await request.get(`/${icon.src}`)
      expect(response.ok(), icon.src).toBe(true)
    }
    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    expect((await request.get(touchIcon ?? '')).ok()).toBe(true)
  })

  test('오프라인에서 새로고침해도 앱이 뜨고, 할 일을 추가하고 다시 불러올 수 있다', async ({ page, context }) => {
    await waitForControlledPage(page)
    const failedRequests: string[] = []
    page.on('requestfailed', (request) => failedRequests.push(request.url()))

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible()
    await quickAdd(page, '오프라인에서 추가한 일')
    await expect(page.getByText('오프라인에서 추가한 일')).toBeVisible()
    await expectPersisted(page, '오프라인에서 추가한 일')

    await page.reload()
    await expect(page.getByText('오프라인에서 추가한 일')).toBeVisible()
    expect(failedRequests, `실패한 요청: ${failedRequests.join(', ')}`).toEqual([])
  })

  test('오프라인에서 다른 화면 주소로 바로 열어도 앱 셸이 뜬다', async ({ page, context }) => {
    await waitForControlledPage(page)

    await context.setOffline(true)
    await page.goto('/#/today')

    await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '오늘' })).toBeVisible()
  })
})
