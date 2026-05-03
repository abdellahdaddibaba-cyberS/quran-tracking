require('dotenv').config();
const { connectDB, sequelize } = require('./config/db');
const User = require('./models/User');
const Student = require('./models/Student');

const checkLinks = async () => {
  try {
    await connectDB();
    const students = await Student.findAll({
      include: [{ model: User, as: 'parent', attributes: ['username', 'fullName'] }]
    });
    console.log('Students and their parents:');
    console.table(students.map(s => ({
      id: s._id,
      name: s.name,
      parentId: s.parentId,
      parentName: s.parent ? s.parent.fullName : 'NONE'
    })));
    process.exit();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkLinks();
