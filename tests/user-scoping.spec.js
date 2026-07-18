// ============================================================================
//  Account isolation — Hard Rule 5, north-star goal #2
// ============================================================================
// There is one landlord today. The day there are two, a single leak ends the
// product — and no apology covers having shown one landlord another's tenants,
// phone numbers, and payment history.
//
// The seed data deliberately contains a row owned by OTHER_USER_ID. These tests
// assert it never surfaces, and that every query goes out scoped.

const { test, expect, TABLES, USER_ID } = require('./support/fixtures');

test.describe('user_id scoping', () => {

  test('every table read is filtered by user_id', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    const selects = await app.selectLog();
    expect(selects.length).toBeGreaterThan(0);

    for (const q of selects) {
      const cols = q.filters.map(f => f.col);
      expect(cols,
        `a read of "${q.table}" went out WITHOUT a user_id filter — it would return ` +
        'every landlord\'s rows if RLS were ever misconfigured (Hard Rule 5)')
        .toContain('user_id');

      const scoped = q.filters.find(f => f.col === 'user_id');
      expect(scoped.val, `read of "${q.table}" was scoped to the wrong user`).toBe(USER_ID);
    }
  });

  test('all seven tables are queried, and all seven are scoped', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    const selects = await app.selectLog();
    const scopedTables = new Set(
      selects.filter(q => q.filters.some(f => f.col === 'user_id')).map(q => q.table));

    for (const t of TABLES) {
      expect(scopedTables, `table "${t}" was never read with a user_id filter`).toContain(t);
    }
  });

  test("another landlord's room never reaches the in-memory db", async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    const db = await app.db();
    const ids = db.rooms.map(r => r.id);
    expect(ids, 'a room belonging to another landlord was loaded into this session')
      .not.toContain('room-x');
    expect(db.rooms.every(r => r.user_id === USER_ID)).toBeTruthy();
  });

  test("another landlord's tenant name never renders anywhere on the page", async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    const body = await page.locator('body').innerText();
    expect(body, 'another landlord\'s tenant name is visible in the UI')
      .not.toContain('Other Landlord Tenant');
    expect(body).not.toContain('999');
  });

  test('signing out clears the session', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    await page.evaluate(() => doLogout());
    await expect(page.locator('#login-screen')).toBeVisible();

    const session = await page.evaluate(() => window.__TEST__.session);
    expect(session, 'the session survived logout').toBeNull();
  });
});
