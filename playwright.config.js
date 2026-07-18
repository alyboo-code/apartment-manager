// Playwright configuration for apartment-manager.
//
// The app is a single static file with no build step (D-001), so the "server" is just a static
// file server over the repo root. Every test runs against a stubbed Supabase client injected in
// place of the CDN script — see tests/support/supabase-stub.js for why.

const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests',
  // Tests share no state (each gets a fresh page + fresh stub), so parallel is safe.
  fullyParallel: true,
  // A committed .only silently shrinks the suite to one test while still reporting green.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    // python3 ships with macOS — avoids adding a static-server dependency for a no-build app.
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
