// Smoke: the app boots, authenticates, loads all seven tables, and renders.
//
// If this file fails, nothing else in the suite means anything — the harness
// itself is broken, not the app.

const { test, expect, seedRows, TABLES } = require('./support/fixtures');

test.describe('boot and render', () => {
  test('unauthenticated visit shows the login screen, not the app', async ({ app, page }) => {
    await app.seed();
    await app.goto();

    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#app-root')).toBeHidden();
  });

  test('authenticated boot loads all seven tables into db', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();

    await expect(page.locator('#app-root')).toBeVisible();

    const db = await app.db();
    expect(db).toBeTruthy();
    expect(db.rooms).toHaveLength(2);        // room-x belongs to another user
    expect(db.bills).toHaveLength(2);
    expect(db.payments).toHaveLength(1);
    expect(db.expenses).toHaveLength(1);
    expect(db.maintenance).toHaveLength(1);
    expect(db.mortgages).toHaveLength(1);
    expect(db.settings.name).toBe('Test Apartments');

    // Every table was actually queried — not silently skipped.
    const queried = new Set((await app.selectLog()).map(q => q.table));
    for (const t of TABLES) expect(queried).toContain(t);
  });

  test('settings drive the header title', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();

    await expect(page.locator('header h1')).toContainText('Test Apartments');
  });

  test('logging in from the login screen loads data', async ({ app, page }) => {
    await app.seed();
    await app.goto();

    await expect(page.locator('#login-screen')).toBeVisible();
    await page.fill('#login-email', 'landlord@test.dev');
    await page.fill('#login-pass', 'correct-horse');
    await page.click('#login-screen button');

    await expect(page.locator('#app-root')).toBeVisible();
    const db = await app.db();
    expect(db.rooms).toHaveLength(2);
  });

  test('a bad password shows an error and never reveals the app', async ({ app, page }) => {
    await app.seed();
    await page.addInitScript(() => {
      window.__TEST__ = window.__TEST__ || {};
      window.__TEST__.authFailure = 'Invalid login credentials';
    });
    await app.goto();

    await page.fill('#login-email', 'landlord@test.dev');
    await page.fill('#login-pass', 'wrong');
    await page.click('#login-screen button');

    await expect(page.locator('#login-err')).toContainText(/invalid/i);
    await expect(page.locator('#app-root')).toBeHidden();
  });
});
