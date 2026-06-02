/**
 * نصوص مزامنة البيانات من قاعدة البيانات المحلية إلى Supabase
 * Script to sync data from local PostgreSQL database to Supabase PostgreSQL database
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// التحقق من المتغيرات المطلوبة
const requiredEnv = [
  'PG_HOST', 'PG_PORT', 'PG_USER', 'PG_PASSWORD', 'PG_DB',
  'SUPABASE_DB_URL'
];

const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ خطأ: المتغيرات التالية مفقودة في ملف .env:');
  console.error(missing.join(', '));
  console.log('\nيرجى إضافة تكوين Supabase إلى ملف .env أولاً. مثال:');
  console.log('SUPABASE_DB_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres\n');
  process.exit(1);
}

// قائمة الجداول بالترتيب الصحيح لتفادي مشاكل المفاتيح الخارجية
// TABLES TO SYNC IN DEPENDENCY ORDER (Insert/Upsert Order)
const TABLES_TO_SYNC = [
  { name: 'users', primaryKey: '_id' },
  { name: 'halaqat', primaryKey: '_id' },
  { name: 'students', primaryKey: '_id' },
  { name: 'daily_trackings', primaryKey: '_id' },
  { name: 'prizes', primaryKey: 'id' },
  { name: 'feedbacks', primaryKey: '_id' },
  { name: 'swimming_schedules', primaryKey: '_id' }
];

/**
 * الحصول على أعمدة الجدول ديناميكياً من قاعدة البيانات المحلية
 */
