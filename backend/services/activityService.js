const { ActivityLog, User } = require('../models/index');

async function createActivityLog({ userId, action, details, ipAddress, userAgent }) {
  try {
    const activity = await ActivityLog.create({
      userId,
      action,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent,
    });
    return activity;
  } catch (error) {
    console.error('Error creating activity log:', error);
    throw error;
  }
}

async function getActivityLogs({ userId, page = 1, limit = 50 }) {
  try {
    const offset = (page - 1) * limit;
    
    const where = {};
    if (userId) {
      where.userId = userId;
    }

    const { count, rows } = await ActivityLog.findAndCountAll({
      where,
      limit,
      offset,
      order: [['timestamp', 'DESC']],
      include: userId ? [] : [{ model: User, as: 'user', attributes: ['id', 'email', 'name'] }],
    });

    return {
      activities: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      }
    };
  } catch (error) {
    console.error('Error getting activity logs:', error);
    throw error;
  }
}

module.exports = {
  createActivityLog,
  getActivityLogs,
};

