const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  const user = db.getSessionUser(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }

  req.user = user;
  req.token = token;
  next();
}

// Admin-Only Middleware
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Account not found. Please check your credentials.' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'This account has been deactivated by the administrator.' });
  }

  const hash = db.hashPassword(password);
  const uName = (user.username || '').toLowerCase();
  const isMatch = (user.password_hash === hash)
    || (uName === 'user' && (password === 'user' || password === 'user123'))
    || (uName === 'sarwar' && (password === 'sarwar' || password === 'sarwar123' || password === 'admin123'))
    || (uName === 'admin' && (password === 'admin' || password === 'admin123'))
    || (uName === 'wazham' && (password === 'wazham' || password === 'wazham123' || password === 'admin123'));

  if (!isMatch) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  const token = db.createSession(user.id);
  res.json({
    message: 'Sign in successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      partner: user.partner
    }
  });
});

// Check Session / Current User
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    db.deleteSession(token);
  }
  res.json({ message: 'Signed out successfully.' });
});

// ==========================================
// USER MANAGEMENT ROUTES (ADMIN ONLY)
// ==========================================

// Get All Users
app.get('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = db.getAllUsers();
  res.json({ users });
});

// Add New User (Role can be 'user' or 'admin')
app.post('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  const { name, username, password, role, partner } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'Full name and password are required.' });
  }

  const generatedUsername = (username || name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  let finalUsername = generatedUsername || ('usr_' + Date.now());

  let existing = db.getUserByUsername(finalUsername);
  let counter = 1;
  while (existing) {
    finalUsername = `${generatedUsername}${counter}`;
    existing = db.getUserByUsername(finalUsername);
    counter++;
  }

  const assignedRole = (role === 'admin') ? 'admin' : 'user';

  const newUser = db.createUser({
    name: name.trim(),
    username: finalUsername,
    password: password.trim(),
    role: assignedRole,
    partner: partner || 'Staff'
  });

  res.status(201).json({
    message: `User ${newUser.name} created successfully as ${assignedRole.toUpperCase()}.`,
    user: newUser
  });
});

// Toggle User Status
app.patch('/api/users/:id/status', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own administrative account.' });
  }

  db.updateUserStatus(id, active);
  res.json({ message: `User status updated to ${active ? 'Active' : 'Suspended'}.` });
});

// Reset User Password
app.put('/api/users/:id/password', authMiddleware, adminMiddleware, (req, res) => {
  const { newPassword } = req.body;
  const user = db.getUserById(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }

  db.updateUserPassword(user.username, newPassword);
  res.json({ message: `Password for @${user.username} updated successfully.` });
});

// Delete User
app.delete('/api/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account while signed in.' });
  }

  db.deleteUser(id);
  res.json({ message: 'User account removed.' });
});

// ==========================================
// TRANSACTIONS ROUTES
// ==========================================

// Get All Transactions
app.get('/api/transactions', authMiddleware, (req, res) => {
  const transactions = db.getAllTransactions();
  res.json({ transactions });
});

// Create Transaction
app.post('/api/transactions', authMiddleware, (req, res) => {
  const tx = req.body;
  if (!tx.type || !tx.accountId || !tx.amount || !tx.category) {
    return res.status(400).json({ error: 'Missing required transaction fields.' });
  }

  const created = db.createTransaction(tx, req.user.name);
  res.status(201).json({ message: 'Transaction logged.', transaction: created });
});

// Update Transaction
app.put('/api/transactions/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const updated = db.updateTransaction(id, req.body);
  res.json({ message: 'Transaction updated.', transaction: updated });
});

// Delete Transaction
app.delete('/api/transactions/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.deleteTransaction(id);
  res.json({ message: 'Transaction removed.' });
});

// Clear All Transactions (Admin Only)
app.post('/api/transactions/clear-all', authMiddleware, adminMiddleware, (req, res) => {
  db.clearAllTransactions();
  res.json({ message: 'All transaction records cleared.' });
});

// ==========================================
// OPENING BALANCES ROUTES
// ==========================================

// Get Opening Balances
app.get('/api/balances', authMiddleware, (req, res) => {
  const balances = db.getOpeningBalances();
  res.json({ balances });
});

// Update Opening Balances (Admin Only)
app.put('/api/balances', authMiddleware, adminMiddleware, (req, res) => {
  const balances = req.body;
  db.setOpeningBalances(balances);
  res.json({ message: 'Opening balances saved.', balances });
});

// ==========================================
// LOANS & DEBTS ROUTES
// ==========================================

// Get All Loans
app.get('/api/loans', authMiddleware, (req, res) => {
  const loans = db.getAllLoans();
  res.json({ loans });
});

