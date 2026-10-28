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
    currency TEXT DEFAULT 'IQD',
    exchange_rate REAL DEFAULT 1500,
    amount_iqd REAL,
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

  CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    direction TEXT NOT NULL,
    partner TEXT NOT NULL,
    person_name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'IQD',
    exchange_rate REAL DEFAULT 1500,
    account_id TEXT NOT NULL,
    remaining_amount REAL NOT NULL,
    status TEXT DEFAULT 'active',
    date TEXT NOT NULL,
    notes TEXT,
    tx_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS loan_repayments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    person_name TEXT NOT NULL,
    partner TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'IQD',
    exchange_rate REAL DEFAULT 1500,
    amount_iqd REAL,
    account_id TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    tx_id TEXT,
    created_at TEXT NOT NULL
  );
`);

// Migrations: ensure columns exist
try { db.exec("ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'IQD'"); } catch (e) {}
try { db.exec("ALTER TABLE transactions ADD COLUMN exchange_rate REAL DEFAULT 1500"); } catch (e) {}
try { db.exec("ALTER TABLE transactions ADD COLUMN amount_iqd REAL"); } catch (e) {}

// Seed default users if empty
const countUsersRow = db.prepare('SELECT COUNT(*) as count FROM users').get();
const now = new Date().toISOString().split('T')[0];

// Upsert helper to ensure default accounts are always ready
const ensureUser = (id, name, username, password, role, partner) => {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase());
  if (!existing) {
    db.prepare(`
      INSERT INTO users (id, name, username, password_hash, role, partner, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, name, username.toLowerCase(), hashPassword(password), role, partner, now);
  } else {
    db.prepare(`
      UPDATE users SET active = 1, role = ?, partner = ? WHERE username = ?
    `).run(role, partner, username.toLowerCase());
  }
};

