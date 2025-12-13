USE voting_system;

-- Creator user (password: creator123) - for creating elections
INSERT INTO users (email, password_hash, name, role, kyc_status, is_active) VALUES
('creator@votingsystem.com', '$2b$12$BHvroZSGK305tuXkVWsm4u1PkpkJM2vlMxH9H7xeSyEWimJhceNYW', 'Election Creator', 'CREATOR', 'APPROVED', TRUE);

-- Regular voters (password: voter123)
INSERT INTO users (email, password_hash, name, phone, role, kyc_status, is_active) VALUES
('voter1@example.com', '$2b$12$/bHyMBsJaHHwUVrUe8eUzOJqmNATaY/0cyfy1neqpVSpb4ZrwZJpG', 'Nguyễn Văn A', '0123456789', 'VOTER', 'APPROVED', TRUE),
('voter2@example.com', '$2b$12$/bHyMBsJaHHwUVrUe8eUzOJqmNATaY/0cyfy1neqpVSpb4ZrwZJpG', 'Trần Thị B', '0987654321', 'VOTER', 'PENDING', TRUE),
('voter3@example.com', '$2b$12$/bHyMBsJaHHwUVrUe8eUzOJqmNATaY/0cyfy1neqpVSpb4ZrwZJpG', 'Lê Văn C', '0111222333', 'VOTER', 'NONE', TRUE);

-- Sample KYC Submissions
INSERT INTO kyc_submissions (
    user_id, national_id, full_name, date_of_birth, address, email, phone,
    id_front_hash, id_back_hash, photo_hash, ipfs_hash, status, submitted_at
) VALUES
(2, '001234567890', 'Nguyễn Văn A', '1990-01-15', '123 Đường ABC, Quận 1, TP.HCM', 'voter1@example.com', '0123456789',
 'QmHash1', 'QmHash2', 'QmHash3', 'QmKYC1', 'APPROVED', NOW() - INTERVAL 7 DAY),
(3, '002345678901', 'Trần Thị B', '1992-05-20', '456 Đường XYZ, Quận 2, TP.HCM', 'voter2@example.com', '0987654321',
 'QmHash4', 'QmHash5', 'QmHash6', 'QmKYC2', 'PENDING', NOW() - INTERVAL 2 DAY);

-- Sample Elections
INSERT INTO elections (
    title, description, election_type, contract_address, start_time, end_time, status, created_by
) VALUES
(
    'Bầu cử Tổng thống 2024',
    'Cuộc bầu cử tổng thống nhiệm kỳ 2024-2028',
    'PRESIDENTIAL',
    '0x1234567890123456789012345678901234567890',
    DATE_ADD(NOW(), INTERVAL 1 DAY),
    DATE_ADD(NOW(), INTERVAL 7 DAY),
    'UPCOMING',
    1
),
(
    'Bầu cử Hội đồng Nhân dân',
    'Cuộc bầu cử Hội đồng Nhân dân thành phố',
    'PARLIAMENTARY',
    '0x2345678901234567890123456789012345678901',
    NOW() - INTERVAL 5 DAY,
    NOW() + INTERVAL 2 DAY,
    'LIVE',
    1
),
(
    'Bầu cử Địa phương',
    'Cuộc bầu cử địa phương quận/huyện',
    'LOCAL',
    '0x3456789012345678901234567890123456789012',
    NOW() - INTERVAL 30 DAY,
    NOW() - INTERVAL 20 DAY,
    'CLOSED',
    1
);

-- Sample Votes
-- Note: Each user can only vote once per election (unique constraint: uk_votes_user_election)
INSERT INTO votes (
    election_id, user_id, voter_address, candidate_id, transaction_hash, receipt_ipfs_hash, timestamp
) VALUES
(3, 2, '0x1111111111111111111111111111111111111111', 1, '0xTxHash1', 'QmReceipt1', NOW() - INTERVAL 25 DAY),
(3, 3, '0x2222222222222222222222222222222222222222', 2, '0xTxHash2', 'QmReceipt2', NOW() - INTERVAL 24 DAY),
(2, 2, '0x1111111111111111111111111111111111111111', 1, '0xTxHash3', 'QmReceipt3', NOW() - INTERVAL 3 DAY);

-- Sample Activity Logs
INSERT INTO activity_logs (user_id, action, details, ip_address, user_agent, timestamp) VALUES
(1, 'LOGIN', '{"method": "email"}', '127.0.0.1', 'Mozilla/5.0', NOW() - INTERVAL 1 HOUR),
(2, 'KYC_SUBMITTED', '{"kyc_id": 1}', '192.168.1.100', 'Mozilla/5.0', NOW() - INTERVAL 7 DAY),
(2, 'VOTE_CAST', '{"election_id": 3, "candidate_id": 1}', '192.168.1.100', 'Mozilla/5.0', NOW() - INTERVAL 25 DAY),
(3, 'VOTE_CAST', '{"election_id": 3, "candidate_id": 2}', '192.168.1.101', 'Mozilla/5.0', NOW() - INTERVAL 24 DAY);

SELECT 'Sample data inserted successfully!' AS message;