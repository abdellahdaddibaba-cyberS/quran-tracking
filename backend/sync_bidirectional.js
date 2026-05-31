/**
 * نصوص مزامنة البيانات الثنائية (Bidirectional Sync) بين قاعدة البيانات المحلية و Supabase
 * Two-way bidirectional synchronization script between Local database and Supabase using updatedAt (Last-Write-Wins)
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// التحقق من المتغيرات المطلوبة في ملف .env
const requiredEnv = [
  'PG_HOST', 'PG_PORT', 'PG_USER', 'PG_PASSWORD', 'PG_DB',
  'SUPABASE_DB_URL'
];

const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ خطأ: المتغيرات التالية مفقودة في ملف .env:');
  console.error(missing.join(', '));
  process.exit(1);
}

// قائمة الجداول بالترتيب الصحيح لتفادي مشاكل المفاتيح الخارجية
const TABLES_TO_SYNC = [
  { name: 'users', primaryKey: '_id' },
  { name: 'halaqat', primaryKey: '_id' },
  { name: 'students', primaryKey: '_id' },
  { name: 'daily_trackings', primaryKey: '_id' },
  { name: 'prizes', primaryKey: 'id' }
];

/**
 * الحصول على الأعمدة المشتركة بين الجدولين لتفادي الأخطاء البرمجية
 */
async function getCommonColumns(localClient, supabaseClient, tableName) {
  const query = `
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
  `;
  
  const localRes = await localClient.query(query, [tableName]);
  const supabaseRes = await supabaseClient.query(query, [tableName]);
  
  const localCols = localRes.rows.map(row => row.column_name);
  const supabaseCols = supabaseRes.rows.map(row => row.column_name);
  
  // الاحتفاظ بالأعمدة الموجودة في كلا الطرفين فقط
  return localCols.filter(col => supabaseCols.includes(col));
}

/**
 * تحديث عداد الترقيم التلقائي (Sequence) في كلا قواعد البيانات بعد الإدخال
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
    }
  } catch (err) {
    // نتجاهل الخطأ إذا لم يكن العمود ترقيماً تلقائياً
  }
}

/**
 * دالة المزامنة الثنائية
 */
