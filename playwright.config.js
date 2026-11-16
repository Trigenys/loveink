const { defineConfig, devices } = require('@playwright/test');

const { resolveE2eBaseUrl } = require('./tests/e2e/helpers/target-guard');

// Émulateurs locaux par défaut ; tout hôte distant exige E2E_ALLOW_PROD=1 (échec immédiat sinon).
const baseURL = resolveE2eBaseUrl();

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 120000,
    expect: {
        timeout: 15000
    },
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }]
    ],
    use: {
        baseURL,
        headless: process.env.HEADLESS !== 'false',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ]
});
