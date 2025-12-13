-- Script to insert Owner account with wallet address
-- Usage: Run this script in MySQL to create an Owner account
-- Password: owner123 (hashed with bcrypt)
-- 
-- IMPORTANT: If you get "Data truncated for column 'role'" error,
-- run migrations/add_owner_role.sql FIRST to update the ENUM

USE voting_system;

-- Ensure OWNER role exists in ENUM (run migrations/add_owner_role.sql if needed)
-- ALTER TABLE users MODIFY COLUMN role ENUM('VOTER', 'CREATOR', 'OWNER') NOT NULL DEFAULT 'VOTER';

-- Insert Owner account
-- Email: owner@votingsystem.com
-- Password: owner123
-- Wallet Address: Using Hardhat node Account #0 (for localhost development)
-- To get a new wallet: cd smartcontract && npm run generate-account
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
    updated_at = CURRENT_TIMESTAMP;

-- Verify the insert
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

