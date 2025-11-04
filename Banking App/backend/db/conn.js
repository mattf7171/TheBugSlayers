// backend/db/conn.js
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.ATLAS_URI;

let _db;
let _client;

module.exports = {
  connectToServer: function (callback) {
    console.log("Attempting to connect...");
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    (async () => {
      try {
        await client.connect();
        // Ping
        await client.db().admin().command({ ping: 1 });
        // Use DB from URI path (…/bankapp) or fallback
        const dbNameFromUri = (new URL(uri)).pathname.replace("/", "") || "bankapp";
        _db = client.db(dbNameFromUri);
        _client = client;
        console.log(`Ping OK. Connected to MongoDB database "${dbNameFromUri}".`);
        callback(); // no error
      } catch (err) {
        console.error("Mongo connection error:", err);
        callback(err); // pass the error so server won't start
      }
      // DO NOT close the client; keep it for app lifetime
    })();
  },

  getDb: function () {
    return _db;
  },
  getClient: function () {
    return _client;
  },
};
