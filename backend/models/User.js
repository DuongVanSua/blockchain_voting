const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'password_hash',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('VOTER', 'CREATOR', 'OWNER'),
    allowNull: false,
    defaultValue: 'VOTER',
  },
  walletAddress: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    field: 'wallet_address',
  },
  nonce: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'nonce',
  },
  kycStatus: {
    type: DataTypes.ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED'),
    allowNull: false,
    defaultValue: 'NONE',
    field: 'kyc_status',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_blocked',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
  },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
});

// Instance method to check password
User.prototype.checkPassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

// Instance method to hash password
User.hashPassword = async function(password) {
  return bcrypt.hash(password, 10);
};

module.exports = User;

