require('dotenv').config();
const { connectDB } = require('./config/db');
const User = require('./models/User');
const { Client } = require('pg');

async function cleanup() {
  await connectDB();

  // We keep the token for 'salah' and clear it for others since they are currently identical on the user's testing phone
  const token = 'ExponentPushToken[6HSbYiOHUpFKC-LNi2itwi]';

  // 1. Clean local database
  const [localUpdated] = await User.update(
    { pushToken: null },
    {
      where: {
        pushToken: token,
        username: { [require('sequelize').Op.ne]: 'salah' }
      }
    }
  );
  console.log(`🧹 تم إزالة الرموز المكررة محلياً لـ ${localUpdated} حساب/حسابات.`);

  // 2. Clean Supabase database
  const supabaseUrl = process.env.SUPABASE_DB_URL;
  if (supabaseUrl) {
    const client = new Client({
      connectionString: supabaseUrl,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      const res = await client.query(
        `UPDATE users SET "pushToken" = NULL WHERE "pushToken" = $1 AND username != 'salah'`,
        [token]
      );
      console.log(`🧹 تم إزالة الرموز المكررة في Supabase لـ ${res.rowCount} حساب/حسابات.`);
    } catch (err) {
      console.error('Error updating Supabase:', err.message);
    } finally {
      await client.end().catch(() => {});
    }
  }

  process.exit(0);
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
