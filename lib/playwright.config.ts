import { defineConfig, devices } from '@playwright/test';

// Pruebas de humo contra el sitio ya desplegado (APP_URL).
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'pw-report.json' }]],
  use: {
    baseURL: process.env.APP_URL || 'http://localhost:3000',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
