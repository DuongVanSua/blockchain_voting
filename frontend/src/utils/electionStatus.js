/**
 * Derive election status from database status, startTime, and endTime
 * Database status can be: 'ONGOING' or 'PAUSED'
 * Derived status can be: 'UPCOMING', 'ONGOING', 'PAUSED', 'ENDED'
 * 
 * @param {string} dbStatus - Database status ('ONGOING' or 'PAUSED')
 * @param {string|number|Date} startTime - Election start time
 * @param {string|number|Date} endTime - Election end time
 * @returns {string} - Derived status: 'UPCOMING', 'ONGOING', 'PAUSED', or 'ENDED'
 */
export const deriveElectionStatus = (dbStatus, startTime, endTime) => {
  // If database status is PAUSED, return PAUSED
  if (dbStatus === 'PAUSED') {
    return 'PAUSED';
  }

  // If database status is not ONGOING, default to ONGOING for backward compatibility
  if (dbStatus !== 'ONGOING') {
    // eslint-disable-next-line no-console
    console.warn('[deriveElectionStatus] Unknown database status:', dbStatus, '- defaulting to ONGOING');
  }

  // Parse startTime and endTime
  const now = new Date();
  let startTimeDate = null;
  let endTimeDate = null;

  try {
    // Parse startTime
    if (startTime) {
      let startTimeValue = startTime;
      
      // If string, try to parse as number
      if (typeof startTimeValue === 'string') {
        const parsed = Number(startTimeValue);
        if (!isNaN(parsed)) {
          startTimeValue = parsed;
        }
      }
      
      // If number, check if it's seconds (timestamp < year 2100 in seconds)
      if (typeof startTimeValue === 'number') {
        if (startTimeValue < 4102444800) {
          startTimeDate = new Date(startTimeValue * 1000); // Convert seconds to milliseconds
        } else {
          startTimeDate = new Date(startTimeValue); // Already in milliseconds
        }
      } else {
        startTimeDate = new Date(startTimeValue);
      }
      
      if (isNaN(startTimeDate.getTime())) {
        startTimeDate = null;
      }
    }

    // Parse endTime
    if (endTime) {
      let endTimeValue = endTime;
      
      // If string, try to parse as number
      if (typeof endTimeValue === 'string') {
        const parsed = Number(endTimeValue);
        if (!isNaN(parsed)) {
          endTimeValue = parsed;
        }
      }
      
      // If number, check if it's seconds (timestamp < year 2100 in seconds)
      if (typeof endTimeValue === 'number') {
        if (endTimeValue < 4102444800) {
          endTimeDate = new Date(endTimeValue * 1000); // Convert seconds to milliseconds
        } else {
          endTimeDate = new Date(endTimeValue); // Already in milliseconds
        }
      } else {
        endTimeDate = new Date(endTimeValue);
      }
      
      if (isNaN(endTimeDate.getTime())) {
        endTimeDate = null;
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[deriveElectionStatus] Error parsing dates:', error);
    // If parsing fails, default to ONGOING
    return 'ONGOING';
  }

  // If dates are invalid, default to ONGOING
  if (!startTimeDate || !endTimeDate) {
    // eslint-disable-next-line no-console
    console.warn('[deriveElectionStatus] Invalid dates - defaulting to ONGOING');
    return 'ONGOING';
  }

  // Derive status based on time
  if (now < startTimeDate) {
    // Election hasn't started yet
    return 'UPCOMING';
  } else if (now >= startTimeDate && now <= endTimeDate) {
    // Election is currently running
    return 'ONGOING';
  } else {
    // Election has ended
    return 'ENDED';
  }
};

/**
 * Get status badge variant for UI
 * @param {string} status - Derived status: 'UPCOMING', 'ONGOING', 'PAUSED', or 'ENDED'
 * @returns {object} - Badge variant and label
 */
export const getStatusBadge = (status) => {
  const statusMap = {
    'UPCOMING': { label: 'Sắp diễn ra', variant: 'primary', color: 'bg-orange-100 text-orange-800' },
    'ONGOING': { label: 'Đang diễn ra', variant: 'success', color: 'bg-green-100 text-green-800' },
    'PAUSED': { label: 'Tạm dừng', variant: 'warning', color: 'bg-yellow-100 text-yellow-800' },
    'ENDED': { label: 'Đã kết thúc', variant: 'error', color: 'bg-red-100 text-red-800' },
  };

  return statusMap[status] || { label: status, variant: 'primary', color: 'bg-gray-100 text-gray-800' };
};

