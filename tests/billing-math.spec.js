// ============================================================================
//  Billing arithmetic — Hard Rule 7
// ============================================================================
// These numbers are what a real tenant is asked to pay. A rendering bug is
// embarrassing; a wrong total is a dispute with the person living in room 102.
//
// computeBill() is pure, so it is called directly rather than driven through
// the UI — the arithmetic is the thing under test, not the form.

const { test, expect } = require('./support/fixtures');

async function boot(app, page) {
  await app.seed();
  await app.authenticate();
  await app.goto();
  await expect(page.locator('#app-root')).toBeVisible();
}

// Call computeBill in the page and return the plain result.
function compute(page, args) {
  return page.evaluate(
    ({ roomId, period, prevR, currR, persons, wifiOverride, away }) =>
      JSON.parse(JSON.stringify(
        computeBill(roomId, period, prevR, currR, persons, wifiOverride, away))),
    args);
}

test.describe('computeBill()', () => {

  test('kWh is the meter delta and electricity is delta x rate', async ({ app, page }) => {
    await boot(app, page);
    // Rate is 17 (seeded settings). 150 - 100 = 50 kWh -> 850.
    const bill = await compute(page, {
      roomId: 'room-1', period: '2026-07', prevR: 100, currR: 150, persons: 2,
    });
    expect(bill.kWh).toBe(50);
    expect(bill.electricity).toBe(850);
  });

  test('a lower current reading clamps kWh to zero rather than going negative', async ({ app, page }) => {
    await boot(app, page);
    // A replaced or rolled-over meter must never produce a NEGATIVE charge that
    // silently credits the tenant.
    const bill = await compute(page, {
      roomId: 'room-1', period: '2026-07', prevR: 500, currR: 100, persons: 1,
    });
    expect(bill.kWh).toBe(0);
    expect(bill.electricity).toBe(0);
  });

  test('water is charged per person', async ({ app, page }) => {
    await boot(app, page);
    const one = await compute(page, { roomId: 'room-1', period: '2026-07', prevR: 0, currR: 0, persons: 1 });
    const three = await compute(page, { roomId: 'room-1', period: '2026-07', prevR: 0, currR: 0, persons: 3 });
    expect(one.water).toBe(150);    // seeded settings.water
    expect(three.water).toBe(450);
  });

  test('totalDue is the sum of every component', async ({ app, page }) => {
    await boot(app, page);
    const b = await compute(page, {
      roomId: 'room-1', period: '2026-07', prevR: 100, currR: 150, persons: 2, wifiOverride: true,
    });
    const expected = b.rent + b.electricity + b.water + b.wifi + b.prevBalance + b.carryIn +
      (b.extras || []).reduce((s, e) => s + (+e.amount || 0), 0);
    expect(b.totalDue).toBe(expected);
  });

  test('balance is totalDue minus paid, and status follows the balance', async ({ app, page }) => {
    await boot(app, page);
    const b = await compute(page, {
      roomId: 'room-2', period: '2026-07', prevR: 200, currR: 230, persons: 1,
    });
    expect(b.balance).toBe(b.totalDue - b.paidAmount);
    expect(b.status).toBe(b.balance <= 0 ? 'paid' : b.paidAmount > 0 ? 'partial' : 'unpaid');
  });

  test('an unpaid previous month carries forward as prevBalance', async ({ app, page }) => {
    await boot(app, page);
    // bill-2 (room-2, 2026-06) is seeded unpaid with balance 5160.
    const july = await compute(page, {
      roomId: 'room-2', period: '2026-07', prevR: 230, currR: 230, persons: 1,
    });
    expect(july.prevBalance,
      'last month\'s unpaid balance did not carry forward — the tenant is ' +
      'silently forgiven 5160 and the landlord never learns why the books do not tie')
      .toBe(5160);
    expect(july.totalDue).toBeGreaterThanOrEqual(5160);
  });

  test('a fully paid previous month carries nothing forward', async ({ app, page }) => {
    await boot(app, page);
    // bill-1 (room-1, 2026-06) is seeded paid, balance 0.
    const july = await compute(page, {
      roomId: 'room-1', period: '2026-07', prevR: 150, currR: 160, persons: 2,
    });
    expect(july.prevBalance).toBe(0);
  });

  test('"away" waives water and wifi but still bills rent and electricity', async ({ app, page }) => {
    await boot(app, page);
    const away = await compute(page, {
      roomId: 'room-1', period: '2026-07', prevR: 100, currR: 150, persons: 2,
      wifiOverride: true, away: true,
    });
    expect(away.water).toBe(0);
    expect(away.wifi).toBe(0);
    expect(away.rent).toBeGreaterThan(0);
    expect(away.electricity).toBe(850);
  });

  test('period rollover from December steps back to the right year', async ({ app, page }) => {
    await boot(app, page);
    // prevPer() feeds prevBalance lookups; an off-by-one year here would quietly
    // drop every December-to-January carry-forward.
    const r = await page.evaluate(() => ({
      jan: prevPer('2026-01'),
      mar: prevPer('2026-03'),
      per: per(2026, 0),
    }));
    expect(r.jan).toBe('2025-12');
    expect(r.mar).toBe('2026-02');
    expect(r.per).toBe('2026-01');
  });
});
