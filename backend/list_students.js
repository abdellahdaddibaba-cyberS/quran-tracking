require('dotenv').config();
const { connectDB, sequelize } = require('./config/db');
const Student = require('./models/Student');

const listStudents = async () => {
  try {
    await connectDB();
    const students = await Student.findAll({
      attributes: ['_id', 'name', 'parentId', 'halaqaId']
    });
    console.log('Students in database:');
    console.table(students.map(s => s.toJSON()));
    process.exit();
  } catch (error) {
    console.error('Error listing students:', error);
    process.exit(1);
  }
};

listStudents();