async function runBidirectionalSync() {
  const startTime = Date.now();
  console.log(`\n==================================================`);
  console.log(`🔄 بدء المزامنة الثنائية (Two-Way Sync): ${new Date().toLocaleString()}`);
  console.log(`==================================================`);

  const localClient = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB,
    keepAlive: true,
    connectionTimeoutMillis: 30000,
  });

  const supabaseClient = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    connectionTimeoutMillis: 30000,
    query_timeout: 20000,
  });

  // منع تعطل العملية عند انقطاع الاتصال غير المتوقع
  supabaseClient.on('error', (err) => {
    console.error('⚠️ تحذير: انقطع اتصال Supabase:', err.message);
  });
  localClient.on('error', (err) => {
    console.error('⚠️ تحذير: انقطع اتصال قاعدة البيانات المحلية:', err.message);
  });

  try {
    await localClient.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات المحلية بنجاح.');
    
    await supabaseClient.connect();
    console.log('✅ تم الاتصال بقاعدة بيانات Supabase بنجاح.');

    // عدادات لتلخيص التغييرات
    const summary = {
      pushedToSupabase: 0,
      pulledToLocal: 0,
      insertedToSupabase: 0,
      insertedToLocal: 0,
      unchanged: 0
    };

    for (const table of TABLES_TO_SYNC) {
      const tableName = table.name;
      const primaryKey = table.primaryKey;

      console.log(`\n📂 جاري فحص الجدول: "${tableName}"...`);

      // 1. جلب الأعمدة المشتركة
      const columns = await getCommonColumns(localClient, supabaseClient, tableName);
      if (columns.length === 0) {
        console.log(`⚠️ الجدول "${tableName}" فارغ أو غير متطابق الأعمدة، تم تخطيه.`);
        continue;
      }

      // 2. جلب البيانات من الطرفين
      const localDataRes = await localClient.query(`SELECT * FROM "${tableName}"`);
      const supabaseDataRes = await supabaseClient.query(`SELECT * FROM "${tableName}"`);

      // تحويل البيانات إلى خرائط (Maps) برمز المعرف الأساسي للبحث السريع
      const localMap = new Map(localDataRes.rows.map(row => [String(row[primaryKey]), row]));
      const supabaseMap = new Map(supabaseDataRes.rows.map(row => [String(row[primaryKey]), row]));

      // جمع كافة المعرفات الفريدة
      const allKeys = new Set([...localMap.keys(), ...supabaseMap.keys()]);

      let tablePushed = 0;
      let tablePulled = 0;
      let tableInsSupabase = 0;
      let tableInsLocal = 0;

      for (const id of allKeys) {
        const localRecord = localMap.get(id);
        const supabaseRecord = supabaseMap.get(id);

        if (localRecord && supabaseRecord) {
          // السجل موجود في الطرفين ➔ فحص التحديث الأكثر حداثة (Last-Write-Wins)
          const localUpdated = new Date(localRecord.updatedAt || localRecord.createdAt || 0);
          const supabaseUpdated = new Date(supabaseRecord.updatedAt || supabaseRecord.createdAt || 0);

          if (localUpdated > supabaseUpdated) {
            // المحلي أحدث ➔ نرسل إلى Supabase
            const filteredCols = columns.filter(col => col !== primaryKey);
            const updateClause = filteredCols
              .map((col, idx) => `"${col}" = $${idx + 1}`)
              .join(', ');
            
            const values = filteredCols.map(col => localRecord[col]);
            values.push(localRecord[primaryKey]);
            const sql = `UPDATE "${tableName}" SET ${updateClause} WHERE "${primaryKey}" = $${values.length}`;
            
            await supabaseClient.query(sql, values);
            tablePushed++;
            summary.pushedToSupabase++;
          } 
          else if (supabaseUpdated > localUpdated) {
            // سوبابيس أحدث ➔ نسحب للمحلي
            const filteredCols = columns.filter(col => col !== primaryKey);
            const updateClause = filteredCols
              .map((col, idx) => `"${col}" = $${idx + 1}`)
              .join(', ');
            
            const values = filteredCols.map(col => supabaseRecord[col]);
            values.push(supabaseRecord[primaryKey]);
            const sql = `UPDATE "${tableName}" SET ${updateClause} WHERE "${primaryKey}" = $${values.length}`;
            
            await localClient.query(sql, values);
            tablePulled++;
            summary.pulledToLocal++;
          } else {
            summary.unchanged++;
          }
        } 
        else if (localRecord && !supabaseRecord) {
          // السجل موجود محلياً فقط ➔ إدراجه في Supabase
          const colNames = columns.map(c => `"${c}"`).join(', ');
          const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
          const values = columns.map(col => localRecord[col]);
          
          const sql = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;
          await supabaseClient.query(sql, values);
          
          tableInsSupabase++;
          summary.insertedToSupabase++;
        } 
        else if (!localRecord && supabaseRecord) {
          // السجل موجود في Supabase فقط ➔ إدراجه محلياً
          const colNames = columns.map(c => `"${c}"`).join(', ');
          const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
          const values = columns.map(col => supabaseRecord[col]);
          
          const sql = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;
          await localClient.query(sql, values);
          
          tableInsLocal++;
          summary.insertedToLocal++;
        }
      }

      // تحديث عدادات التسلسل التلقائي في الطرفين لضمان عدم حدوث تصانب مستقبلي
      await updateSequence(localClient, tableName, primaryKey);
      await updateSequence(supabaseClient, tableName, primaryKey);

      if (tablePushed > 0 || tablePulled > 0 || tableInsSupabase > 0 || tableInsLocal > 0) {
        console.log(`   ⬆️ تم الدفع إلى Supabase: ${tablePushed} تحديث، ${tableInsSupabase} سجل جديد`);
        console.log(`   ⬇️ تم السحب إلى المحلي: ${tablePulled} تحديث، ${tableInsLocal} سجل جديد`);
      } else {
        console.log('   🟢 متطابق بنجاح، لا توجد تغييرات معلقة.');
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n==================================================`);
    console.log(`✅ تمت المزامنة الثنائية بنجاح في غضون ${duration} ثانية.`);
    console.log(`📊 ملخص المزامنة:`);
    console.log(`   • تحديثات تم دفعها للسحابة (Push): ${summary.pushedToSupabase}`);
    console.log(`   • سجلات جديدة تم دفعها للسحابة: ${summary.insertedToSupabase}`);
    console.log(`   • تحديثات تم سحبها للمحلي (Pull): ${summary.pulledToLocal}`);
    console.log(`   • سجلات جديدة تم سحبها للمحلي: ${summary.insertedToLocal}`);
    console.log(`   • سجلات متطابقة مسبقاً: ${summary.unchanged}`);
    console.log(`==================================================\n`);

  } catch (error) {
    console.error(`\n❌ حدث خطأ أثناء المزامنة الثنائية:`, error.message);
  } finally {
    await localClient.end();
    await supabaseClient.end();
  }
}

// تشغيل المزامنة
const args = process.argv.slice(2);
const isDaemon = args.includes('--daemon') || args.includes('-d');
const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10);

if (isDaemon) {
  console.log(`🚀 تم بدء المزامنة الثنائية التلقائية كل ${intervalMinutes} دقائق.`);
  runBidirectionalSync();
  setInterval(runBidirectionalSync, intervalMinutes * 60 * 1000);
} else {
  runBidirectionalSync().then(() => process.exit(0));
}
