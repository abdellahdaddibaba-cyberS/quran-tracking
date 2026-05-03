const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Prize = sequelize.define('Prize', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  icon: {
    type: DataTypes.STRING,
    defaultValue: 'star' // star, medal, trophy, crown
  }
}, {
  tableName: 'prizes'
});

module.exports = Prize;
