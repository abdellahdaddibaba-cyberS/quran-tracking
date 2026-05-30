require('dotenv').config();
const { connectDB } = require('./config/db');
const User = require('./models/User');

const checkParents = async () => {
  try {
    await connectDB();
    const parents = await User.findAll({
      where: { role: 'parent' },
      attributes: ['_id', 'username', 'fullName', 'password']
    });
    
    for (const parent of parents) {
      const p = parent.toJSON();
      console.log(`\nID: ${p._id}`);
      console.log(`Username: "${p.username}"`);
      console.log(`FullName: "${p.fullName}"`);
      console.log(`Password hash: ${p.password}`);
      
      // Try common passwords
      const tryPasswords = ['salah', 'salah123', 'admin', '123456', 'قاسم', 'parent', '111111'];
      for (const pw of tryPasswords) {
        const match = await parent.comparePassword(pw);
        if (match) console.log(`  ✅ Password found: "${pw}"`);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

checkParents();
