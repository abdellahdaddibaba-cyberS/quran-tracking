require('dotenv').config();
const { sequelize, connectDB } = require('./config/db');
const User = require('./models/User');

const getParents = async () => {
  try {
    await connectDB();
    const parents = await User.findAll({
      where: { role: 'parent' },
      attributes: ['_id', 'username', 'fullName', 'phoneNumber', 'isActive', 'createdAt'],
      order: [['fullName', 'ASC']]
    });
    console.log('\n=== قائمة أولياء الأمور ===');
    console.table(parents.map(p => p.toJSON()));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

getParents();
