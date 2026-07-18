// ============================================================================
//  Write path — Hard Rules 3 and 6, decisions D-002 and D-003
// ============================================================================
// Unlike read-failures.spec.js, these should PASS today. The write path is the
// part of this codebase that was built carefully, and these tests exist to keep
// it that way — they are a regression fence, not a bug report.
//
// What they protect:
//   * writes go one row at a time, never the whole db (Hard Rule 3 / D-002)
//   * an offline failure queues quietly and retries (D-003)
//   * a server rejection is surfaced LOUDLY and never looks like success —
//     the "Saved offline" bug that hid a missing column for weeks (D-003)

const { test, expect, USER_ID } = require('./support/fixtures');

test.describe('per-row writes (Hard Rule 3)', () => {

  test('saving one room writes exactly one row, not the whole db', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    await page.evaluate(() => window.__TEST__.writeLog = []);

    await page.evaluate(() => {
      const r = db.rooms.find(x => x.id === 'room-1');
      saveRoom({ ...r, tenant: 'Ana Cruz-Reyes' });
    });

    await expect.poll(async () => (await app.writeLog()).length).toBeGreaterThan(0);
    const writes = await app.writeLog();

    const upserts = writes.filter(w => w.op === 'upsert');
    expect(upserts.length, 'editing one room produced more than one row write — ' +
      'a whole-db write lets a stale device clobber newer data (Hard Rule 3)').toBe(1);
    expect(upserts[0].table).toBe('rooms');
    expect(upserts[0].payload.id).toBe('room-1');

    // No other table touched.
    expect(new Set(writes.map(w => w.table))).toEqual(new Set(['rooms']));
  });

  test('every written row carries user_id (Hard Rule 5)', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    await page.evaluate(() => window.__TEST__.writeLog = []);
    await page.evaluate(() => {
      const r = db.rooms.find(x => x.id === 'room-1');
      saveRoom({ ...r, tenant: 'Scoped Write' });
    });

    await expect.poll(async () => (await app.writeLog()).length).toBeGreaterThan(0);
    for (const w of await app.writeLog()) {
      if (w.op !== 'upsert') continue;
      expect(w.payload.user_id,
        `an upsert to ${w.table} went out without a user_id — with a second landlord ` +
        'on the system this is a cross-account write').toBe(USER_ID);
    }
  });

  test('deletes are scoped by BOTH id and user_id', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    await page.evaluate(() => window.__TEST__.writeLog = []);
    await page.evaluate(() => persistDelete('rooms', 'room-2'));

    await expect.poll(async () => (await app.writeLog()).length).toBeGreaterThan(0);
    const del = (await app.writeLog()).find(w => w.op === 'delete');
    expect(del).toBeTruthy();

    const cols = del.filters.map(f => f.col).sort();
    expect(cols, 'a delete was not scoped by user_id — it could remove another ' +
      'landlord\'s row if ids ever collide').toEqual(['id', 'user_id']);
  });
});

test.describe('offline vs rejected (Hard Rule 6 / D-003)', () => {

  test('an offline write is queued to the outbox and replayed on reconnect', async ({ app, page, context }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    await context.setOffline(true);
    await app.failTables(['rooms'], 'network');

    await page.evaluate(() => {
      const r = db.rooms.find(x => x.id === 'room-1');
      saveRoom({ ...r, tenant: 'Queued While Offline' });
    });

    await expect.poll(async () => (await app.outbox()).length,
      { message: 'an offline write was not queued to apt_outbox — the edit is simply lost' })
      .toBeGreaterThan(0);

    const queued = await app.outbox();
    expect(queued[0].type).toBe('upsert');
    expect(queued[0].table).toBe('rooms');
    // Offline is transient: it must NOT be marked as a hard error.
    expect(queued[0].hardError,
      'a transient offline failure was recorded as a permanent rejection').toBeFalsy();

    // Reconnect and flush.
    await context.setOffline(false);
    await app.clearFailures();
    await page.evaluate(() => flushOutbox());

    await expect.poll(async () => (await app.outbox()).length,
      { message: 'the outbox did not drain after reconnecting' }).toBe(0);
  });

  test('a server rejection is marked hardError and shown in red — never as success', async ({ app, page }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    // Online, but the server refuses. Retrying will never fix this.
    await app.failTables(['rooms'], 'reject', 'column rooms.tenant does not exist');

    await page.evaluate(() => {
      const r = db.rooms.find(x => x.id === 'room-1');
      saveRoom({ ...r, tenant: 'Will Be Rejected' });
    });

    await expect.poll(async () => (await app.outbox()).length).toBeGreaterThan(0);
    const queued = await app.outbox();

    expect(queued[0].hardError,
      'a server rejection was queued as if it were a transient offline failure — ' +
      'this is exactly the bug that hid a missing column behind "Saved offline"')
      .toBeTruthy();
    expect(queued[0].hardError).toContain('does not exist');

    // And the user is told, loudly.
    const badge = page.locator('#sync-status');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/NOT saved/i);
  });

  test('the sync badge reports pending count while offline', async ({ app, page, context }) => {
    await app.seed();
    await app.authenticate();
    await app.goto();
    await expect(page.locator('#app-root')).toBeVisible();

    await context.setOffline(true);
    await app.failTables(['rooms'], 'network');

    await page.evaluate(() => {
      const r = db.rooms.find(x => x.id === 'room-1');
      saveRoom({ ...r, tenant: 'Pending One' });
    });

    const badge = page.locator('#sync-status');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/pending sync/i);
  });
});
