const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sequelize } = require('../config/db');
const DailyTracking = require('../models/DailyTracking');
const Prize = require('../models/Prize');

async function clearPrizes() {
  try {
    console.log('--- Starting Prize Cleanup ---');
    
    // 1. Delete all records from Prizes table
    const deletedPrizes = await Prize.destroy({ where: {}, truncate: true, cascade: true });
    console.log(`✅ Cleared all manual prizes.`);

    // 2. Reset the 'rewarded' flag in DailyTracking table
    const [updatedCount] = await DailyTracking.update(
      { rewarded: false },
      { where: { rewarded: true } }
    );
    console.log(`✅ Reset rewarded flag for ${updatedCount} tracking records.`);

    console.log('--- Cleanup Complete ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

clearPrizes();
