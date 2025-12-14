-- Migration: Update elections.status ENUM from (UPCOMING, LIVE, CLOSED, CANCELLED) to (ONGOING, PAUSED)
-- Date: 2025-01-XX

USE voting_system;

-- Step 1: Update existing records
-- UPCOMING and LIVE -> ONGOING
-- CLOSED and CANCELLED -> ONGOING (or keep as is, but we'll use ONGOING for simplicity)
UPDATE elections 
SET status = 'ONGOING' 
WHERE status IN ('UPCOMING', 'LIVE', 'CLOSED', 'CANCELLED');

-- Step 2: Alter the ENUM to remove old values and add new ones
-- Note: MySQL doesn't support removing ENUM values directly, so we need to:
-- 1. Change column to VARCHAR temporarily
-- 2. Update values
-- 3. Change back to ENUM with new values

-- Change to VARCHAR temporarily
ALTER TABLE elections 
MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ONGOING';

-- Update any remaining old values
UPDATE elections 
SET status = 'ONGOING' 
WHERE status NOT IN ('ONGOING', 'PAUSED');

-- Change back to ENUM with new values
ALTER TABLE elections 
MODIFY COLUMN status ENUM('ONGOING', 'PAUSED') NOT NULL DEFAULT 'ONGOING';

-- Verify the change
SELECT DISTINCT status FROM elections;

