-- Migration: Normalize all contract_address to lowercase
-- This ensures consistent querying regardless of case

USE voting_system;

-- Update all elections to have lowercase contract_address
UPDATE elections 
SET contract_address = LOWER(contract_address)
WHERE contract_address IS NOT NULL 
  AND contract_address != LOWER(contract_address);

SELECT 'Contract addresses normalized to lowercase!' AS message;
SELECT COUNT(*) AS updated_count FROM elections WHERE contract_address IS NOT NULL;

