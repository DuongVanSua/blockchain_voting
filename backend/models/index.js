const User = require('./User');
const Election = require('./Election');
const Vote = require('./Vote');
const KYCSubmission = require('./KYCSubmission');
const ActivityLog = require('./ActivityLog');

// Define relationships
User.hasMany(Election, { foreignKey: 'createdBy', as: 'createdElections' });
Election.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(Vote, { foreignKey: 'userId', as: 'votes' });
Vote.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Election.hasMany(Vote, { foreignKey: 'electionId', as: 'votes' });
Vote.belongsTo(Election, { foreignKey: 'electionId', as: 'election' });

User.hasMany(KYCSubmission, { foreignKey: 'userId', as: 'kycSubmissions' });
KYCSubmission.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'activityLogs' });
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  User,
  Election,
  Vote,
  KYCSubmission,
  ActivityLog,
};

