# Order Center ERP — Treasury & Financial Operations Platform

A modern, full-stack ERP system built for **Order Center (Global Shopping & Shipping)** to manage multi-account liquidity, partner equity, partner loans, executive ledgers, and role-based user management.

![Order Center ERP](https://img.shields.io/badge/Platform-Order%20Center%20ERP-711612?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-24%2B-green?style=for-the-badge&logo=node.js)
![Database](https://img.shields.io/badge/Database-SQLite-blue?style=for-the-badge&logo=sqlite)

---

## 🌟 Key Features

### 1. Multi-Account Liquidity Management
* **5 Primary Financial Accounts**:
  * **FIB (First Iraqi Bank)**
  * **Cihan Bank**
  * **Qi Card**
  * **Hyper Post**
  * **Physical Cash Safe (Drawer)**
* Live balance calculation aggregated in real time with USD and IQD currency conversion.
* **Instant Account Rebalancing**: Transfer funds seamlessly between any internal accounts with full audit trails.

### 2. Partner Equity & Partner Loans
* **Equity Tracking**: Live distribution tracking between co-founders (**Sarwar** & **Wazham**).
* **Partner Drawings**: Accurately track dividends and drawings taken from any account.
* **Partner Loans**: 
  * Record active loans and advances for both Sarwar and Wazham.
  * Real-time deduction: $\text{Net Owed} = \text{Entitled Share} - \text{Total Drawings} - \text{Active Loan}$.
  * Loan repayment tracking that automatically decreases active loan balances.
* **Settlement Simulator**: Interactive equity percentage slider with instant settlement calculation table.

### 3. Authentication & Access Control
* **Branded Login Portal**: Clean, modern interface styled in Order Center burgundy (`#711612`) and gold (`#AB7431`).
* **Administrator Authority**: **Wazham** is the designated system administrator.
* **Role-Based User Management**:
  * Wazham can view registered accounts, create new team members, toggle active/suspended statuses, and reset passwords.
  * New team members can strictly only be created with the **`User`** role.
* Secure logout with confirmation modal protection.

### 4. Executive Ledger & Reports
* Categorized income, expense, internal transfer, and partner drawing records.
* Powerful multi-filter system (Filter by Account, Transaction Type, Partner, Date Period, or search terms).
* **One-Click CSV Export** for audits and spreadsheets.
* **Dedicated A4 Print Layout** formatted specifically for corporate financial statements.

---

## 🛠️ Technology Stack

* **Backend**: Node.js, Express.js
* **Database**: Embedded SQLite (`node:sqlite`), self-contained relational storage (`data/ordercenter.db`)
* **Frontend**: React 18, Tailwind CSS, Lucide Icons, Plus Jakarta Sans typography
* **API Architecture**: RESTful endpoints with Bearer Token session authorization

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: Version 22.5.0 or later (Node 24 recommended).
* **npm**: Installed with Node.js.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/shangabashir/order-center-erp-system.git
   cd order-center-erp-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the ERP Server**:
   ```bash
   npm start
   ```
   *(Windows users can also simply double-click `start.bat`)*

4. **Access the Portal**:
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🔐 Default Credentials

| Role | Username | Initial Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator (Wazham)** | `admin` | `admin123` | Full control, User Management, Data Reset |
| **Staff User** | `user` | `user123` | Standard operations, Ledger access |

---

## 📁 Project Structure

```
order-center-erp-system/
├── data/
│   └── ordercenter.db         # SQLite persistent database file
├── public/
│   └── index.html             # Full-stack frontend single-page application
├── db.js                      # SQLite database schema, seeds, & query helpers
├── server.js                  # Express REST API & static file server
├── erpsystem.html             # Standalone offline version of the dashboard
├── start.bat                  # One-click Windows launch script
├── package.json               # Project manifest & npm scripts
└── README.md                  # System documentation
```

---

## 📄 License
Proprietary software developed for **Order Center (Global Shopping & Shipping)**. All rights reserved.
