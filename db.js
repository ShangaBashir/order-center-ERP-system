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

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// High-entropy collision-proof ID generator (prevents clashing saves from colliding)
function generateSecureId(prefix = 'REC') {
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${ts}_${rnd}`;
}

// Migrations: ensure columns exist
try { db.exec("ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'IQD'"); } catch (e) {}
try { db.exec("ALTER TABLE transactions ADD COLUMN exchange_rate REAL DEFAULT 1500"); } catch (e) {}
try { db.exec("ALTER TABLE transactions ADD COLUMN amount_iqd REAL"); } catch (e) {}

// Seed default users ONLY on initial installation when users table is completely empty
// (Fixes E-C7: deleted accounts will never return on reboot with public passwords)
const countUsersRow = db.prepare('SELECT COUNT(*) as count FROM users').get();
const countUsers = countUsersRow ? countUsersRow.count : 0;
const now = new Date().toISOString().split('T')[0];

if (countUsers === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, username, password_hash, role, partner, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);
  insertUser.run('usr_admin', 'Wazham', 'admin', hashPassword('admin123'), 'admin', 'Wazham', now);
  insertUser.run('usr_wazham', 'Wazham', 'wazham', hashPassword('admin123'), 'admin', 'Wazham', now);
  insertUser.run('usr_sarwar', 'Sarwar', 'sarwar', hashPassword('sarwar123'), 'user', 'Sarwar', now);
  insertUser.run('usr_staff', 'Staff User', 'user', hashPassword('user123'), 'user', 'Staff', now);
  console.log('[DB] Seeded initial portal accounts for fresh setup.');
}

// Seed default exchange rate in system_settings if not present
const existingRate = db.prepare("SELECT value FROM system_settings WHERE key = 'exchange_rate'").get();
if (!existingRate) {
  db.prepare("INSERT INTO system_settings (key, value, updated_at) VALUES ('exchange_rate', '1500', ?)").run(new Date().toISOString());
}

// Seed opening balances if empty
const countBalancesRow = db.prepare('SELECT COUNT(*) as count FROM opening_balances').get();
const countBalances = countBalancesRow ? countBalancesRow.count : 0;

if (countBalances === 0) {
  const accounts = ['fib', 'cihan', 'qi', 'hyperpost', 'cash'];
  const insertStmt = db.prepare('INSERT INTO opening_balances (account_id, amount, updated_at) VALUES (?, ?, ?)');
  const nowIso = new Date().toISOString();
  accounts.forEach(acc => insertStmt.run(acc, 0, nowIso));
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
    return db.prepare('SELECT id, name, username, role, partner, active, created_at FROM users ORDER BY created_at ASC').all().map(u => ({
      ...u,
      createdAt: u.created_at || new Date().toISOString().split('T')[0]
    }));
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

    return { id, name: name.trim(), username: username.trim().toLowerCase(), role: assignedRole, partner: partner || 'Staff', active: 1, created_at: createdAt, createdAt };
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
    // Generate guaranteed unique collision-proof ID if not provided or clashing (Fixes E-C2)
    let id = tx.id;
    if (!id || id.length < 10 || db.prepare('SELECT id FROM transactions WHERE id = ?').get(id)) {
      id = generateSecureId('TX');
    }
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

    // E-C4 Fix: If transaction is a Company Loan (Taken), ensure corresponding debt is booked in loans table
    const catLower = (tx.category || '').toLowerCase();
    if (catLower.includes('company loan (taken)') || (tx.type === 'income' && catLower.includes('loan'))) {
      const existingLoan = db.prepare('SELECT id FROM loans WHERE tx_id = ?').get(id);
      if (!existingLoan) {
        const loanId = generateSecureId('LN');
        db.prepare(`
          INSERT INTO loans (id, direction, partner, person_name, amount, currency, exchange_rate, account_id, remaining_amount, status, date, notes, tx_id, created_at)
          VALUES (?, 'borrowed', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
        `).run(
          loanId,
          tx.partner || 'Wazham',
          tx.partner || 'Partner',
          Number(tx.amount),
          currency,
          rate,
          tx.accountId || 'fib',
          Number(tx.amount),
          tx.date,
          tx.notes || 'Partner loan to company (Liability booked)',
          id,
          createdAt
        );
      }
    }

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
    // Fix E-C3: Never use clashing 5-digit clock slice; generate collision-proof ID
    let id = loan.id;
    if (!id || id.length < 10 || db.prepare('SELECT id FROM loans WHERE id = ?').get(id)) {
      id = generateSecureId('LN');
    }
    const createdAt = loan.createdAt || new Date().toISOString().split('T')[0];
    const rate = Number(loan.exchangeRate) || 1500;
    const currency = loan.currency || 'IQD';
    const rem = Number(loan.remainingAmount !== undefined ? loan.remainingAmount : loan.amount) || 0;
    const st = loan.status || (rem === 0 ? 'paid' : 'active');

    // Fix E-C3: Use INSERT INTO instead of INSERT OR REPLACE to prevent clashing loans from silently replacing another loan
    db.prepare(`
      INSERT INTO loans (id, direction, partner, person_name, amount, currency, exchange_rate, account_id, remaining_amount, status, date, notes, tx_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      loan.direction || 'borrowed',
      loan.partner || 'Staff',
      (loan.personName || loan.person_name || '').trim(),
      Number(loan.amount) || 0,
      currency,
      rate,
      loan.accountId || loan.account_id || 'fib',
      rem,
      st,
      loan.date || new Date().toISOString(),
      loan.notes || '',
      loan.txId || loan.tx_id || null,
      createdAt
    );
    return { ...loan, id, currency, exchangeRate: rate, remainingAmount: rem, status: st, createdAt };
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
    let id = rep.id;
    if (!id || id.length < 10 || db.prepare('SELECT id FROM loan_repayments WHERE id = ?').get(id)) {
      id = generateSecureId('REP');
    }
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

  // Centralized System Settings & Exchange Rate Operations (Fixes W-C1)
  getExchangeRate: () => {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'exchange_rate'").get();
    return row ? Number(row.value) || 1500 : 1500;
  },

  setExchangeRate: (rate) => {
    const num = Number(rate) || 1500;
    const nowIso = new Date().toISOString();
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('exchange_rate', ?, ?)").run(String(num), nowIso);
    return num;
  },

  // Backup & Restore System
  createBackup: () => {
    const timestamp = new Date().toISOString();
    const transactions = module.exports.getAllTransactions();
    const openingBalances = module.exports.getOpeningBalances();
    const loans = module.exports.getAllLoans();
    const loanRepayments = module.exports.getAllLoanRepayments();
    const users = db.prepare('SELECT id, name, username, role, partner, active, created_at FROM users').all();
    const exchangeRate = module.exports.getExchangeRate();
    
    return {
      version: '2.5.0',
      system: 'Order Center ERP',
      exportedAt: timestamp,
      exchangeRate,
      transactions,
      openingBalances,
      loans,
      loanRepayments,
      users
    };
  },

  // Fix E-C6: Robust atomic restore with pre-validation, safety snapshot, and transaction rollback
  restoreBackup: (data) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid backup data payload.');

    // Pre-validation to prevent wiping the ledger with corrupt or empty backup files
    const hasTxs = Array.isArray(data.transactions) && data.transactions.length > 0;
    const hasBalances = data.openingBalances && typeof data.openingBalances === 'object';
    const hasLoans = Array.isArray(data.loans);

    if (!hasTxs && !hasBalances && !hasLoans) {
      throw new Error('Backup payload contains no valid ERP records (transactions, balances, or loans). Restore aborted to protect existing data.');
    }

    // Safety Snapshot: Always write pre-restore safety copy to disk before making any changes
    try {
      const safetySnapshot = module.exports.createBackup();
      const backupsDir = path.join(dataDir, 'backups');
      if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
      fs.writeFileSync(
        path.join(backupsDir, `ordercenter_prerestore_safety_${Date.now()}.json`),
        JSON.stringify(safetySnapshot, null, 2),
        'utf-8'
      );
    } catch (snapErr) {
      console.warn('[DB] Could not write pre-restore safety snapshot:', snapErr);
    }

    // Wrap entire restore inside an atomic SQLite transaction
    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Restore opening balances if provided
      if (hasBalances) {
        module.exports.setOpeningBalances(data.openingBalances);
      }

      // 2. Restore transactions (only if valid non-empty array provided)
      if (hasTxs) {
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
            tx.id || generateSecureId('TX'),
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

      // 3. Restore loans safely
      if (hasLoans) {
        db.prepare('DELETE FROM loans').run();
        const insertLoan = db.prepare(`
          INSERT INTO loans (id, direction, partner, person_name, amount, currency, exchange_rate, account_id, remaining_amount, status, date, notes, tx_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.loans.forEach(loan => {
          insertLoan.run(
            loan.id || generateSecureId('LN'),
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

      // 4. Restore loan repayments safely
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
            rep.id || generateSecureId('REP'),
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

      // 5. Restore exchange rate if provided
      if (data.exchangeRate) {
        module.exports.setExchangeRate(data.exchangeRate);
      }

      db.exec('COMMIT');
      return true;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
};
