import { defineConfig } from '@playwright/test'
import { loadEnvFile } from 'node:process'
loadEnvFile('.env.local')
if (!['localhost','127.0.0.1'].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname)) throw new Error('E2E is local-only')
export default defineConfig({
 testDir: './tests/e2e', workers: 1, timeout: 60000,
 use: { baseURL: 'http://localhost:3000', trace: 'off', screenshot: 'off' },
 reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
 webServer: { command: 'npm run dev -- --hostname 127.0.0.1', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120000 },
})
