-- Diagnostic script: Check and fix role values
-- Run this first to see what role values exist in your database

USE voting_system;

-- Check current ENUM definition
SHOW COLUMNS FROM users WHERE Field = 'role';

-- Check all role values in the table
SELECT 
    role, 
    COUNT(*) as count,
    GROUP_CONCAT(DISTINCT email) as emails
FROM users 
GROUP BY role;

-- Check for any NULL or invalid roles
SELECT 
    id,
    email,
    name,
    role,
    CASE 
        WHEN role IS NULL THEN 'NULL'
        WHEN role NOT IN ('VOTER', 'CREATOR', 'OWNER') THEN 'INVALID'
        ELSE 'VALID'
    END as status
FROM users
WHERE role IS NULL OR role NOT IN ('VOTER', 'CREATOR', 'OWNER');

-- If there are invalid roles, update them first:
-- UPDATE users SET role = 'VOTER' WHERE role IS NULL OR role NOT IN ('VOTER', 'CREATOR', 'OWNER');

