const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Vote = sequelize.define('Vote', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  electionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'election_id',
    references: {
      model: 'elections',
      key: 'id',
    },
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
  voterAddress: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'voter_address',
  },
  candidateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'candidate_id',
  },
  transactionHash: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'transaction_hash',
  },
  receiptIpfsHash: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'receipt_ipfs_hash',
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
  },
}, {
  tableName: 'votes',
  timestamps: true,
  underscored: true,
});

module.exports = Vote;

