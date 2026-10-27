const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ordercenter.db');
const db = new DatabaseSync(dbPath);

// Ensure columns exist
try { db.exec("ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'IQD'"); } catch (e) {}
try { db.exec("ALTER TABLE transactions ADD COLUMN exchange_rate REAL DEFAULT 1500"); } catch (e) {}
try { db.exec("ALTER TABLE transactions ADD COLUMN amount_iqd REAL"); } catch (e) {}

const data = {
  "transactions": [
    {
      "id": "TX-47402",
      "refNumber": "REF-8388",
      "type": "expense",
      "amount": 50000,
      "currency": "IQD",
      "accountId": "fib",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Logistics & Fuel",
      "notes": "یامان بە ماریاخان بۆ معامەلاتی کۆمپانیاکەمان لە ژوری بازرگانی",
      "date": "2026-10-26T12:56",
      "exchangeRate": 1500,
      "amountIQD": 50000
    },
    {
      "id": "TX-72943",
      "refNumber": "REF-8359",
      "type": "income",
      "amount": 195000,
      "currency": "IQD",
      "accountId": "cash",
      "toAccountId": null,
      "partner": "Sarwar",
      "category": "Other Revenue",
      "notes": "پاقی پارەکەی سەروەر لای مابوو یای بە من",
      "date": "2026-10-20T17:43",
      "exchangeRate": 1500,
      "amountIQD": 195000
    },
    {
      "id": "TX-82393",
      "refNumber": "REF-1039",
      "type": "expense",
      "amount": 500000,
      "currency": "IQD",
      "accountId": "cihan",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "لە حسابی بانکی جیهانی شەخسییەکەمەوە نەقڵم کردە سەر حسابی بزنزەکەمان بۆ داوا کردنی کارتەکە (٤٦٠٠٠٠) ی پێویستە و باقییەکەی ئەمێنێتەوە",
      "date": "2026-10-25T17:38",
      "exchangeRate": 1500,
      "amountIQD": 500000
    },
    {
      "id": "TX-35908",
      "refNumber": "REF-8777",
      "type": "expense",
      "amount": 377467,
      "currency": "IQD",
      "accountId": "cihan",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "کڕینی ئۆردەرەکی مستەفا ئاکۆ",
      "date": "2026-10-21T17:35",
      "exchangeRate": 1500,
      "amountIQD": 377467
    },
    {
      "id": "TX-41914",
      "refNumber": "REF-7478",
      "type": "expense",
      "amount": 132403,
      "currency": "IQD",
      "accountId": "cihan",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "Sponsor 50 USD New + Old Money",
      "date": "2026-10-21T17:34",
      "exchangeRate": 1500,
      "amountIQD": 132403
    },
    {
      "id": "TX-92711",
      "refNumber": "REF-1409",
      "type": "expense",
      "amount": 63841,
      "currency": "IQD",
      "accountId": "cihan",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Logistics & Fuel",
      "notes": "نێردرا بۆ ساندرا بۆ کۆکردنەوەی بەریدەکانمان لە چین",
      "date": "2026-10-20T17:33",
      "exchangeRate": 1500,
      "amountIQD": 63841
    },
    {
      "id": "TX-98161",
      "refNumber": "REF-6462",
      "type": "expense",
      "amount": 41055,
      "currency": "IQD",
      "accountId": "fib",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "پارەی کارەبای کۆمپانیا",
      "date": "2026-10-21T17:32",
      "exchangeRate": 1500,
      "amountIQD": 41055
    },
    {
      "id": "TX-00374",
      "refNumber": "REF-8844",
      "type": "expense",
      "amount": 3000,
      "currency": "IQD",
      "accountId": "cash",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "Taxi",
      "date": "2026-10-22T17:30",
      "exchangeRate": 1500,
      "amountIQD": 3000
    },
    {
      "id": "TX-11154",
      "refNumber": "REF-9504",
      "type": "expense",
      "amount": 8000,
      "currency": "IQD",
      "accountId": "fib",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Logistics & Fuel",
      "notes": "قەرەبووی نیروش کرایەوە ( پارەکەی هاتەوەسەر حسابی جیهانەکەم ) پارچەیەکی نەهاتبوو",
      "date": "2026-10-14T17:29",
      "exchangeRate": 1500,
      "amountIQD": 8000
    },
    {
      "id": "TX-61966",
      "refNumber": "REF-1029",
      "type": "expense",
      "amount": 5480,
      "currency": "IQD",
      "accountId": "fib",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "بۆ کارتێکی ئاسیا بۆ ژمارە ئاسیاکە",
      "date": "2026-10-14T17:28",
      "exchangeRate": 1500,
      "amountIQD": 5480
    },
    {
      "id": "TX-19739",
      "refNumber": "REF-9225",
      "type": "expense",
      "amount": 1400,
      "currency": "IQD",
      "accountId": "fib",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "بۆ کارتێکی کۆڕەک",
      "date": "2026-10-14T17:27",
      "exchangeRate": 1500,
      "amountIQD": 1400
    },
    {
      "id": "TX-31969",
      "refNumber": "REF-4886",
      "type": "income",
      "amount": 427000,
      "currency": "IQD",
      "accountId": "hyperpost",
      "toAccountId": null,
      "partner": "Sarwar",
      "category": "Other Revenue",
      "notes": "325000 Nerush order + 1000 Kelar Order + 101000 Clothes Erbil Order",
      "date": "2026-10-13T16:22",
      "exchangeRate": 1500,
      "amountIQD": 427000
    },
    {
      "id": "TX-67172",
      "refNumber": "REF-1173",
      "type": "income",
      "amount": 170000,
      "currency": "IQD",
      "accountId": "fib",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Other Revenue",
      "notes": "کرێی نەقڵی ئۆردەرەکەی ( سەمیر )",
      "date": "2026-10-12T16:19",
      "exchangeRate": 1500,
      "amountIQD": 170000
    },
    {
      "id": "TX-96654",
      "refNumber": "REF-5202",
      "type": "income",
      "amount": 1050000,
      "currency": "IQD",
      "accountId": "cihan",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Other Revenue",
      "notes": "خرایە سەر بانکی جیهان",
      "date": "2026-10-07T16:10",
      "exchangeRate": 1500,
      "amountIQD": 1050000
    },
    {
      "id": "TX-69759",
      "refNumber": "REF-4702",
      "type": "expense",
      "amount": 389000,
      "currency": "IQD",
      "accountId": "qi",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Logistics & Fuel",
      "notes": "کرێی هێنانەوەی ئەشیاکانی ( سەمیر و ئۆردەرێکی تر ) لە کۆمپانیای قیام \nحسابەکە خۆی ٣٠٥٠٠٠ بوو + ٤٠٠٠ تەکسی",
      "date": "2026-10-11T16:06",
      "exchangeRate": 1500,
      "amountIQD": 389000
    },
    {
      "id": "TX-36526",
      "refNumber": "REF-8125",
      "type": "income",
      "amount": 8000,
      "currency": "IQD",
      "accountId": "cihan",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Other Revenue",
      "notes": "هی حسابی پێشتر بوو کە لە حسابەکەی بیلال مابۆیەوە گەڕاندییەوە بۆمان",
      "date": "2026-10-25T15:58",
      "exchangeRate": 1500,
      "amountIQD": 8000
    },
    {
      "id": "TX-50716",
      "refNumber": "REF-5473",
      "type": "income",
      "amount": 12367,
      "currency": "IQD",
      "accountId": "cihan",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Other Revenue",
      "notes": "ڕیفەندی ئۆردەرەکەی ژنە بادینییەکە ( نیروش ) یەکێک لە پارچەکانی نەهەتبوو",
      "date": "2026-10-14T15:44",
      "exchangeRate": 1500,
      "amountIQD": 12367
    },
    {
      "id": "TX-43512",
      "refNumber": "REF-3051",
      "type": "expense",
      "amount": 10000,
      "currency": "IQD",
      "accountId": "cash",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "10,000 taxi ڕۆیشثن و هاتنەوە لە ئۆفیس",
      "date": "2026-10-25T15:40",
      "exchangeRate": 1500,
      "amountIQD": 10000
    },
    {
      "id": "TX-76992",
      "refNumber": "REF-7584",
      "type": "expense",
      "amount": 47000,
      "currency": "IQD",
      "accountId": "cash",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "٢٦٠٠٠ بۆکردنەوەی وەکالەت بۆ محامی + ٣٠٠٠ بۆ تەکسی + ١٨٠٠٠ بۆ نانخواردنی من و سەروەر و کاروان",
      "date": "2026-10-25T15:38",
      "exchangeRate": 1500,
      "amountIQD": 47000
    },
    {
      "id": "TX-84766",
      "refNumber": "REF-6794",
      "type": "expense",
      "amount": 4000,
      "currency": "IQD",
      "accountId": "cash",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Logistics & Fuel",
      "notes": "Taxi",
      "date": "2026-10-18T15:35",
      "exchangeRate": 1500,
      "amountIQD": 4000
    },
    {
      "id": "TX-10481",
      "refNumber": "REF-1538",
      "type": "transfer",
      "amount": 55000,
      "currency": "IQD",
      "accountId": "cihan",
      "toAccountId": "cash",
      "partner": "Sarwar",
      "category": "Internal Account Rebalance",
      "notes": "بیلال کردبووی بە کاش لە حسابەکەی خۆی و بە دەستی دایەوە پێم",
      "date": "2026-10-17T15:34",
      "exchangeRate": 1500,
      "amountIQD": 55000
    },
    {
      "id": "TX-41261",
      "refNumber": "REF-5563",
      "type": "expense",
      "amount": 25000,
      "currency": "IQD",
      "accountId": "cash",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Courier & Driver Payroll",
      "notes": "پارەی تەکسی ( چووم بۆ ئۆفیسی ێێف ئای بی - لەوێوە بۆ ئۆفیسی هایپەر پۆست - لەوێوە بۆ ئۆفیسی ماستەر کارگۆ - لەوێوە بۆ ماڵەوە )",
      "date": "2026-10-12T15:33",
      "exchangeRate": 1500,
      "amountIQD": 25000
    },
    {
      "id": "TX-63284",
      "refNumber": "REF-1521",
      "type": "expense",
      "amount": 175000,
      "currency": "IQD",
      "accountId": "cash",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "Courier & Driver Payroll",
      "notes": "پارەی وەرگرتنی ئۆردەری تەیارە لە ماستەر کارگۆ",
      "date": "2026-10-12T15:29",
      "exchangeRate": 1500,
      "amountIQD": 175000
    },
    {
      "id": "TX-61067",
      "refNumber": "REF-8348",
      "type": "transfer",
      "amount": 257750,
      "currency": "IQD",
      "accountId": "hyperpost",
      "toAccountId": "cash",
      "partner": "Sarwar",
      "category": "Internal Account Rebalance",
      "notes": "پارەی ناو هایپەر پۆستەکەم کرد بە کاش و خستمە سەر قاسە",
      "date": "2026-10-12T15:25",
      "exchangeRate": 1500,
      "amountIQD": 257750
    },
    {
      "id": "TX-62086",
      "refNumber": "REF-8379",
      "type": "income",
      "amount": 257750,
      "currency": "IQD",
      "accountId": "hyperpost",
      "toAccountId": null,
      "partner": "Sarwar",
      "category": "Delivery Settlement",
      "notes": "پارەی واسڵ بوونی ئۆردەر لە هایپەر پۆست",
      "date": "2026-10-25T14:53",
      "exchangeRate": 1500,
      "amountIQD": 257750
    },
    {
      "id": "TX-91740",
      "refNumber": "REF-4352",
      "type": "transfer",
      "amount": 1125000,
      "currency": "IQD",
      "accountId": "cash",
      "toAccountId": "cihan",
      "partner": "Sarwar",
      "category": "Cash to Bank Deposit",
      "notes": "لە پارەی کاشی ناو قاسەوە بۆ ئۆردەرەکەی ڕەوەند پارەکەم خستە سەر حسابی جیهانەکەی بیلال",
      "date": "2026-10-12T14:52",
      "exchangeRate": 1500,
      "amountIQD": 1125000
    },
    {
      "id": "TX-84817",
      "refNumber": "REF-1560",
      "type": "expense",
      "amount": 90000,
      "currency": "IQD",
      "accountId": "cash",
      "toAccountId": null,
      "partner": "Wazham",
      "category": "General Operations",
      "notes": "بۆ کردنەوەی هەژماری بانکی بزنز لە بانکی جیهان",
      "date": "2026-10-12T14:49",
      "exchangeRate": 1500,
      "amountIQD": 90000
    }
  ],
  "openingBalances": {
    "fib": 0,
    "cihan": 0,
    "qi": 510000,
    "hyperpost": 0,
    "cash": 1210000
  }
};

// Clear previous transactions and insert the exact user dataset
db.exec('DELETE FROM transactions');

const insertTx = db.prepare(`
  INSERT INTO transactions (id, type, account_id, to_account_id, amount, currency, exchange_rate, amount_iqd, category, partner, notes, ref_number, date, created_at, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const tx of data.transactions) {
  insertTx.run(
    tx.id,
    tx.type,
    tx.accountId,
    tx.toAccountId,
    tx.amount,
    tx.currency,
    tx.exchangeRate,
    tx.amountIQD,
    tx.category,
    tx.partner,
    tx.notes,
    tx.refNumber,
    tx.date,
    new Date().toISOString(),
    tx.partner || 'Wazham'
  );
}

// Update opening balances
const updateBal = db.prepare('INSERT OR REPLACE INTO opening_balances (account_id, amount, updated_at) VALUES (?, ?, ?)');
const now = new Date().toISOString();
for (const [acc, amt] of Object.entries(data.openingBalances)) {
  updateBal.run(acc, amt, now);
}

console.log(`Successfully seeded ${data.transactions.length} transactions and opening balances into SQLite!`);
