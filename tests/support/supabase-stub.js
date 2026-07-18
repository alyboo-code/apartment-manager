// ============================================================================
//  Supabase test double
// ============================================================================
// Served in place of the jsDelivr CDN script, so `index.html` runs unmodified
// against a client we fully control.
//
// WHY A STUB RATHER THAN A REAL TEST PROJECT:
//
//   1. The bugs worth testing here are FAILURE modes — a dropped connection
//      mid-read, one table out of seven rejecting, the server refusing a write.
//      You cannot ask a real Supabase project to fail on command, on the fourth
//      of seven parallel queries, deterministically, every run.
//   2. No credentials in the repo, and no shared remote state two runs can race
//      over.
//   3. The suite runs offline in about a second.
//
// THE CONTRACT THIS MUST HONOUR — get these wrong and the tests lie:
//
//   * Queries RESOLVE, they do not throw. A failed select gives
//     `{ data: null, error }`. This is the single most important behaviour
//     here; it is the root of Hard Rule 4 and the entire reason TASK-001
//     exists. A stub that threw would make the buggy code look correct.
//   * A query builder is thenable and chainable: `.select().eq().eq()` and
//     `.delete().eq().eq()` each resolve only when awaited.
//   * `.maybeSingle()` resolves `{ data: <row|null>, error }` — not an array.
//   * A genuine network failure surfaces as a `TypeError` (that is what fetch
//     throws), which is precisely what `classifyWriteError()` keys on to tell
//     "offline" apart from "rejected".
//
// Control it from a test via `window.__TEST__` (see tests/support/fixtures.js).
// ============================================================================

