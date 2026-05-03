require('dotenv').config();
const { connectDB } = require('./config/db');
const User = require('./models/User');
const Student = require('./models/Student');

const listData = async () => {
  try {
    await connectDB();
    const users = await User.findAll();
    const students = await Student.findAll();

    console.log('--- Users ---');
    console.table(users.map(u => ({ id: u._id, username: u.username, role: u.role, fullName: u.fullName })));

    console.log('\n--- Students ---');
    console.table(students.map(s => ({ id: s._id, name: s.name, parentId: s.parentId })));

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

listData();
