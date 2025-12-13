-- Migration: Add ipfs_hash column to elections table
-- Date: 2025-12-11

USE voting_system;

-- Check if column exists before adding
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'voting_system' 
    AND TABLE_NAME = 'elections' 
    AND COLUMN_NAME = 'ipfs_hash'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE elections ADD COLUMN ipfs_hash VARCHAR(255) NULL AFTER contract_address',
    'SELECT "Column ipfs_hash already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if index exists before creating
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'voting_system' 
    AND TABLE_NAME = 'elections' 
    AND INDEX_NAME = 'idx_ipfs_hash'
);

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_ipfs_hash ON elections(ipfs_hash)',
    'SELECT "Index idx_ipfs_hash already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration completed: ipfs_hash column added to elections table' AS message;

