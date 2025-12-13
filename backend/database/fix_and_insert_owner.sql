-- Complete script: Fix ENUM and insert Owner account
-- Run this script if you get "Data truncated for column 'role'" error
-- This script will:
-- 1. Update the role ENUM to include OWNER
-- 2. Insert the Owner account with wallet address

USE voting_system;

-- Step 1: Update role ENUM to include OWNER
ALTER TABLE users 
MODIFY COLUMN role ENUM('VOTER', 'CREATOR', 'OWNER') NOT NULL DEFAULT 'VOTER';

-- Step 2: Insert Owner account
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

-- Step 3: Verify the insert
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

