-- Add nonce column to users table for SIWE (Sign-In With Ethereum)
ALTER TABLE users 
ADD COLUMN nonce VARCHAR(255) NULL AFTER wallet_address;

CREATE INDEX idx_nonce ON users(nonce);