(function () {
  'use strict';

  const TABLES = ['rooms', 'bills', 'payments', 'expenses', 'maintenance', 'mortgages', 'settings'];

  // ---- Control surface -----------------------------------------------------
  const __TEST__ = (window.__TEST__ = window.__TEST__ || {});
  __TEST__.session = __TEST__.session || null;
  __TEST__.rows = __TEST__.rows || {};          // table -> row[]  (settings: single row or null)
  __TEST__.failures = __TEST__.failures || {};  // table -> {kind:'network'|'reject', message?}
  __TEST__.authFailure = __TEST__.authFailure || null;
  __TEST__.selectLog = __TEST__.selectLog || []; // {table, filters}
  __TEST__.writeLog = __TEST__.writeLog || [];   // {op, table, payload|id, filters}

  for (const t of TABLES) if (!(t in __TEST__.rows)) __TEST__.rows[t] = t === 'settings' ? null : [];

  // A PostgREST-shaped rejection: what a real server sends for a bad column,
  // an RLS denial, a constraint violation. Note it is a plain object, NOT an
  // Error — classifyWriteError() relies on that to distinguish it from fetch's
  // TypeError.
  function postgrestError(message, hint) {
    const e = { message: message || 'permission denied', details: null, hint: hint || null, code: '42501' };
    return e;
  }

  // What fetch throws when the network is genuinely unreachable.
  function networkError() {
    return new TypeError('Failed to fetch');
  }

  // Resolve the configured outcome for a table, or null if it should succeed.
  function failureFor(table) {
    const f = __TEST__.failures[table];
    if (!f) return null;
    return f;
  }

  // ---- Query builder -------------------------------------------------------
  class Query {
    constructor(table) {
      this._table = table;
      this._filters = [];
      this._op = null;
      this._payload = null;
      this._single = false;
    }

    select(cols) { this._op = 'select'; this._cols = cols; return this; }
    upsert(payload, opts) { this._op = 'upsert'; this._payload = payload; this._opts = opts; return this; }
    delete() { this._op = 'delete'; return this; }
    insert(payload) { this._op = 'insert'; this._payload = payload; return this; }
    update(payload) { this._op = 'update'; this._payload = payload; return this; }

    eq(col, val) { this._filters.push({ col, val }); return this; }
    order() { return this; }
    limit() { return this; }

    maybeSingle() { this._single = true; return this; }
    single() { this._single = true; return this; }

    _run() {
      const table = this._table;
      const fail = failureFor(table);

      if (this._op === 'select') {
        __TEST__.selectLog.push({ table, filters: this._filters.slice() });
      } else {
        __TEST__.writeLog.push({
          op: this._op,
          table,
          payload: this._payload,
          filters: this._filters.slice(),
        });
      }

      if (fail) {
        // THE CRITICAL BEHAVIOUR: reads resolve with an error rather than
        // throwing, exactly as the real client does.
        if (this._op === 'select') {
          return Promise.resolve({
            data: null,
            error: fail.kind === 'network'
              ? { message: fail.message || 'TypeError: Failed to fetch', details: null, hint: null, code: '' }
              : postgrestError(fail.message, fail.hint),
          });
        }
        // Writes: a network failure THROWS (fetch rejects) so that
        // classifyWriteError() sees a TypeError; a server rejection resolves
        // with { error }, which persistUpsert() re-throws itself.
        if (fail.kind === 'network') return Promise.reject(networkError());
        return Promise.resolve({ error: postgrestError(fail.message, fail.hint) });
      }

      if (this._op === 'select') {
        let rows = __TEST__.rows[table];
        if (this._single) {
          const row = Array.isArray(rows) ? (rows[0] || null) : (rows || null);
          return Promise.resolve({ data: row, error: null });
        }
        rows = Array.isArray(rows) ? rows : (rows ? [rows] : []);
        // Apply eq filters so user_id scoping is genuinely exercised, not assumed.
        for (const f of this._filters) rows = rows.filter(r => r && r[f.col] === f.val);
        return Promise.resolve({ data: rows.map(r => ({ ...r })), error: null });
      }

      if (this._op === 'upsert') {
        const payload = this._payload;
        if (table === 'settings') {
          __TEST__.rows.settings = { ...payload };
        } else {
          const list = __TEST__.rows[table] || (__TEST__.rows[table] = []);
          const i = list.findIndex(r => r.id === payload.id);
          if (i >= 0) list[i] = { ...payload }; else list.push({ ...payload });
        }
        return Promise.resolve({ error: null });
      }

      if (this._op === 'delete') {
        const list = __TEST__.rows[table];
        if (Array.isArray(list)) {
          const match = r => this._filters.every(f => r[f.col] === f.val);
          __TEST__.rows[table] = list.filter(r => !match(r));
        }
        return Promise.resolve({ error: null });
      }

      return Promise.resolve({ data: null, error: null });
    }

    // Thenable: the query only fires when awaited, like the real client.
    then(onFulfilled, onRejected) { return this._run().then(onFulfilled, onRejected); }
    catch(onRejected) { return this._run().catch(onRejected); }
    finally(cb) { return this._run().finally(cb); }
  }

  // ---- Client --------------------------------------------------------------
  window.supabase = {
    createClient(url, key) {
      __TEST__.createClientArgs = { url, key };
      return {
        auth: {
          async getSession() {
            return { data: { session: __TEST__.session }, error: null };
          },
          onAuthStateChange(cb) {
            __TEST__._authCb = cb;
            return { data: { subscription: { unsubscribe() {} } } };
          },
          async signInWithPassword({ email, password }) {
            if (__TEST__.authFailure) {
              return { data: { session: null, user: null }, error: { message: __TEST__.authFailure } };
            }
            __TEST__.session = {
              access_token: 'test-token',
              user: { id: __TEST__.userId || 'user-1', email },
            };
            if (__TEST__._authCb) __TEST__._authCb('SIGNED_IN', __TEST__.session);
            return { data: { session: __TEST__.session, user: __TEST__.session.user }, error: null };
          },
          async signOut() {
            __TEST__.session = null;
            if (__TEST__._authCb) __TEST__._authCb('SIGNED_OUT', null);
            return { error: null };
          },
        },
        from(table) { return new Query(table); },
      };
    },
  };
})();
