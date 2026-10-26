const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ordercenter.db');
const db = new DatabaseSync(dbPath);

// Password hashing helper (SHA-256 with salt)
function hashPassword(password) {
  const salt = 'ordercenter_salt_2026';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    partner TEXT DEFAULT 'Staff',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    account_id TEXT NOT NULL,
    to_account_id TEXT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    partner TEXT NOT NULL,
    notes TEXT,
    ref_number TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT
  );

  CREATE TABLE IF NOT EXISTS opening_balances (
    account_id TEXT PRIMARY KEY,
    amount REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Seed default users if empty
const countUsersRow = db.prepare('SELECT COUNT(*) as count FROM users').get();
const countUsers = countUsersRow ? countUsersRow.count : 0;

if (countUsers === 0) {
  const now = new Date().toISOString().split('T')[0];
  // Seed Wazham as sole Administrator
  db.prepare(`
    INSERT INTO users (id, name, username, password_hash, role, partner, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'usr_admin',
    'Wazham',
    'admin',
    hashPassword('admin123'),
    'admin',
    'Wazham',
    1,
    now
  );

  // Seed default staff user
  db.prepare(`
    INSERT INTO users (id, name, username, password_hash, role, partner, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'usr_staff',
    'Staff User',
    'user',
    hashPassword('user123'),
    'user',
    'Staff',
    1,
    now
  );
  console.log('[DB] Seeded default users: Wazham (Admin) & Staff User.');
} else {
  // Ensure admin user is named Wazham and has admin role
  db.prepare("UPDATE users SET name = 'Wazham', role = 'admin', partner = 'Wazham' WHERE username = 'admin'").run();
}

// Seed opening balances if empty
const countBalancesRow = db.prepare('SELECT COUNT(*) as count FROM opening_balances').get();
const countBalances = countBalancesRow ? countBalancesRow.count : 0;

if (countBalances === 0) {
  const accounts = ['fib', 'cihan', 'qi', 'hyperpost', 'cash'];
  const insertStmt = db.prepare('INSERT INTO opening_balances (account_id, amount, updated_at) VALUES (?, ?, ?)');
  const now = new Date().toISOString();
  accounts.forEach(acc => insertStmt.run(acc, 0, now));
  console.log('[DB] Seeded 5 account opening balances.');
}

// DB Operations
module.exports = {
  db,
  hashPassword,

  // User Management
  getUserByUsername: (username) => {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  },

  getUserById: (id) => {
    return db.prepare('SELECT id, name, username, role, partner, active, created_at FROM users WHERE id = ?').get(id);
  },

  getAllUsers: () => {
    return db.prepare('SELECT id, name, username, role, partner, active, created_at FROM users ORDER BY created_at ASC').all();
  },

  createUser: ({ name, username, password, partner }) => {
    const id = 'usr_' + Date.now();
    const createdAt = new Date().toISOString().split('T')[0];
    const passwordHash = hashPassword(password);
    // Role is strictly locked to 'user'
    const role = 'user';

    db.prepare(`
      INSERT INTO users (id, name, username, password_hash, role, partner, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, name.trim(), username.trim().toLowerCase(), passwordHash, role, partner || 'Staff', createdAt);

    return { id, name: name.trim(), username: username.trim().toLowerCase(), role, partner: partner || 'Staff', active: 1, created_at: createdAt };
  },

  updateUserStatus: (id, active) => {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
    return true;
  },

  updateUserPassword: (username, newPassword) => {
    const passwordHash = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(passwordHash, username.trim().toLowerCase());
    return true;
  },

  deleteUser: (id) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return true;
  },

  // Sessions
  createSession: (userId) => {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, now);
    return token;
  },

  getSessionUser: (token) => {
    if (!token) return null;
    return db.prepare(`
      SELECT u.id, u.name, u.username, u.role, u.partner, u.active 
      FROM sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.token = ? AND u.active = 1
    `).get(token);
  },

  deleteSession: (token) => {
    if (!token) return;
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },

  // Transactions
  getAllTransactions: () => {
    return db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all().map(t => ({
      id: t.id,
      type: t.type,
      accountId: t.account_id,
      toAccountId: t.to_account_id,
      amount: t.amount,
      category: t.category,
      partner: t.partner,
      notes: t.notes,
      refNumber: t.ref_number,
      date: t.date,
      createdAt: t.created_at,
      createdBy: t.created_by
    }));
  },

  createTransaction: (tx, createdBy) => {
    const id = tx.id || 'tx_' + Date.now();
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO transactions (id, type, account_id, to_account_id, amount, category, partner, notes, ref_number, date, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tx.type,
      tx.accountId,
      tx.toAccountId || null,
      Number(tx.amount),
      tx.category,
      tx.partner,
      tx.notes || '',
      tx.refNumber || '',
      tx.date,
      createdAt,
      createdBy || 'Wazham'
    );
    return { ...tx, id, createdAt, createdBy };
  },

  updateTransaction: (id, tx) => {
    db.prepare(`
      UPDATE transactions 
      SET type = ?, account_id = ?, to_account_id = ?, amount = ?, category = ?, partner = ?, notes = ?, ref_number = ?, date = ?
      WHERE id = ?
    `).run(
      tx.type,
      tx.accountId,
      tx.toAccountId || null,
      Number(tx.amount),
      tx.category,
      tx.partner,
      tx.notes || '',
      tx.refNumber || '',
      tx.date,
      id
    );
    return { ...tx, id };
  },

  deleteTransaction: (id) => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return true;
  },

  clearAllTransactions: () => {
    db.prepare('DELETE FROM transactions').run();
    return true;
  },

  // Balances
  getOpeningBalances: () => {
    const rows = db.prepare('SELECT account_id, amount FROM opening_balances').all();
    const balances = { fib: 0, cihan: 0, qi: 0, hyperpost: 0, cash: 0 };
    rows.forEach(r => { balances[r.account_id] = r.amount; });
    return balances;
  },

  setOpeningBalances: (balances) => {
    const updateStmt = db.prepare('INSERT OR REPLACE INTO opening_balances (account_id, amount, updated_at) VALUES (?, ?, ?)');
    const now = new Date().toISOString();
    const accounts = ['fib', 'cihan', 'qi', 'hyperpost', 'cash'];
    accounts.forEach(acc => {
      updateStmt.run(acc, Number(balances[acc] || 0), now);
    });
    return balances;
  }
};
