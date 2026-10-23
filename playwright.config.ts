import { defineConfig, devices } from '@playwright/test'

// E2E 는 개발 서버가 아니라 프로덕션 빌드를 `vite preview` 로 띄워서 돌린다.
// (PWA·서비스 워커는 빌드 결과에만 있다. 개발 서버에서는 꺼져 있다.)
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
