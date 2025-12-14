-- Migration: Add candidates table
-- This table stores candidate information for each election

USE voting_system;

CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    candidate_index INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    party VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    manifesto TEXT NOT NULL,
    description TEXT NULL,
    image_cid VARCHAR(255) NULL,
    image_url VARCHAR(500) NULL,
    vote_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    INDEX idx_election_id (election_id),
    INDEX idx_candidate_index (candidate_index),
    UNIQUE KEY uk_election_candidate_index (election_id, candidate_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'candidates table created successfully!' AS message;

