// CommonJS version (works with your current backend)
// Run with: node resetdb.js

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: "./config.env" });

(async function reset() {
  try {
    const uri = process.env.ATLAS_URI;
    if (!uri) {
      throw new Error("ATLAS_URI is undefined. Did you set it in backend/config.env?");
    }

    const client = new MongoClient(uri);
    await client.connect();

    // Use DB name from URI path if present, else default to 'bankapp'
    let dbName = "bankapp";
    try {
      const u = new URL(uri);
      const pathDb = (u.pathname || "").replace("/", "").trim();
      if (pathDb) dbName = pathDb;
    } catch (_) {}

    const db = client.db(dbName);

    // Clear collections you use
    const cols = ["records", "transactions", "sessions"]; // add more if needed
    for (const c of cols) {
      try {
        const res = await db.collection(c).deleteMany({});
        console.log(`Cleared ${c}: ${res.deletedCount} docs`);
      } catch (e) {
        console.log(`(skip) ${c}: ${e.message}`);
      }
    }

    console.log(`✅ Database "${dbName}" cleared.`);
    await client.close();
  } catch (err) {
    console.error("Reset failed:", err);
    process.exit(1);
  }
})();
