const { Client } = require('pg');
const User = require('../models/User');

/**
 * مزامنة pushToken من Supabase إلى قاعدة البيانات المحلية
 * (الهاتف يحفظ الرمز على Render/Supabase بينما لوحة المعلم قد تستخدم PostgreSQL محلي)
 */
async function syncPushTokensFromSupabase() {
  const supabaseUrl = process.env.SUPABASE_DB_URL;
  if (!supabaseUrl) {
    return { synced: 0, skipped: true, reason: 'no_supabase_url' };
  }

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT "_id", username, "pushToken"
       FROM users
       WHERE role = 'parent' AND "pushToken" IS NOT NULL AND "pushToken" != ''`
    );

    let synced = 0;
    for (const row of rows) {
      const [countById] = await User.update(
        { pushToken: row.pushToken },
        { where: { _id: row._id, role: 'parent' } }
      );

      if (countById > 0) {
        synced += 1;
        continue;
      }

      const [countByUsername] = await User.update(
        { pushToken: row.pushToken },
        { where: { username: row.username, role: 'parent' } }
      );

      if (countByUsername > 0) synced += 1;
    }

    if (synced > 0) {
      console.log(`🔄 تمت مزامنة ${synced} رمز إشعار من Supabase`);
    }

    return { synced, total: rows.length };
  } catch (error) {
    console.error('❌ فشل مزامنة pushToken من Supabase:', error.message);
    return { synced: 0, error: error.message };
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * رفع pushToken إلى Supabase بعد حفظه محلياً (للتطوير المحلي)
 */
async function syncPushTokenToSupabase(userId, pushToken) {
  const supabaseUrl = process.env.SUPABASE_DB_URL;
  if (!supabaseUrl || !pushToken) return;

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(
      `UPDATE users SET "pushToken" = $1, "updatedAt" = NOW() WHERE "_id" = $2 AND role = 'parent'`,
      [pushToken, userId]
    );
  } catch (error) {
    console.error('❌ فشل رفع pushToken إلى Supabase:', error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { syncPushTokensFromSupabase, syncPushTokenToSupabase };
