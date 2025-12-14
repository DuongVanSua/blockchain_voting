-- Script to check and fix election contract addresses
-- Run this to see current state and normalize addresses

USE voting_system;

-- 1. Check current elections and their contract addresses
SELECT 
    id,
    title,
    contract_address,
    LOWER(contract_address) AS normalized_address,
    CASE 
        WHEN contract_address = LOWER(contract_address) THEN 'OK'
        ELSE 'NEEDS NORMALIZATION'
    END AS status
FROM elections
WHERE contract_address IS NOT NULL;

-- 2. Normalize all contract addresses to lowercase
UPDATE elections 
SET contract_address = LOWER(contract_address)
WHERE contract_address IS NOT NULL 
  AND contract_address != LOWER(contract_address);

-- 3. Check election_voters table
SELECT 
    ev.id,
    ev.election_id,
    ev.voter_address,
    ev.is_active,
    e.contract_address,
    e.title
FROM election_voters ev
LEFT JOIN elections e ON ev.election_id = e.id
ORDER BY ev.created_at DESC;

-- 4. Count voters per election
SELECT 
    e.id,
    e.title,
    e.contract_address,
    COUNT(ev.id) AS voter_count
FROM elections e
LEFT JOIN election_voters ev ON e.id = ev.election_id AND ev.is_active = 1
GROUP BY e.id, e.title, e.contract_address;

