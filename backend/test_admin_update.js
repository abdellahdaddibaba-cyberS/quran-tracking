require('dotenv').config();
const { sequelize, connectDB } = require('./config/db');
const User = require('./models/User');

const testAdminUpdate = async () => {
  try {
    await connectDB();
    const parent = await User.create({
      username: 'testparent',
      password: 'oldpassword',
      fullName: 'Test Parent',
      role: 'parent'
    });
    console.log('Created parent, hash:', parent.password);
    
    // Now simulate admin update
    const userToUpdate = await User.findByPk(parent._id);
    await userToUpdate.update({ password: 'newpassword', username: 'testparent_new' });
    
    console.log('Updated parent, new hash:', userToUpdate.password);

    // Test compare
    const isMatch = await userToUpdate.comparePassword('newpassword');
    console.log('Matches new password?', isMatch);

    await parent.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testAdminUpdate();
