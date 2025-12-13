require('dotenv').config();
const { Sequelize } = require('sequelize');

let DATABASE_URL = process.env.DATABASE_URL || 
  `mysql://${process.env.DB_USER || 'root'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'voting_system'}`;

// Fix: Convert mysql+pymysql (Python/SQLAlchemy format) to mysql (Sequelize format)
if (DATABASE_URL.startsWith('mysql+pymysql://')) {
  DATABASE_URL = DATABASE_URL.replace('mysql+pymysql://', 'mysql://');
}

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true
  }
});

module.exports = { sequelize };

