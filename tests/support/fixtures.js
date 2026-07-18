// Shared Playwright fixtures: swap the Supabase CDN script for our test double,
// seed data, and expose helpers for driving failures.
//
// The app is never modified for testability — index.html is served exactly as it
// deploys. All control happens through route interception and window.__TEST__.

const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');

const STUB_SRC = fs.readFileSync(path.join(__dirname, 'supabase-stub.js'), 'utf8');

const TABLES = ['rooms', 'bills', 'payments', 'expenses', 'maintenance', 'mortgages', 'settings'];
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

// A small but realistic dataset: two rooms, a paid bill and an unpaid one, a
// payment, and one row belonging to ANOTHER user so scoping can be tested for
// real rather than assumed.
function seedRows(userId = USER_ID) {
  return {
    rooms: [
      { id: 'room-1', user_id: userId, number: '101', tenant: 'Ana Cruz', type: 'regular',
        persons: 2, rent: 5000, wifi: true, status: 'active', active: true, phone: '0917', email: '' },
      { id: 'room-2', user_id: userId, number: '102', tenant: 'Ben Santos', type: 'regular',
        persons: 1, rent: 4500, wifi: false, status: 'active', active: true, phone: '0918', email: '' },
      // Belongs to someone else. Must never appear in this user's UI.
      { id: 'room-x', user_id: OTHER_USER_ID, number: '999', tenant: 'Other Landlord Tenant',
        persons: 1, rent: 9999, wifi: false, status: 'active', active: true },
    ],
    bills: [
      { id: 'bill-1', user_id: userId, roomId: 'room-1', period: '2026-06', rent: 5000,
        prevReading: 100, currReading: 150, kWh: 50, electricity: 850, persons: 2, water: 150,
        wifi: 300, prevBalance: 0, carryIn: 0, extras: [], totalDue: 6300, paidAmount: 6300,
        balance: 0, status: 'paid', tenantName: 'Ana Cruz', roomNumber: '101', createdAt: 1750000000000 },
      { id: 'bill-2', user_id: userId, roomId: 'room-2', period: '2026-06', rent: 4500,
        prevReading: 200, currReading: 230, kWh: 30, electricity: 510, persons: 1, water: 150,
        wifi: 0, prevBalance: 0, carryIn: 0, extras: [], totalDue: 5160, paidAmount: 0,
        balance: 5160, status: 'unpaid', tenantName: 'Ben Santos', roomNumber: '102', createdAt: 1750000000000 },
    ],
    payments: [
      { id: 'pay-1', user_id: userId, billId: 'bill-1', date: '2026-06-05', amount: 6300,
        mode: 'GCash', notes: '', createdAt: 1750000000000 },
    ],
    expenses: [
      { id: 'exp-1', user_id: userId, date: '2026-06-10', description: 'Plumbing',
        category: 'Repairs', amount: 1200, createdAt: 1750000000000 },
    ],
    maintenance: [
      { id: 'mnt-1', user_id: userId, date: '2026-06-12', roomId: 'room-1', category: 'Plumbing',
        description: 'Leaky faucet', reportedBy: 'Ana Cruz', assignedTo: '', status: 'open',
        resolvedDate: '', cost: 0, notes: '', createdAt: 1750000000000 },
    ],
    mortgages: [
      { id: 'mtg-1', user_id: userId, date: '2026-06-01', amount: 20000, type: 'monthly',
        notes: '', createdAt: 1750000000000 },
    ],
    settings: {
      user_id: userId,
      config: { electricity: 17, wifi: 300, water: 150, name: 'Test Apartments',
                wifiSubscription: 0, mortgageTotal: 1000000 },
    },
  };
}

const test = base.test.extend({
  // Page with the Supabase CDN replaced by the stub. Not logged in yet.
  app: async ({ page }, use) => {
    // The Supabase <script> carries an SRI integrity hash. Substituting the CDN
    // response therefore fails the integrity check and the script is BLOCKED —
    // which is the correct browser behaviour and the reason this attribute
    // exists. So the served HTML has `integrity`/`crossorigin` stripped from
    // that one tag. index.html on disk is never modified; production keeps its
    // SRI protection, and `tests/README.md` explains the trade-off.
    await page.route('**/index.html', async route => {
      const res = await route.fetch();
      let html = await res.text();
      const before = html;
      html = html.replace(
        /(<script[^>]*cdn\.jsdelivr\.net[^>]*>)/i,
        tag => tag.replace(/\s+integrity="[^"]*"/i, '').replace(/\s+crossorigin="[^"]*"/i, ''));
      if (html === before) {
        throw new Error('Could not strip SRI from the Supabase script tag — has the tag changed? ' +
                        'Update tests/support/fixtures.js.');
      }
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    });

    // Block the real CDN and serve the double in its place.
    await page.route('**/cdn.jsdelivr.net/**', route =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: STUB_SRC }));

    // Keep any accidental real Supabase traffic from leaving the machine.
    await page.route('**/*.supabase.co/**', route => route.abort('failed'));

    const helper = {
      page,

      /** Seed table contents before the app boots. */
      async seed(rows = seedRows()) {
        await page.addInitScript(data => {
          window.__TEST__ = window.__TEST__ || {};
          window.__TEST__.rows = data;
          window.__TEST__.userId = 'user-1';
        }, rows);
      },

      /** Start already authenticated, skipping the login screen. */
      async authenticate(userId = USER_ID) {
        await page.addInitScript(id => {
          window.__TEST__ = window.__TEST__ || {};
          window.__TEST__.userId = id;
          window.__TEST__.session = { access_token: 'test-token', user: { id, email: 'landlord@test.dev' } };
        }, userId);
      },

      /**
       * Make one or more tables fail.
       * kind: 'network' (unreachable — the offline case)
       *     | 'reject'  (server refused — retrying will never help)
       */
      async failTables(tables, kind = 'network', message) {
        await page.evaluate(({ tables, kind, message }) => {
          window.__TEST__.failures = window.__TEST__.failures || {};
          for (const t of tables) window.__TEST__.failures[t] = { kind, message };
        }, { tables: [].concat(tables), kind, message });
      },

      /** Same, but applied before the app boots. */
      async failTablesOnBoot(tables, kind = 'network', message) {
        await page.addInitScript(({ tables, kind, message }) => {
          window.__TEST__ = window.__TEST__ || {};
          window.__TEST__.failures = window.__TEST__.failures || {};
          for (const t of tables) window.__TEST__.failures[t] = { kind, message };
        }, { tables: [].concat(tables), kind, message });
      },

      async clearFailures() {
        await page.evaluate(() => { window.__TEST__.failures = {}; });
      },

      async goto() {
        await page.goto('/index.html');
      },

      /** The app's in-memory db, as the page sees it. */
      async db() {
        return page.evaluate(() => (typeof db === 'undefined' ? undefined : JSON.parse(JSON.stringify(db))));
      },

      async selectLog() { return page.evaluate(() => window.__TEST__.selectLog); },
      async writeLog() { return page.evaluate(() => window.__TEST__.writeLog); },
      async outbox() {
        return page.evaluate(() => JSON.parse(localStorage.getItem('apt_outbox') || '[]'));
      },
    };

    await use(helper);
  },
});

module.exports = { test, expect: base.expect, seedRows, TABLES, USER_ID, OTHER_USER_ID };
