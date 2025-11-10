const express = require("express");
const router = express.Router();
const dbo = require("../db/conn");

// simple auth gate using your existing session
function requireLogin(req, res, next) {
  if (!req.session?.username) {
    return res.status(403).json({ message: "Unauthorized. Please log in." });
  }
  next();
}

/**
 * POST /bank/account/other-label
 * body: { name: string }
 * Updates the current user's "other" account label.
 */
router.post("/bank/account/other-label", requireLogin, async (req, res) => {
  try {
    const db = dbo.getDb();
    if (!db) return res.status(500).json({ message: "DB not ready" });

    const raw = req.body?.name;
    const name = String(raw || "").trim();

    if (!name) return res.status(400).json({ message: "Name is required." });
    if (name.length > 24) return res.status(400).json({ message: "Name too long (max 24 chars)." });

    // avoid confusing users by letting them rename to existing canonical names
    const lower = name.toLowerCase();
    if (["checking", "savings"].includes(lower)) {
      return res.status(400).json({ message: `Choose a name other than "${name}".` });
    }

    // upsert the nested path even if accounts wasn't initialized yet
    const result = await db.collection("records").updateOne(
      { userName: req.session.username },
      {
        $set: { "accounts.other.name": name },
        $setOnInsert: {
          // initialize structure if missing
          "accounts.checking": 0,
          "accounts.savings": 0,
          "accounts.other.balance": 0
        }
      },
      { upsert: false } // set to true if you want to create a record if somehow missing
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ success: true, name });
  } catch (err) {
    console.error("Rename other-label error:", err);
    return res.status(500).json({ message: "Server error while renaming." });
  }
});

module.exports = router;
