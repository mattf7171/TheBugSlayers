require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db('hangman');

  const phrases = [
    { text: 'javascript' },
    { text: 'operating systems' },
    { text: 'computer science' },
    { text: 'banana tea' },
    { text: 'natural grocers' }
  ];

  await db.collection('phrases').deleteMany({});
  await db.collection('phrases').insertMany(phrases);

  console.log('Seeded phrases collection with', phrases.length, 'documents');
  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
