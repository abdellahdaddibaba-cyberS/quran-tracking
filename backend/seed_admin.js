require('dotenv').config();
const { sequelize, connectDB } = require('./config/db');
const User = require('./models/User');

const seedAdmin = async () => {
  try {
    await connectDB();
    
    // Sync models
    await sequelize.sync();

    const adminExists = await User.findOne({ where: { username: 'admin' } });

    if (!adminExists) {
      await User.create({
        username: 'admin',
        password: 'admin', // Will be hashed by the model hook
        fullName: 'المدير العام',
        role: 'admin',
        isActive: true
      });
      console.log('✅ تم إنشاء مستخدم أدمن بنجاح: admin/admin');
    } else {
      console.log('ℹ️ مستخدم الأدمن موجود بالفعل');
    }
    
    process.exit();
  } catch (error) {
    console.error('❌ خطأ في إنشاء المستخدم:', error);
    process.exit(1);
  }
};

seedAdmin();
