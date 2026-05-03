require('dotenv').config();
const { sequelize, connectDB } = require('./config/db');
require('./models/User');
require('./models/Halaqa');
require('./models/Student');
require('./models/DailyTracking');
require('./models/Prize');

async function listTables() {
  try {
    await connectDB();
    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log('Tables in database:', JSON.stringify(tables, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listTables();
