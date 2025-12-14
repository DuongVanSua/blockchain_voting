-- Migration: Add election_voters table
-- This table caches voter-election relationships for faster querying
-- It syncs with smart contract events but provides immediate database access

USE voting_system;

CREATE TABLE IF NOT EXISTS election_voters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    user_id INT NULL,
    voter_address VARCHAR(255) NOT NULL,
    registered_by VARCHAR(255) NULL,
    transaction_hash VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_election_id (election_id),
    INDEX idx_user_id (user_id),
    INDEX idx_voter_address (voter_address),
    INDEX idx_transaction_hash (transaction_hash),
    INDEX idx_is_active (is_active),
    UNIQUE KEY uk_election_voter (election_id, voter_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'election_voters table created successfully!' AS message;

