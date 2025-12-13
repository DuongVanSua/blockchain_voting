const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Election = sequelize.define('Election', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  electionType: {
    type: DataTypes.ENUM('PRESIDENTIAL', 'PARLIAMENTARY', 'LOCAL', 'REFERENDUM'),
    allowNull: false,
    field: 'election_type',
  },
  contractAddress: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    field: 'contract_address',
  },
  ipfsHash: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'ipfs_hash',
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_time',
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_time',
  },
  status: {
    type: DataTypes.ENUM('UPCOMING', 'LIVE', 'CLOSED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'UPCOMING',
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id',
    },
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
  tableName: 'elections',
  timestamps: true,
  underscored: true,
});

module.exports = Election;

