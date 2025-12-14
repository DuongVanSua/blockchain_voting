const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Candidate = sequelize.define('Candidate', {
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
  candidateIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'candidate_index'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  party: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  manifesto: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  imageCid: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'image_cid'
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'image_url'
  },
  voteCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'vote_count'
  }
}, {
  tableName: 'candidates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['election_id', 'candidate_index'],
      name: 'uk_election_candidate_index'
    },
    {
      fields: ['election_id']
    },
    {
      fields: ['candidate_index']
    }
  ]
});

module.exports = Candidate;