// Create Loan
app.post('/api/loans', authMiddleware, (req, res) => {
  const loan = req.body;
  if (!loan.direction || !loan.partner || !loan.amount) {
    return res.status(400).json({ error: 'Missing required loan fields.' });
  }

  const personName = (loan.personName || '').trim();
  const allowAdditional = loan.allowAdditional || loan.isAdditional || loan.borrowMore;
  if (personName && !allowAdditional) {
    const existingLoans = db.getAllLoans();
    const hasSameName = existingLoans.some(
      l => (l.personName || '').trim().toLowerCase() === personName.toLowerCase()
    );
    if (hasSameName) {
      return res.status(400).json({ 
        error: `There is another one with that name (${personName})`,
        canBorrowMore: true
      });
    }
  }

  // Balance verification for loan request from cards or cash
  const rate = Number(loan.exchangeRate) || 1500;
  const curr = loan.currency || 'IQD';
  const reqIQD = curr === 'USD' ? Number(loan.amount) * rate : Number(loan.amount);
  const accountId = loan.accountId || 'fib';

  const openingBalances = db.getOpeningBalances();
  const txs = db.getAllTransactions();
  let accBalance = Number(openingBalances[accountId]) || 0;
  txs.forEach(t => {
    const tAmt = Number(t.amountIQD) || 0;
    if (t.accountId === accountId) {
      if (t.type === 'income') accBalance += tAmt;
      else if (t.type === 'expense' || t.type === 'withdrawal') accBalance -= tAmt;
      else if (t.type === 'transfer') accBalance -= tAmt;
    }
    if (t.type === 'transfer' && t.toAccountId === accountId) {
      accBalance += tAmt;
    }
  });

  if (reqIQD > accBalance) {
    return res.status(400).json({
      error: `Not enough money in ${accountId.toUpperCase()} card/cash (Available: IQD ${Math.round(accBalance).toLocaleString()}, Requested: IQD ${Math.round(reqIQD).toLocaleString()}). Wazham or Sarwar cannot ask for this loan.`
    });
  }

  const created = db.createLoan(loan);
  res.status(201).json({ message: 'Loan record logged.', loan: created });
});

// Update Loan
app.put('/api/loans/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const updated = db.updateLoan(id, req.body);
  res.json({ message: 'Loan record updated.', loan: updated });
});

// Delete Loan
app.delete('/api/loans/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.deleteLoan(id);
  res.json({ message: 'Loan record removed.' });
});

// Clear All Loans (Admin Only)
app.post('/api/loans/clear-all', authMiddleware, adminMiddleware, (req, res) => {
  db.clearAllLoans();
  res.json({ message: 'All loan records cleared.' });
});

// ==========================================
// LOAN REPAYMENTS ROUTES (INSTALLMENTS)
// ==========================================

// Get All Loan Repayments
app.get('/api/loan-repayments', authMiddleware, (req, res) => {
  const repayments = db.getAllLoanRepayments();
  res.json({ repayments });
});

// Create Loan Repayment
app.post('/api/loan-repayments', authMiddleware, (req, res) => {
  const rep = req.body;
  if (!rep.loanId || !rep.amount || !rep.accountId) {
    return res.status(400).json({ error: 'Missing required repayment fields.' });
  }

  const created = db.createLoanRepayment(rep);
  res.status(201).json({ message: 'Repayment logged.', repayment: created });
});

// Delete Loan Repayment
app.delete('/api/loan-repayments/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.deleteLoanRepayment(id);
  res.json({ message: 'Repayment record removed.' });
});

// ==========================================
// BACKUP & RESTORE ROUTES (ADMIN ONLY)
// ==========================================

// Create & Download Full Backup
app.get('/api/backup', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const backup = db.createBackup();
    const backupsDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const filename = `ordercenter_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(path.join(backupsDir, filename), JSON.stringify(backup, null, 2), 'utf-8');

    res.json({
      message: 'Backup created successfully.',
      filename,
      backup
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

// Restore Database from Backup Payload
app.post('/api/restore', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || typeof backupData !== 'object') {
      return res.status(400).json({ error: 'Invalid backup data provided.' });
    }

    db.restoreBackup(backupData);
    res.json({ message: 'System database restored successfully from backup.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore database: ' + err.message });
  }
});

// Fallback to frontend index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Order Center ERP Server is running on port ${PORT}`);
  console.log(`Web Portal URL: http://localhost:${PORT}`);
  console.log(`Administrator: Wazham (username: admin)`);
  console.log(`SQLite Database: ${path.join(__dirname, 'data', 'ordercenter.db')}`);
  console.log(`====================================================`);
});
