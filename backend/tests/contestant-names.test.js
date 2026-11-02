// Exercise saveConfig without connecting to a database or modifying real scores.
const assert = require('node:assert/strict');
const { test } = require('node:test');

let connection;
let acquired = 0;
const dbPath = require.resolve('../config/db');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { getConnection: async () => { acquired += 1; return connection; } },
};
const historyPath = require.resolve('../services/history.service');
require.cache[historyPath] = {
  id: historyPath, filename: historyPath, loaded: true,
  exports: { addHistory: async () => ({ id: 1 }) },
};
const { saveConfig } = require('../services/data.service');

function fakeConnection({ duplicate = false, existing = [] } = {}) {
  return {
    calls: [], committed: false, rolledBack: false, released: false,
    async beginTransaction() {},
    async execute(sql, params) {
      this.calls.push({ sql, params });
      if (sql.startsWith('SELECT id, ai_prompt')) return [[{ id: 1 }]];
      if (sql.startsWith('SELECT ui_mode')) return [[{ ui_mode: 'default' }]];
      if (sql.startsWith('SELECT id, name, entry_number')) return [existing];
      if (sql.startsWith('INSERT INTO contestants') && duplicate) {
        throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
      }
      return [[]];
    },
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; },
    release() { this.released = true; },
  };
}

test('duplicate names with different entry numbers are rejected before any DB writes', async () => {
  for (const secondName of ['Ryan', 'ryan', ' Ryan ']) {
    const before = acquired;
    await assert.rejects(saveConfig(1, {
      contest_name: 'Event',
      contestants: [{ name: 'Ryan', entry_number: 1 }, { name: secondName, entry_number: 2 }],
    }), (error) => error.status === 409 && error.message.includes('already exists'));
    assert.equal(acquired, before);
  }
});

test('invalid or blank names are rejected before acquiring a connection', async () => {
  for (const contestants of [null, {}, [null], [{ name: '   ' }], [{ name: 123 }]]) {
    const before = acquired;
    await assert.rejects(saveConfig(1, { contestants }), (error) => error.status === 400);
    assert.equal(acquired, before);
  }
});

test('valid names are trimmed and the same name can be used by another school', async () => {
  for (const schoolId of [1, 2]) {
    connection = fakeConnection();
    await saveConfig(schoolId, {
      contest_name: 'Event', contestants: [{ name: ' Ryan ', entry_number: 1 }, { name: 'Jane', entry_number: 2 }],
    });
    const inserts = connection.calls.filter(({ sql }) => sql.startsWith('INSERT INTO contestants'));
    assert.deepEqual(inserts.map(({ params }) => params), [[schoolId, 'Ryan', 1], [schoolId, 'Jane', 2]]);
    assert.equal(connection.committed, true);
    assert.equal(connection.released, true);
  }
});

test('MySQL duplicate-key failures return 409 and roll back settings, contestants and scores', async () => {
  connection = fakeConnection({ duplicate: true });
  await assert.rejects(saveConfig(1, {
    contest_name: 'Event', contestants: [{ name: 'Ryan', entry_number: 1 }], criteria: [],
  }), (error) => error.status === 409 && error.message.includes('already exists'));
  assert.equal(connection.committed, false);
  assert.equal(connection.rolledBack, true);
  assert.equal(connection.released, true);
});

test('resaving an unchanged roster preserves contestant IDs and scores', async () => {
  connection = fakeConnection({ existing: [{ id: 9, name: 'Ryan', entry_number: 1 }] });
  await saveConfig(1, {
    contest_name: 'Event', contestants: [{ name: 'Ryan', entry_number: 1 }], criteria: [],
  });
  assert.equal(connection.calls.some(({ sql }) => sql.startsWith('DELETE FROM')), false);
  assert.equal(connection.committed, true);
});

test('partial settings saves do not require a contestant list', async () => {
  connection = fakeConnection();
  await saveConfig(1, { is_judge_locked: 1 });
  assert.equal(connection.calls.some(({ sql }) => sql.includes('contestants')), false);
  assert.equal(connection.committed, true);
});
