require('dotenv').config();
const { Sequelize } = require('sequelize');
const { performance } = require('perf_hooks');

// 1. Initialize Local Database
const localSequelize = new Sequelize(
  String(process.env.PG_DB),
  String(process.env.PG_USER),
  String(process.env.PG_PASSWORD),
  {
    host: String(process.env.PG_HOST),
    port: process.env.PG_PORT,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// 2. Initialize Supabase Database if URL is provided
let supabaseSequelize = null;
if (process.env.SUPABASE_DB_URL) {
  try {
    supabaseSequelize = new Sequelize(process.env.SUPABASE_DB_URL.trim(), {
      dialect: 'postgres',
      logging: false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      dialectOptions: {
        ssl: {
          rejectUnauthorized: false
        }
      }
    });
  } catch (err) {
    console.error('Failed to parse SUPABASE_DB_URL:', err.message);
  }
}

async function runBenchmarks(dbName, sequelizeInstance) {
  console.log(`\n==============================================`);
  console.log(`🚀 RUNNING BENCHMARKS FOR: ${dbName}`);
  console.log(`==============================================`);
  const results = {};

  try {
    await sequelizeInstance.authenticate();
    console.log(`✅ Successfully connected to ${dbName}. Starting tests...`);
  } catch (err) {
    console.error(`❌ Connection failed for ${dbName}:`, err.message);
    return null;
  }

  // --- Test 1: Connection Ping (SELECT 1) ---
  const pingTimes = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await sequelizeInstance.query('SELECT 1');
    pingTimes.push(performance.now() - start);
  }
  results.pingMin = Math.min(...pingTimes);
  results.pingMax = Math.max(...pingTimes);
  results.pingAvg = pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length;
  console.log(`[Ping] Avg: ${results.pingAvg.toFixed(2)}ms | Min: ${results.pingMin.toFixed(2)}ms | Max: ${results.pingMax.toFixed(2)}ms`);

  // --- Test 2: Standard Select Limit 100 ---
  try {
    const readTimes = [];
    let count = 0;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const rows = await sequelizeInstance.query('SELECT * FROM "students" LIMIT 100', { type: sequelizeInstance.QueryTypes.SELECT });
      readTimes.push(performance.now() - start);
      count = rows.length;
    }
    results.readMin = Math.min(...readTimes);
    results.readMax = Math.max(...readTimes);
    results.readAvg = readTimes.reduce((a, b) => a + b, 0) / readTimes.length;
    console.log(`[Read Students (Limit 100, count: ${count})] Avg: ${results.readAvg.toFixed(2)}ms | Min: ${results.readMin.toFixed(2)}ms | Max: ${results.readMax.toFixed(2)}ms`);
  } catch (err) {
    console.log(`[Read Students] Skipped or failed: ${err.message}`);
  }

  // --- Test 3: Complex Join Query ---
  try {
    const joinTimes = [];
    let count = 0;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const rows = await sequelizeInstance.query(
        `SELECT dt."studentId", dt."date", dt."pagesRequired", dt."pagesMemorized", dt."isSurahCompleted", s."name" as "studentName", h."name" as "halaqaName" 
         FROM "daily_trackings" dt 
         JOIN "students" s ON dt."studentId" = s."_id" 
         JOIN "halaqat" h ON s."halaqaId" = h."_id" 
         ORDER BY dt."date" DESC LIMIT 100`, 
        { type: sequelizeInstance.QueryTypes.SELECT }
      );
      joinTimes.push(performance.now() - start);
      count = rows.length;
    }
    results.joinMin = Math.min(...joinTimes);
    results.joinMax = Math.max(...joinTimes);
    results.joinAvg = joinTimes.reduce((a, b) => a + b, 0) / joinTimes.length;
    console.log(`[Complex Join (Limit 100, count: ${count})] Avg: ${results.joinAvg.toFixed(2)}ms | Min: ${results.joinMin.toFixed(2)}ms | Max: ${results.joinMax.toFixed(2)}ms`);
  } catch (err) {
    console.log(`[Complex Join] Skipped or failed: ${err.message}`);
  }

  // --- Test 4: Single Write Latency (Transaction + Rollback) ---
  try {
    const writeTimes = [];
    for (let i = 0; i < 5; i++) {
      const t = await sequelizeInstance.transaction();
      try {
        const start = performance.now();
        await sequelizeInstance.query(
          `INSERT INTO "halaqat" ("name", "supervisor", "createdAt", "updatedAt") 
           VALUES ('Benchmark Halaqa', 'Benchmark Supervisor', NOW(), NOW())`, 
          { transaction: t }
        );
        writeTimes.push(performance.now() - start);
      } finally {
        await t.rollback();
      }
    }
    results.writeMin = Math.min(...writeTimes);
    results.writeMax = Math.max(...writeTimes);
    results.writeAvg = writeTimes.reduce((a, b) => a + b, 0) / writeTimes.length;
    console.log(`[Single Write (rolled back)] Avg: ${results.writeAvg.toFixed(2)}ms | Min: ${results.writeMin.toFixed(2)}ms | Max: ${results.writeMax.toFixed(2)}ms`);
  } catch (err) {
    console.log(`[Single Write] Skipped or failed: ${err.message}`);
  }

  // --- Test 5: Bulk Write Latency (50 rows in 1 Single Query inside Transaction + Rollback) ---
  try {
    const t = await sequelizeInstance.transaction();
    try {
      const start = performance.now();
      
      const values = [];
      const replacements = {};
      for (let i = 0; i < 50; i++) {
        values.push(`(:name${i}, :supervisor${i}, NOW(), NOW())`);
        replacements[`name${i}`] = `Benchmark Halaqa Bulk ${i}`;
        replacements[`supervisor${i}`] = `Benchmark Supervisor`;
      }
      
      const bulkQuery = `
        INSERT INTO "halaqat" ("name", "supervisor", "createdAt", "updatedAt") 
        VALUES ${values.join(', ')}
      `;
      
      await sequelizeInstance.query(bulkQuery, { replacements, transaction: t });
      
      results.bulkWriteTime = performance.now() - start;
      console.log(`[Bulk Write (50 rows in 1 query inside 1 Transaction)] Elapsed: ${results.bulkWriteTime.toFixed(2)}ms`);
    } finally {
      await t.rollback();
    }
  } catch (err) {
    console.log(`[Bulk Write] Skipped or failed: ${err.message}`);
  }

  // --- Test 6: Concurrent Queries ---
  try {
    const start = performance.now();
    await Promise.all(
      Array.from({ length: 10 }).map(() => sequelizeInstance.query('SELECT 1'))
    );
    results.concurrentTime = performance.now() - start;
    console.log(`[Concurrent (10 parallel SELECT 1 queries)] Elapsed: ${results.concurrentTime.toFixed(2)}ms`);
  } catch (err) {
    console.log(`[Concurrent Queries] Skipped or failed: ${err.message}`);
  }

  return results;
}

