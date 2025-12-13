-- Complete script: Fix role ENUM and insert Owner account
-- This script handles existing data that might have invalid role values
-- Run this if you get "Data truncated for column 'role'" error

USE voting_system;

-- Step 1: Check current role values in the table
SELECT DISTINCT role, COUNT(*) as count 
FROM users 
GROUP BY role;

-- Step 2: Update any invalid role values to 'VOTER' (or appropriate default)
-- This handles any old role values that might exist
UPDATE users 
SET role = 'VOTER' 
WHERE role NOT IN ('VOTER', 'CREATOR', 'OWNER') 
   OR role IS NULL;

-- Step 3: Now safely alter the table to add OWNER to ENUM
ALTER TABLE users 
MODIFY COLUMN role ENUM('VOTER', 'CREATOR', 'OWNER') NOT NULL DEFAULT 'VOTER';

-- Step 4: Verify the ENUM was updated
SHOW COLUMNS FROM users WHERE Field = 'role';

-- Step 5: Insert Owner account
-- Email: owner@votingsystem.com
-- Password: owner123
-- Wallet Address: Using Hardhat node Account #0 (for localhost development)
INSERT INTO users (
    email, 
    password_hash, 
    name, 
    role, 
    wallet_address,
    kyc_status, 
    is_active,
    is_blocked
) VALUES (
    'owner@votingsystem.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5Y', -- Password: owner123 (bcrypt hash)
    'System Owner',
    'OWNER',
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', -- Hardhat node Account #0 (localhost)
    'APPROVED',
    TRUE,
    FALSE
)
ON DUPLICATE KEY UPDATE
    wallet_address = VALUES(wallet_address),
    role = 'OWNER',
    updated_at = CURRENT_TIMESTAMP;

-- Step 6: Verify the insert
SELECT 
    id,
    email,
    name,
    role,
    wallet_address,
    kyc_status,
    is_active,
    created_at
FROM users 
WHERE email = 'owner@votingsystem.com';

SELECT 'Owner account created/updated successfully!' AS message;

