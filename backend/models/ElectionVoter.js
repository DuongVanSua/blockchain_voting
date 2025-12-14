const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ElectionVoter = sequelize.define('ElectionVoter', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  electionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'election_id',
    references: {
      model: 'elections',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  voterAddress: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'voter_address'
  },
  registeredBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'registered_by'
  },
  transactionHash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'transaction_hash'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'election_voters',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['election_id', 'voter_address'],
      name: 'uk_election_voter'
    },
    {
      fields: ['election_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['voter_address']
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = ElectionVoter;