ensureUser('usr_admin', 'Wazham', 'admin', 'admin123', 'admin', 'Wazham');
ensureUser('usr_wazham', 'Wazham', 'wazham', 'admin123', 'admin', 'Wazham');
ensureUser('usr_sarwar', 'Sarwar', 'sarwar', 'sarwar123', 'user', 'Sarwar');
ensureUser('usr_staff', 'Staff User', 'user', 'user123', 'user', 'Staff');

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
  getUserByUsername: (identifier) => {
    const clean = (identifier || '').trim().toLowerCase();
    return db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(name) = ?').get(clean, clean);
  },

  getUserById: (id) => {
    return db.prepare('SELECT id, name, username, role, partner, active, created_at FROM users WHERE id = ?').get(id);
  },

  getAllUsers: () => {
    return db.prepare('SELECT id, name, username, role, partner, active, created_at FROM users ORDER BY created_at ASC').all();
  },

  createUser: ({ name, username, password, role, partner }) => {
    const id = 'usr_' + Date.now();
    const createdAt = new Date().toISOString().split('T')[0];
    const passwordHash = hashPassword(password);
    const assignedRole = (role === 'admin') ? 'admin' : 'user';

    db.prepare(`
      INSERT INTO users (id, name, username, password_hash, role, partner, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, name.trim(), username.trim().toLowerCase(), passwordHash, assignedRole, partner || 'Staff', createdAt);

    return { id, name: name.trim(), username: username.trim().toLowerCase(), role: assignedRole, partner: partner || 'Staff', active: 1, created_at: createdAt };
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
      currency: t.currency || 'IQD',
      exchangeRate: t.exchange_rate || 1500,
      amountIQD: t.amount_iqd !== null && t.amount_iqd !== undefined ? t.amount_iqd : (t.currency === 'USD' ? (Number(t.amount) * (t.exchange_rate || 1500)) : Number(t.amount)),
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
    const createdAt = tx.createdAt || new Date().toISOString();
    const rate = Number(tx.exchangeRate) || 1500;
    const currency = tx.currency || 'IQD';
    const amountIQD = tx.amountIQD !== undefined ? Number(tx.amountIQD) : (currency === 'USD' ? (Number(tx.amount) * rate) : Number(tx.amount));
    db.prepare(`
      INSERT INTO transactions (id, type, account_id, to_account_id, amount, currency, exchange_rate, amount_iqd, category, partner, notes, ref_number, date, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tx.type,
      tx.accountId,
      tx.toAccountId || null,
      Number(tx.amount),
      currency,
      rate,
      amountIQD,
      tx.category || 'General Operations',
      tx.partner || '',
      tx.notes || '',
      tx.refNumber || '',
      tx.date,
      createdAt,
      createdBy || 'Wazham'
    );
    return { ...tx, id, currency, exchangeRate: rate, amountIQD, createdAt, createdBy };
  },

  updateTransaction: (id, tx) => {
    const rate = Number(tx.exchangeRate) || 1500;
    const currency = tx.currency || 'IQD';
    const amountIQD = tx.amountIQD !== undefined ? Number(tx.amountIQD) : (currency === 'USD' ? (Number(tx.amount) * rate) : Number(tx.amount));
    db.prepare(`
      UPDATE transactions 
      SET type = ?, account_id = ?, to_account_id = ?, amount = ?, currency = ?, exchange_rate = ?, amount_iqd = ?, category = ?, partner = ?, notes = ?, ref_number = ?, date = ?
      WHERE id = ?
    `).run(
      tx.type,
      tx.accountId,
      tx.toAccountId || null,
      Number(tx.amount),
      currency,
      rate,
      amountIQD,
      tx.category || 'General Operations',
      tx.partner || '',
      tx.notes || '',
      tx.refNumber || '',
      tx.date,
      id
    );
    return { ...tx, id, currency, exchangeRate: rate, amountIQD };
  },

  deleteTransaction: (id) => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return true;
  },

  clearAllTransactions: () => {
    db.prepare('DELETE FROM transactions').run();
    return true;
  },

  // Loans DB Operations
  getAllLoans: () => {
    return db.prepare('SELECT * FROM loans ORDER BY date DESC, created_at DESC').all().map(l => ({
      id: l.id,
      direction: l.direction,
      partner: l.partner,
      personName: l.person_name,
      amount: l.amount,
      currency: l.currency || 'IQD',
      exchangeRate: l.exchange_rate || 1500,
      accountId: l.account_id,
      remainingAmount: l.remaining_amount,
      status: l.status || 'active',
      date: l.date,
      notes: l.notes,
      txId: l.tx_id,
      createdAt: l.created_at
    }));
  },

  createLoan: (loan) => {
    const id = loan.id || 'LN-' + Date.now().toString().slice(-5);
    const createdAt = loan.createdAt || new Date().toISOString();
    const rate = Number(loan.exchangeRate) || 1500;
    const currency = loan.currency || 'IQD';
    db.prepare(`
      INSERT OR REPLACE INTO loans (id, direction, partner, person_name, amount, currency, exchange_rate, account_id, remaining_amount, status, date, notes, tx_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      loan.direction,
      loan.partner,
      loan.personName || loan.person_name || '',
      Number(loan.amount),
      currency,
      rate,
      loan.accountId || loan.account_id,
      Number(loan.remainingAmount !== undefined ? loan.remainingAmount : loan.amount),
      loan.status || 'active',
      loan.date,
      loan.notes || '',
      loan.txId || loan.tx_id || null,
      createdAt
    );
    return { ...loan, id, currency, exchangeRate: rate, createdAt };
  },

  updateLoan: (id, updates) => {
    const existing = db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
    if (!existing) return null;
    const merged = {
      direction: updates.direction !== undefined ? updates.direction : existing.direction,
      partner: updates.partner !== undefined ? updates.partner : existing.partner,
      person_name: updates.personName !== undefined ? updates.personName : (updates.person_name !== undefined ? updates.person_name : existing.person_name),
      amount: updates.amount !== undefined ? Number(updates.amount) : existing.amount,
      currency: updates.currency !== undefined ? updates.currency : existing.currency,
      exchange_rate: updates.exchangeRate !== undefined ? Number(updates.exchangeRate) : existing.exchange_rate,
      account_id: updates.accountId !== undefined ? updates.accountId : existing.account_id,
      remaining_amount: updates.remainingAmount !== undefined ? Number(updates.remainingAmount) : existing.remaining_amount,
      status: updates.status !== undefined ? updates.status : existing.status,
      date: updates.date !== undefined ? updates.date : existing.date,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      tx_id: updates.txId !== undefined ? updates.txId : existing.tx_id
    };
    db.prepare(`
      UPDATE loans 
      SET direction = ?, partner = ?, person_name = ?, amount = ?, currency = ?, exchange_rate = ?, account_id = ?, remaining_amount = ?, status = ?, date = ?, notes = ?, tx_id = ?
      WHERE id = ?
    `).run(
      merged.direction,
      merged.partner,
      merged.person_name,
      merged.amount,
      merged.currency,
      merged.exchange_rate,
      merged.account_id,
      merged.remaining_amount,
      merged.status,
      merged.date,
      merged.notes,
      merged.tx_id,
      id
    );
    return { id, ...merged };
  },

  deleteLoan: (id) => {
    db.prepare('DELETE FROM loans WHERE id = ?').run(id);
    db.prepare('DELETE FROM loan_repayments WHERE loan_id = ?').run(id);
    return true;
  },

  clearAllLoans: () => {
    db.prepare('DELETE FROM loans').run();
    db.prepare('DELETE FROM loan_repayments').run();
    return true;
  },

  // Loan Repayments (Installments & Partial Payments)
  getAllLoanRepayments: () => {
    return db.prepare('SELECT * FROM loan_repayments ORDER BY date DESC, created_at DESC').all().map(r => ({
      id: r.id,
      loanId: r.loan_id,
      personName: r.person_name,
      partner: r.partner,
      amount: r.amount,
      currency: r.currency || 'IQD',
      exchangeRate: r.exchange_rate || 1500,
      amountIQD: r.amount_iqd,
      accountId: r.account_id,
      date: r.date,
      notes: r.notes,
      txId: r.tx_id,
      createdAt: r.created_at
    }));
  },

  createLoanRepayment: (rep) => {
    const id = rep.id || 'REP-' + Date.now().toString().slice(-5);
    const createdAt = rep.createdAt || new Date().toISOString();
    const rate = Number(rep.exchangeRate) || 1500;
    const curr = rep.currency || 'IQD';
    const amountIQD = rep.amountIQD !== undefined ? Number(rep.amountIQD) : (curr === 'USD' ? (Number(rep.amount) * rate) : Number(rep.amount));
    db.prepare(`
      INSERT INTO loan_repayments (id, loan_id, person_name, partner, amount, currency, exchange_rate, amount_iqd, account_id, date, notes, tx_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      rep.loanId,
      rep.personName,
      rep.partner,
      Number(rep.amount),
      curr,
      rate,
      amountIQD,
      rep.accountId,
      rep.date,
      rep.notes || '',
      rep.txId || null,
      createdAt
    );
    return { ...rep, id, currency: curr, exchangeRate: rate, amountIQD, createdAt };
  },

  deleteLoanRepayment: (id) => {
    db.prepare('DELETE FROM loan_repayments WHERE id = ?').run(id);
    return true;
  },

  clearAllLoanRepayments: () => {
    db.prepare('DELETE FROM loan_repayments').run();
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
  },

  // Backup & Restore System
  createBackup: () => {
    const timestamp = new Date().toISOString();
    const transactions = module.exports.getAllTransactions();
    const openingBalances = module.exports.getOpeningBalances();
    const loans = module.exports.getAllLoans();
    const loanRepayments = module.exports.getAllLoanRepayments();
    const users = db.prepare('SELECT id, name, username, role, partner, active, created_at FROM users').all();
    
    return {
      version: '2.5.0',
      system: 'Order Center ERP',
      exportedAt: timestamp,
      transactions,
      openingBalances,
      loans,
      loanRepayments,
      users
    };
  },

  restoreBackup: (data) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid backup data payload.');

    // 1. Restore opening balances
    if (data.openingBalances && typeof data.openingBalances === 'object') {
      module.exports.setOpeningBalances(data.openingBalances);
    }

    // 2. Restore transactions
    if (Array.isArray(data.transactions)) {
      db.prepare('DELETE FROM transactions').run();
      const insertTx = db.prepare(`
        INSERT INTO transactions (id, type, account_id, to_account_id, amount, currency, exchange_rate, amount_iqd, category, partner, notes, ref_number, date, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      data.transactions.forEach(tx => {
        const rate = Number(tx.exchangeRate) || 1500;
        const curr = tx.currency || 'IQD';
        const amtIQD = tx.amountIQD !== undefined ? Number(tx.amountIQD) : (curr === 'USD' ? (Number(tx.amount) * rate) : Number(tx.amount));
        insertTx.run(
          tx.id || ('TX-' + Date.now().toString().slice(-5)),
          tx.type,
          tx.accountId,
          tx.toAccountId || null,
          Number(tx.amount) || 0,
          curr,
          rate,
          amtIQD,
          tx.category || 'General Operations',
          tx.partner || 'Staff',
          tx.notes || '',
          tx.refNumber || '',
          tx.date || new Date().toISOString(),
          tx.createdAt || new Date().toISOString(),
          tx.createdBy || 'Wazham'
        );
      });
    }

    // 3. Restore loans
    if (Array.isArray(data.loans)) {
      db.prepare('DELETE FROM loans').run();
      const insertLoan = db.prepare(`
        INSERT INTO loans (id, direction, partner, person_name, amount, currency, exchange_rate, account_id, remaining_amount, status, date, notes, tx_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      data.loans.forEach(loan => {
        insertLoan.run(
          loan.id || ('LN-' + Date.now().toString().slice(-5)),
          loan.direction || 'borrowed',
          loan.partner || 'Staff',
          loan.personName || loan.person_name || '',
          Number(loan.amount) || 0,
          loan.currency || 'IQD',
          Number(loan.exchangeRate) || 1500,
          loan.accountId || loan.account_id || 'fib',
          Number(loan.remainingAmount !== undefined ? loan.remainingAmount : loan.amount) || 0,
          loan.status || 'active',
          loan.date || new Date().toISOString(),
          loan.notes || '',
          loan.txId || loan.tx_id || null,
          loan.createdAt || new Date().toISOString()
        );
      });
    }

    // 4. Restore loan repayments
    if (Array.isArray(data.loanRepayments)) {
      db.prepare('DELETE FROM loan_repayments').run();
      const insertRep = db.prepare(`
        INSERT INTO loan_repayments (id, loan_id, person_name, partner, amount, currency, exchange_rate, amount_iqd, account_id, date, notes, tx_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      data.loanRepayments.forEach(rep => {
        const rate = Number(rep.exchangeRate) || 1500;
        const curr = rep.currency || 'IQD';
        const amtIQD = rep.amountIQD !== undefined ? Number(rep.amountIQD) : (curr === 'USD' ? (Number(rep.amount) * rate) : Number(rep.amount));
        insertRep.run(
          rep.id || ('REP-' + Date.now().toString().slice(-5)),
          rep.loanId || rep.loan_id,
          rep.personName || rep.person_name || '',
          rep.partner || 'Staff',
          Number(rep.amount) || 0,
          curr,
          rate,
          amtIQD,
          rep.accountId || rep.account_id || 'fib',
          rep.date || new Date().toISOString(),
          rep.notes || '',
          rep.txId || rep.tx_id || null,
          rep.createdAt || new Date().toISOString()
        );
      });
    }

    return true;
  }
};