async function run() {
  console.log('🔍 Starting Database Performance Diagnostics...');
  
  const localResults = await runBenchmarks('Local PostgreSQL', localSequelize);
  
  let supabaseResults = null;
  if (supabaseSequelize) {
    supabaseResults = await runBenchmarks('Supabase cloud PostgreSQL', supabaseSequelize);
  } else {
    console.log('\nℹ Supabase DB URL is not set or invalid, skipping Supabase benchmarks.');
  }

  console.log('\n==============================================');
  console.log('📊 PERFORMANCE SUMMARY REPORT');
  console.log('==============================================');

  if (localResults) {
    console.log(`Local PostgreSQL:`);
    console.log(`  - Ping Latency:          ${localResults.pingAvg.toFixed(2)}ms`);
    if (localResults.readAvg) console.log(`  - Read (100 students):   ${localResults.readAvg.toFixed(2)}ms`);
    if (localResults.joinAvg) console.log(`  - Complex Join (100):    ${localResults.joinAvg.toFixed(2)}ms`);
    if (localResults.writeAvg) console.log(`  - Write (Rollback):      ${localResults.writeAvg.toFixed(2)}ms`);
    if (localResults.bulkWriteTime) console.log(`  - Bulk Write (50 rows):  ${localResults.bulkWriteTime.toFixed(2)}ms`);
    if (localResults.concurrentTime) console.log(`  - 10 Parallel Queries:   ${localResults.concurrentTime.toFixed(2)}ms`);
  }

  if (supabaseResults) {
    console.log(`\nSupabase Cloud PostgreSQL:`);
    console.log(`  - Ping Latency:          ${supabaseResults.pingAvg.toFixed(2)}ms`);
    if (supabaseResults.readAvg) console.log(`  - Read (100 students):   ${supabaseResults.readAvg.toFixed(2)}ms`);
    if (supabaseResults.joinAvg) console.log(`  - Complex Join (100):    ${supabaseResults.joinAvg.toFixed(2)}ms`);
    if (supabaseResults.writeAvg) console.log(`  - Write (Rollback):      ${supabaseResults.writeAvg.toFixed(2)}ms`);
    if (supabaseResults.bulkWriteTime) console.log(`  - Bulk Write (50 rows):  ${supabaseResults.bulkWriteTime.toFixed(2)}ms`);
    if (supabaseResults.concurrentTime) console.log(`  - 10 Parallel Queries:   ${supabaseResults.concurrentTime.toFixed(2)}ms`);
    
    console.log('\n💡 Comparison (Supabase vs Local):');
    const ratio = supabaseResults.pingAvg / localResults.pingAvg;
    console.log(`  - Network/Ping overhead: Supabase is ~${ratio.toFixed(1)}x slower than Local localhost due to internet round-trip latency.`);
  }

  await localSequelize.close();
  if (supabaseSequelize) await supabaseSequelize.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Benchmark script crashed:', err);
  process.exit(1);
});
