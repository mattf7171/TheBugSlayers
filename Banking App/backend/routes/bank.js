// backend/routes/bank.js
const express = require("express");
const { ObjectId } = require("mongodb");
const routes = express.Router();
const dbo = require("../db/conn");

// ---- Helpers ----
function requireLogin(req, res, next) {
  if (!req.session || !req.session.username) {
    return res.status(403).json({ message: "Unauthorized. Please log in." });
  }
  next();
}

const VALID_ACCOUNTS = ["checking", "savings", "other"];
const INDEX_TO_ACCOUNT = { 1: "checking", 2: "savings", 3: "other" };

function normalizeCategory(name) {
  return String(name || "").trim();
}

async function getUserByUserName(db, userName) {
  return db.collection("records").findOne({ userName });
}

async function ensureCategory(db, userId, category) {
  const clean = normalizeCategory(category);
  if (!clean) return;
  await db.collection("records").updateOne(
    { _id: userId },
    { $addToSet: { categories: clean } }
  );
}

// ---- Accounts ----

// Get balances + other label
routes.get("/account/balances", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });

  const accounts = user.accounts || {
    checking: 0,
    savings: 0,
    other: { name: "other", balance: 0 },
  };

  return res.json({
    userName: user.userName,
    accounts: {
      checking: Number(accounts.checking || 0),
      savings: Number(accounts.savings || 0),
      other: {
        name: (accounts.other && accounts.other.name) || "other",
        balance: Number((accounts.other && accounts.other.balance) || 0),
      },
    },
  });
});

// Set label of "other" account
routes.patch("/account/other-label", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const { name } = req.body;
  const clean = String(name || "").trim();
  if (!clean) return res.status(400).json({ message: "Name required" });

  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });

  await db.collection("records").updateOne(
    { _id: user._id },
    { $set: { "accounts.other.name": clean } }
  );
  return res.json({ success: true, name: clean });
});

// ---- Categories ----
routes.get("/categories", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ categories: user.categories || [] });
});

routes.post("/categories", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const { name } = req.body;
  const clean = normalizeCategory(name);
  if (!clean) return res.status(400).json({ message: "Category required" });

  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });

  await ensureCategory(db, user._id, clean);
  return res.json({ success: true, name: clean });
});

// ---- Money movement ----
async function applyBalanceChange(db, user, accountKey, delta) {
  // Fetch current fresh doc
  const fresh = await db.collection("records").findOne({ _id: user._id });
  const accounts = fresh.accounts || {
    checking: 0,
    savings: 0,
    other: { name: "other", balance: 0 },
  };

  function getBal(key) {
    if (key === "other") return Number(accounts.other?.balance || 0);
    return Number(accounts[key] || 0);
  }

  function setBal(updateDoc, key, newValue) {
    if (key === "other") {
      updateDoc["accounts.other.balance"] = newValue;
    } else {
      updateDoc[`accounts.${key}`] = newValue;
    }
  }

  const current = getBal(accountKey);
  const next = Number((current + delta).toFixed(2));
  if (next < 0) {
    return { ok: false, reason: "Insufficient funds" };
  }

  const update = {};
  setBal(update, accountKey, next);

  await db.collection("records").updateOne({ _id: user._id }, { $set: update });
  return { ok: true, balance: next };
}

routes.post("/money/deposit", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const { account, amount, category } = req.body;

  if (!VALID_ACCOUNTS.includes(account)) {
    return res.status(400).json({ message: "Invalid account" });
  }
  const amt = Number(amount);
  if (!(amt > 0)) return res.status(400).json({ message: "Amount must be > 0" });

  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });

  await ensureCategory(db, user._id, category);
  const r = await applyBalanceChange(db, user, account, +amt);
  if (!r.ok) return res.status(400).json({ message: r.reason });

  await db.collection("transactions").insertOne({
    userId: user._id,
    type: "deposit",
    fromAccount: null,
    toAccount: account,
    toUserId: null,
    amount: +amt,
    category: normalizeCategory(category),
    createdAt: new Date(),
  });

  return res.json({ success: true, newBalance: r.balance });
});

routes.post("/money/withdraw", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const { account, amount, category } = req.body;

  if (!VALID_ACCOUNTS.includes(account)) {
    return res.status(400).json({ message: "Invalid account" });
  }
  const amt = Number(amount);
  if (!(amt > 0)) return res.status(400).json({ message: "Amount must be > 0" });

  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });

  await ensureCategory(db, user._id, category);
  const r = await applyBalanceChange(db, user, account, -amt);
  if (!r.ok) return res.status(400).json({ message: r.reason });

  await db.collection("transactions").insertOne({
    userId: user._id,
    type: "withdrawal",
    fromAccount: account,
    toAccount: null,
    toUserId: null,
    amount: +amt,
    category: normalizeCategory(category),
    createdAt: new Date(),
  });

  return res.json({ success: true, newBalance: r.balance });
});

