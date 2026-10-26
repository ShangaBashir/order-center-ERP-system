const express = require('express');
const cors = require('cors');
const path = require('path');
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
  if (user.password_hash !== hash) {
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

// Add New User (Role strictly forced to 'user')
app.post('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  const { name, username, password, partner } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Name, username, and password are required.' });
  }

  const existing = db.getUserByUsername(username);
  if (existing) {
    return res.status(400).json({ error: 'Username is already taken.' });
  }

  const newUser = db.createUser({
    name,
    username,
    password,
    partner
  });

  res.status(201).json({
    message: `User ${newUser.name} created successfully.`,
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
