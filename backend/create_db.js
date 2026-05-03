const { Client } = require('pg');
require('dotenv').config();

async function createDb() {
  const client = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: 'postgres' // Connect to default db
  });

  try {
    await client.connect();
    await client.query('CREATE DATABASE quran_tracking');
    console.log('✅ Database "quran_tracking" created successfully');
  } catch (err) {
    if (err.code === '42P04') {
      console.log('ℹ️ Database "quran_tracking" already exists');
    } else {
      console.error('❌ Error creating database:', err.message);
    }
  } finally {
    await client.end();
  }
}

createDb();