routes.post("/money/transfer", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const {
    fromAccount,
    toAccount,              // for intra-user
    toUserName,             // or toUserId
    toUserId,
    toAccountIndex,         // 1|2|3 for inter-user
    amount,
    category,
  } = req.body;

  const amt = Number(amount);
  if (!(amt > 0)) return res.status(400).json({ message: "Amount must be > 0" });

  if (!VALID_ACCOUNTS.includes(fromAccount)) {
    return res.status(400).json({ message: "Invalid fromAccount" });
  }

  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });

  await ensureCategory(db, user._id, category);

  // --- Inter-user transfer ---
if (toUserName || toUserId) {
  const recipient = toUserId
    ? await db.collection("records").findOne({ _id: new ObjectId(toUserId) })
    : await db.collection("records").findOne({ userName: String(toUserName) });

  if (!recipient) return res.status(404).json({ message: "Recipient not found" });

  const destKey = INDEX_TO_ACCOUNT[Number(toAccountIndex)];
  if (!VALID_ACCOUNTS.includes(destKey)) {
    return res.status(400).json({ message: "Invalid destination account index" });
  }

  // withdraw from sender
  const r1 = await applyBalanceChange(db, user, fromAccount, -amt);
  if (!r1.ok) return res.status(400).json({ message: r1.reason });

  // deposit to recipient
  const r2 = await applyBalanceChange(db, recipient, destKey, +amt);
  if (!r2.ok) {
    // rollback sender (best-effort)
    await applyBalanceChange(db, user, fromAccount, +amt);
    return res.status(400).json({ message: "Transfer failed" });
  }

  const now = new Date();
  const cat = normalizeCategory(category);

  // Write two transaction documents: one for sender, one for recipient
  await db.collection("transactions").insertMany([
    {
      // Sender's perspective
      userId: user._id,
      type: "transfer",
      direction: "out",
      fromAccount,
      toAccount: destKey,
      toUserId: recipient._id,
      toUserName: recipient.userName,
      amount: +amt,
      category: cat,
      createdAt: now,
    },
    {
      // Recipient's perspective
      userId: recipient._id,
      type: "transfer",
      direction: "in",
      fromAccount,                 // from sender's account
      fromUserId: user._id,
      fromUserName: user.userName,
      toAccount: destKey,          // to recipient's account
      amount: +amt,
      category: cat,
      createdAt: now,
    },
  ]);

  return res.json({ success: true });
}


  // Intra-user
  if (!VALID_ACCOUNTS.includes(toAccount)) {
    return res.status(400).json({ message: "Invalid toAccount" });
  }
  if (fromAccount === toAccount) {
    return res.status(400).json({ message: "fromAccount and toAccount must differ" });
  }

  const r1 = await applyBalanceChange(db, user, fromAccount, -amt);
  if (!r1.ok) return res.status(400).json({ message: r1.reason });
  const r2 = await applyBalanceChange(db, user, toAccount, +amt);
  if (!r2.ok) {
    // rollback
    await applyBalanceChange(db, user, fromAccount, +amt);
    return res.status(400).json({ message: "Transfer failed" });
  }

  await db.collection("transactions").insertOne({
    userId: user._id,
    type: "transfer",
    fromAccount,
    toAccount,
    toUserId: null,
    amount: +amt,
    category: normalizeCategory(category),
    createdAt: new Date(),
  });

  return res.json({ success: true });
});

// ---- History ----
routes.get("/history/all", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const offset = Number(req.query.offset || 0);

  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });

  const items = await db
    .collection("transactions")
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();

  return res.json({ items });
});

routes.get("/history/account/:account", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const account = req.params.account;
  if (!VALID_ACCOUNTS.includes(account)) {
    return res.status(400).json({ message: "Invalid account" });
  }

  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });

  const items = await db
    .collection("transactions")
    .find({
      userId: user._id,
      $or: [{ fromAccount: account }, { toAccount: account }],
    })
    .sort({ createdAt: -1 })
    .toArray();

  return res.json({ items });
});

// Category summary (for charts)
routes.get("/history/summary/categories", requireLogin, async (req, res) => {
  const db = dbo.getDb();
  const user = await getUserByUserName(db, req.session.username);
  if (!user) return res.status(404).json({ message: "User not found" });

  const since = req.query.since ? new Date(req.query.since) : new Date(0);
  const until = req.query.until ? new Date(req.query.until) : new Date();

  const pipeline = [
    { $match: { userId: user._id, createdAt: { $gte: since, $lte: until } } },
    {
      $group: {
        _id: "$category",
        deposits: {
          $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] },
        },
        withdrawals: {
          $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] },
        },
        transfersOut: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$type", "transfer"] }, { $ne: ["$toUserId", null] }] },
              "$amount",
              0,
            ],
          },
        },
        transfersIn: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$type", "transfer"] }, { $eq: ["$toUserId", null] }] },
              0,
              0,
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        category: "$_id",
        totalDeposits: "$deposits",
        totalWithdrawals: "$withdrawals",
        net: { $subtract: ["$deposits", "$withdrawals"] },
        count: 1,
        _id: 0,
      },
    },
    { $sort: { category: 1 } },
  ];

  const summary = await db.collection("transactions").aggregate(pipeline).toArray();
  return res.json({ summary });
});

module.exports = routes;
