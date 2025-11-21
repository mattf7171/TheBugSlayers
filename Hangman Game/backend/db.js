const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGO_URI);

async function connectDB() {
  if (!client.topology?.isConnected()) {
    await client.connect();
  }
  return client.db('hangman'); // database name
}

module.exports = connectDB;
