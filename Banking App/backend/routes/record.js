// backend/routes/record.js
const express = require("express");
const crypto = require("crypto");
const recordRoutes = express.Router();
const dbo = require("../db/conn");
const ObjectId = require("mongodb").ObjectId;

function requireLogin(req, res, next) {
  if (!req.session?.username) {
    return res.status(403).json({ message: "Unauthorized. Please log in." });
  }
  next();
}

function generateSalt(length = 16) {
  return crypto.randomBytes(length).toString("hex");
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha256").toString("hex");
}

// List all users (dev only)
recordRoutes.route("/record").get(async (req, res) => {
  try {
    let db_connect = dbo.getDb();
    const result = await db_connect.collection("records").find({}).toArray();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Single user by id (dev only)
recordRoutes.route("/record/:id").get(async (req, res) => {
  try {
    let db_connect = dbo.getDb();
    let myquery = { _id: new ObjectId(req.params.id) };
    const result = await db_connect.collection("records").findOne(myquery);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Register
recordRoutes.route("/record/add").post(async (req, res) => {
  try {
    const db = dbo.getDb();
    const { userName, password, userType } = req.body;

    if (!userName || !password) {
      return res.status(400).json({ success: false, message: "Missing credentials." });
    }

    const exists = await db.collection("records").findOne({ userName });
    if (exists) {
      return res.status(409).json({ success: false, message: "Username already exists." });
    }

    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);

    const newUser = {
      userName,
      password: hashedPassword,
      salt,
      userType: userType || "user",
      accounts: {
        checking: 0,
        savings: 0,
        other: { name: "other", balance: 0 },
      },
      categories: [], // user-defined, starts empty
      createdAt: new Date(),
    };

    await db.collection("records").insertOne(newUser);

    // Set session
    req.session.username = userName;
    req.session.userType = newUser.userType;

    res.json({
      success: true,
      message: "User registered and session set.",
      user: { userName: newUser.userName, userType: newUser.userType },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
});

// Delete a user (dev only)
recordRoutes.route("/:id").delete(requireLogin, async (req, res) => {
  try {
    let db_connect = dbo.getDb();
    let myquery = { _id: new ObjectId(req.params.id) };
    const result = await db_connect.collection("records").deleteOne(myquery);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
recordRoutes.route("/record/login").post(async function (req, res) {
  const db = dbo.getDb();
  const { userName, password } = req.body;

  try {
    const user = await db.collection("records").findOne({ userName });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    const hashedInput = hashPassword(password, user.salt);
    if (hashedInput !== user.password) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    req.session.username = user.userName;
    req.session.userType = user.userType;

    return res.json({
      success: true,
      message: "Login successful.",
      user: {
        userName: user.userName,
        userType: user.userType,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "Server error during login." });
  }
});

module.exports = recordRoutes;
