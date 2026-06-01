/**
 * مزامنة أحادية الاتجاه: المحلي → Supabase فقط
 * One-way sync from local PostgreSQL to Supabase (local is source of truth)
 */

const { runSync } = require('./sync_to_supabase');

const args = process.argv.slice(2);
const isDaemon = args.includes('--daemon') || args.includes('-d');
const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10);

if (isDaemon) {
  console.log(`🚀 مزامنة المحلي → Supabase كل ${intervalMinutes} دقائق.`);
  runSync();
  setInterval(runSync, intervalMinutes * 60 * 1000);
} else {
  runSync().then(() => process.exit(0));
}
