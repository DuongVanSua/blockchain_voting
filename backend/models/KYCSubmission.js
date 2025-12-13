const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const KYCSubmission = sequelize.define('KYCSubmission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id',
    },
  },
  nationalId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'national_id',
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'full_name',
  },
  dateOfBirth: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'date_of_birth',
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  idFrontHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'id_front_hash',
  },
  idBackHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'id_back_hash',
  },
  photoHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'photo_hash',
  },
  ipfsHash: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'ipfs_hash',
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'admin_notes',
  },
  rejectedReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejected_reason',
  },
  transactionHash: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'transaction_hash',
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'submitted_at',
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reviewed_at',
  },
  reviewedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reviewed_by',
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'kyc_submissions',
  timestamps: false,
  underscored: true,
});

module.exports = KYCSubmission;

