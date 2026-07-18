// ============================================================================
//  TASK-001 acceptance tests — Hard Rule 4
// ============================================================================
// A failed read must never be presented as an empty database.
//
// THESE TESTS ARE EXPECTED TO FAIL until TASK-001 ships. That is deliberate:
// they are the executable form of the task's acceptance criteria, and they are
// what turns "I fixed it" into something checkable. Codex's job is to make them
// green without weakening them.
//
// Why this matters more than it looks: the empty screen is not the damage. The
// damage is what the landlord does next — re-entering rooms and bills, each one
// getting a fresh crypto.randomUUID() that cannot collide with the real rows
// still sitting in Supabase. The result is a permanently duplicated database.
//
// Supabase resolves a failed query as { data: null, error } rather than
// throwing, so `rooms.data || []` turns a dropped connection into an empty
// array and try/catch never fires.

const { test, expect, TABLES } = require('./support/fixtures');

test.describe('loadDB() — failed reads must not look like empty data', () => {

  test('total network failure at boot does not render an empty app', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.failTablesOnBoot(TABLES, 'network');
    await app.goto();

    // The app must not present itself as a working, empty apartment manager.
    const roomsShown = await page.locator('#dash-rooms').innerText().catch(() => '');
    const db = await app.db();

    // AC-2: db must not have been swapped in with empty arrays.
    expect(db === undefined || db.rooms === undefined || db.rooms.length !== 0,
      'db.rooms was set to an empty array after a failed read — this is the bug: ' +
      'the landlord now sees zero rooms and cannot tell it from real data loss')
      .toBeTruthy();

    // AC-3: some explicit failure state must be visible.
    const body = await page.locator('body').innerText();
    expect(body, 'no error state shown to the user after a total read failure')
      .toMatch(/could not load|failed to load|couldn't load|unable to load|try again|retry/i);

    expect(roomsShown).not.toMatch(/no rooms yet|0 rooms/i);
  });

  test('server rejection is distinguished from being offline', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.failTablesOnBoot(TABLES, 'reject', 'column rooms.foo does not exist');
    await app.goto();

    const body = await page.locator('body').innerText();
    // AC-5: a permanent rejection must not be dressed up as a transient blip.
    expect(body, 'a server rejection was not surfaced to the user at all')
      .toMatch(/could not load|failed to load|couldn't load|unable to load|error/i);
    expect(body, 'a permanent server rejection is being reported as a mere connectivity problem')
      .not.toMatch(/^offline$|check your connection/i);
  });

  test('ONE failing table out of seven must not produce a partial db', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    // The six others succeed. Only bills fails.
    await app.failTablesOnBoot(['bills'], 'network');
    await app.goto();

    const db = await app.db();

    // AC-2, the critical case. Either db was never swapped in, or — if the fix
    // chose to keep prior state — it must not contain the half-loaded mixture
    // of six good tables and one empty one.
    if (db && db.rooms) {
      expect(db.bills && db.bills.length === 0 && db.rooms.length === 2,
        'db was populated with six good tables and an EMPTY bills array — ' +
        'every bill and payment for every tenant has silently vanished from the UI')
        .toBeFalsy();
    }

    const body = await page.locator('body').innerText();
    expect(body, 'a partial read failure was not surfaced at all')
      .toMatch(/could not load|failed to load|couldn't load|unable to load|try again|retry/i);
  });

  test('a settings-only failure must not silently reset the electric rate', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.failTablesOnBoot(['settings'], 'network');
    await app.goto();

    const db = await app.db();

    // AC-6. The seeded rate is 17 here, matching the default, so assert on the
    // NAME, which differs between seed ('Test Apartments') and the fallback
    // ('My Apartment'). Falling back to defaults means billing at the wrong
    // rate — a Hard Rule 7 problem, not a cosmetic one.
    if (db && db.settings) {
      expect(db.settings.name,
        'settings fell back to newDB() defaults after a failed read — ' +
        'the electric rate silently reverted and bills computed from it would be wrong')
        .not.toBe('My Apartment');
    }
  });

  test('retry after a failure loads the data correctly', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.failTablesOnBoot(TABLES, 'network');
    await app.goto();

    // AC-4: recovery path. Clear the fault, then use whatever retry affordance
    // the fix provides.
    await app.clearFailures();

    const retry = page.getByRole('button', { name: /retry|try again|reload/i });
    await expect(retry, 'no retry control offered after a failed load').toBeVisible({ timeout: 5000 });
    await retry.click();

    await expect.poll(async () => {
      const db = await app.db();
      return db && db.rooms ? db.rooms.length : 0;
    }, { message: 'retry did not recover the data' }).toBe(2);
  });

  test('happy path is unchanged — all seven tables load and render', async ({ app, page }) => {
    // AC-7: the fix must not alter success behaviour.
    await app.seed();
    await app.authenticate();
    await app.goto();

    await expect(page.locator('#app-root')).toBeVisible();
    const db = await app.db();
    expect(db.rooms).toHaveLength(2);
    expect(db.bills).toHaveLength(2);
    expect(db.settings.name).toBe('Test Apartments');

    // migrateBillSnapshots() still ran: snapshots intact.
    expect(db.bills[0].tenantName).toBeTruthy();
    expect(db.bills[0].roomNumber).toBeTruthy();
  });
});

test.describe('refreshFromCloud() — the second read path', () => {

  test('a failed background refresh must not wipe data already on screen', async ({ app, page }) => {
    // This path is arguably worse than the boot case: refreshFromCloud() runs
    // on window focus, on reconnect, and on visibilitychange. It calls loadDB()
    // and then renderAll() unconditionally, and its try/catch cannot fire
    // because loadDB() does not throw. So a brief connectivity blip while the
    // landlord is mid-task blanks the screen they are working in.
    await app.seed();
    await app.authenticate();
    await app.goto();

    await expect(page.locator('#app-root')).toBeVisible();
    expect((await app.db()).rooms).toHaveLength(2);

    // Break the connection, then trigger a refresh the way the app does.
    await app.failTables(TABLES, 'network');
    await page.evaluate(() => { _lastRefresh = 0; });
    await page.evaluate(() => refreshFromCloud());

    await expect.poll(async () => {
      const db = await app.db();
      return db && db.rooms ? db.rooms.length : -1;
    }, {
      message: 'a failed background refresh emptied the in-memory db — ' +
               'the landlord watched their rooms disappear mid-session',
    }).toBe(2);
  });
});
