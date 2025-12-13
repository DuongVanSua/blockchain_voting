-- Migration: Add OWNER role to users table ENUM
-- Run this BEFORE insert_owner.sql if you get "Data truncated for column 'role'" error

USE voting_system;

-- Check current ENUM values
SHOW COLUMNS FROM users WHERE Field = 'role';

-- Alter table to add OWNER to ENUM
ALTER TABLE users 
MODIFY COLUMN role ENUM('VOTER', 'CREATOR', 'OWNER') NOT NULL DEFAULT 'VOTER';

-- Verify the change
SHOW COLUMNS FROM users WHERE Field = 'role';

SELECT 'Role ENUM updated successfully! OWNER role is now available.' AS message;

