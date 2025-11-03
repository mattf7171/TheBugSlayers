const express = require("express");
const crypto = require("crypto");

// recordRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /record.
const recordRoutes = express.Router();
 
// This will help us connect to the database
const dbo = require("../db/conn");
 
// This helps convert the id from string to ObjectId for the _id.
const ObjectId = require("mongodb").ObjectId;
 
// This function will make sure the user is authorized to perform a certain route
function requireLogin(req, res, next) {
    if (!req.session.username) {
        return res.status(403).json({ message: "Unauthorized. Please log in." });
    }
    next();
}

// Generate salt for password
function generateSalt(length = 16) {
    return crypto.randomBytes(length).toString("hex");
}

// Hash password
function hashPassword(password, salt) {
    return crypto
        .pbkdf2Sync(password, salt, 1000, 64, "sha256")
        .toString("hex");
}

// This section will help you get a list of all the records.
recordRoutes.route("/record").get(async (req, res) => {
    try {
        console.log("In record get route");
        let db_connect = dbo.getDb("employees");
        const result = await db_connect.collection("records").find({}).toArray();
        console.log("Got result");
        res.json(result);
    } catch (err) {
        throw err;
    }
   });
 
// This section will help you get a single record by id
recordRoutes.route("/record/:id").get(async (req, res) => {
    try {
        let db_connect = dbo.getDb();
        let myquery = { _id: new ObjectId(req.params.id) };
        const result = await db_connect.collection("records").findOne(myquery);
        res.json(result);
    } catch (err) {
        throw err;
    }

});
 
// This section will help you register a new user.
recordRoutes.route("/record/add").post(async (req, res) => {
    try {
        const db_connect = dbo.getDb();
        const { userName, password, userType } = req.body;

        // Generate salt and hash the password
        const salt = generateSalt();
        const hashedPassword = hashPassword(password, salt);

        // Store hashed password and salt
        const newUser = {
            userName,
            password: hashedPassword,
            salt,
            userType,
        };

        const result = await db_connect.collection("records").insertOne(newUser);

        // Set session
        req.session.username = userName;
        req.session.userType = userType;

        res.json({
            success: true,
            message: "User registered and session set.",
            user: newUser,
        });
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
});
 
// This section will help you delete a record
recordRoutes.route("/:id").delete(requireLogin, async (req, res) => {
    try {
        let db_connect = dbo.getDb();
        let myquery = { _id: new ObjectId(req.params.id) };
        const result = await db_connect.collection("records").deleteOne(myquery);
        console.log("1 document deleted");
        res.json(result);
    } catch(err) {
        throw err;
    }
});

// This route will login a user 
recordRoutes.route("/login").post(async function (req, res) {
    const dbConnect = dbo.getDb();
    const { userName, password } = req.body;

    try {
        const user = await dbConnect.collection("records").findOne({ userName });

        console.log("Login attempt for:", userName);
        console.log("User found:", user);

        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid username or password." });
        }

        const hashedInput = hashPassword(password, user.salt);

        if (hashedInput !== user.password) {
            return res.status(401).json({ success: false, message: "Invalid username or password." });
        }

        // Set session
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