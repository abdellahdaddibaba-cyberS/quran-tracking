require('dotenv').config();
const { connectDB, sequelize } = require('./config/db');
const Halaqa = require('./models/Halaqa');

const listHalaqat = async () => {
  try {
    await connectDB();
    const halaqat = await Halaqa.findAll();
    console.log('Halaqat in database:');
    console.table(halaqat.map(h => h.toJSON()));
    process.exit();
  } catch (error) {
    console.error('Error listing halaqat:', error);
    process.exit(1);
  }
};

listHalaqat();