async function getTableColumns(client, tableName) {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = $1 AND table_schema = 'public'`,
    [tableName]
  );
  return res.rows.map(row => row.column_name);
}

/**
 * تحديث عداد الترقيم التلقائي (Sequence) في Supabase بعد المزامنة
 */
async function updateSequence(client, tableName, primaryKey) {
  try {
    const seqRes = await client.query(
      `SELECT pg_get_serial_sequence($1, $2) AS seq`,
      [tableName, primaryKey]
    );
    const seq = seqRes.rows[0]?.seq;
    if (seq) {
      await client.query(
        `SELECT setval($1, COALESCE(MAX("${primaryKey}"), 1)) FROM "${tableName}"`,
        [seq]
      );
      console.log(`⚡ تم تحديث تسلسل العمود (${primaryKey}) للجدول "${tableName}"`);
    }
  } catch (err) {
    // في حال لم يكن العمود ترقيماً تلقائياً، نتجاهل الخطأ
  }
}

/**
 * تشغيل عملية المزامنة
 */
async function runSync() {
  const startTime = Date.now();
  console.log(`\n==================================================`);
  console.log(`🔄 بدء عملية المزامنة: ${new Date().toLocaleString()}`);
  console.log(`==================================================`);

  // الاتصال بقاعدة البيانات المحلية
  const localClient = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB,
  });

  // الاتصال بقاعدة بيانات Supabase
  const supabaseClient = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: {
      rejectUnauthorized: false // مطلوب للاتصال الآمن بـ Supabase
    }
  });

  try {
    await localClient.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات المحلية بنجاح.');
    
    await supabaseClient.connect();
    console.log('✅ تم الاتصال بقاعدة بيانات Supabase بنجاح.');

    // التأكد من وجود الجداول والفهارس الهامة لتحسين الأداء في Supabase
    try {
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS feedbacks (
          "_id" SERIAL PRIMARY KEY,
          "userId" INTEGER NOT NULL,
          "type" VARCHAR(255) NOT NULL,
          "message" TEXT NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
        );
      `);
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS swimming_schedules (
          "_id" SERIAL PRIMARY KEY,
          "studentId" INTEGER NOT NULL,
          "date" DATE NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          UNIQUE ("studentId", "date")
        );
      `);
      await supabaseClient.query('CREATE INDEX IF NOT EXISTS "students_halaqaId" ON "students" ("halaqaId");');
      await supabaseClient.query('CREATE INDEX IF NOT EXISTS "students_parentId" ON "students" ("parentId");');
      await supabaseClient.query('CREATE INDEX IF NOT EXISTS "prizes_studentId" ON "prizes" ("studentId");');
      console.log('⚡ تم التأكد من تهيئة الجداول والفهارس في Supabase بنجاح.');
    } catch (indexErr) {
      console.warn('⚠️ تنبيه: تعذر تهيئة الجداول أو الفهارس في Supabase:', indexErr.message);
    }

    // 1️⃣ مرحلة الحذف (Delete Phase) بالترتيب العكسي لتفادي قيود المفاتيح الخارجية
    console.log('\n--- 1. مرحلة حذف السجلات المحذوفة محلياً (Delete Phase) ---');
    const REVERSE_TABLES = [...TABLES_TO_SYNC].reverse();
    
    for (const table of REVERSE_TABLES) {
      const tableName = table.name;
      const primaryKey = table.primaryKey;

      const columns = await getTableColumns(localClient, tableName);
      if (columns.length === 0) continue;

      // جلب المعرفات المحلية فقط
      const localRes = await localClient.query(`SELECT "${primaryKey}" FROM "${tableName}"`);
      const localIds = localRes.rows.map(r => r[primaryKey]);

      await supabaseClient.query('BEGIN');
      try {
        let deletedCount = 0;
        if (localIds.length === 0) {
          const delRes = await supabaseClient.query(`DELETE FROM "${tableName}"`);
          deletedCount = delRes.rowCount;
        } else {
          const delRes = await supabaseClient.query(
            `DELETE FROM "${tableName}" WHERE NOT ("${primaryKey}" = ANY($1))`,
            [localIds]
          );
          deletedCount = delRes.rowCount;
        }
        await supabaseClient.query('COMMIT');
        
        if (deletedCount > 0) {
          console.log(`• الجدول "${tableName}": تم حذف ${deletedCount} سجل غير موجود محلياً.`);
        } else {
          console.log(`• الجدول "${tableName}": لا توجد سجلات زائدة لحذفها.`);
        }
      } catch (err) {
        await supabaseClient.query('ROLLBACK');
        console.error(`❌ فشل حذف السجلات الزائدة لجدول "${tableName}":`, err.message);
        throw err;
      }
    }

    // 2️⃣ مرحلة الإضافة والتحديث (Upsert Phase) بالترتيب التصاعدي
    console.log('\n--- 2. مرحلة الإضافة والتحديث (Upsert Phase) ---');
    for (const table of TABLES_TO_SYNC) {
      const tableName = table.name;
      const primaryKey = table.primaryKey;

      const columns = await getTableColumns(localClient, tableName);
      if (columns.length === 0) {
        console.log(`⚠️ الجدول "${tableName}" غير موجود محلياً، تم تخطيه.`);
        continue;
      }

      // جلب البيانات المحلية
      const localRes = await localClient.query(`SELECT * FROM "${tableName}"`);
      const rows = localRes.rows;
      console.log(`• الجدول "${tableName}": جاري مزامنة ${rows.length} سجل...`);

      if (rows.length > 0) {
        await supabaseClient.query('BEGIN');
        try {
          const insertColumns = columns.map(c => `"${c}"`).join(', ');
          const updateClause = columns
            .filter(col => col !== primaryKey)
            .map(col => {
              // لا تمسح pushToken في السحابة إذا كان محلياً null (يُسجّل من الهاتف مباشرة)
              if (tableName === 'users' && col === 'pushToken') {
                return `"pushToken" = COALESCE(EXCLUDED."pushToken", "${tableName}"."pushToken")`;
              }
              return `"${col}" = EXCLUDED."${col}"`;
            })
            .join(', ');

          const batchSize = 100;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batchRows = rows.slice(i, i + batchSize);
            const valueRows = [];
            const flatValues = [];
            let paramCounter = 1;

            for (const row of batchRows) {
              const rowPlaceholders = [];
              for (const col of columns) {
                rowPlaceholders.push(`$${paramCounter++}`);
                flatValues.push(row[col]);
              }
              valueRows.push(`(${rowPlaceholders.join(', ')})`);
            }

            const upsertSql = `
              INSERT INTO "${tableName}" (${insertColumns})
              VALUES ${valueRows.join(', ')}
              ON CONFLICT ("${primaryKey}")
              ${updateClause ? `DO UPDATE SET ${updateClause}` : 'DO NOTHING'}
            `;

            await supabaseClient.query(upsertSql, flatValues);
          }

          await supabaseClient.query('COMMIT');
          console.log(`   └─ ✅ تم بنجاح مزامنة وتحديث ${rows.length} سجل.`);
        } catch (err) {
          await supabaseClient.query('ROLLBACK');
          console.error(`   └─ ❌ فشل في جدول "${tableName}":`, err.message);
          throw err;
        }
      }

      // تحديث متسلسلات الترقيم التلقائي
      await updateSequence(supabaseClient, tableName, primaryKey);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n==================================================`);
    console.log(`✅ تمت المزامنة بنجاح في غضون ${duration} ثانية.`);
    console.log(`==================================================`);

  } catch (error) {
    console.error(`\n❌ حدث خطأ أثناء المزامنة:`, error.message);
  } finally {
    await localClient.end();
    await supabaseClient.end();
  }
}

// التحقق من خيار التشغيل المستمر (Daemon Mode)
const args = process.argv.slice(2);
const isDaemon = args.includes('--daemon') || args.includes('-d');
const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10);

module.exports = { runSync, TABLES_TO_SYNC };

if (require.main === module) {
  if (isDaemon) {
    console.log(`🚀 تم بدء المزامنة في وضع التشغيل المستمر (Daemon Mode) كل ${intervalMinutes} دقائق.`);
    runSync();
    setInterval(runSync, intervalMinutes * 60 * 1000);
  } else {
    runSync().then(() => process.exit(0));
  }
}
