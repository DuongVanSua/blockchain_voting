const { KYCSubmission, User } = require('../models/index');
const { uploadJSON } = require('./ipfsService');

async function submitKYC(userId, kycData) {
  try {
    // Upload KYC data to IPFS (using uploadJSON for Pinata support)
    const ipfsResult = await uploadJSON({
      userId,
      nationalId: kycData.nationalId || kycData.national_id,
      fullName: kycData.fullName || kycData.full_name,
      dateOfBirth: kycData.dateOfBirth || kycData.date_of_birth,
      address: kycData.address,
      email: kycData.email,
      phone: kycData.phone,
      idFrontHash: kycData.idFrontHash || kycData.id_front_hash,
      idBackHash: kycData.idBackHash || kycData.id_back_hash,
      photoHash: kycData.photoHash || kycData.photo_hash,
      timestamp: new Date().toISOString(),
    });
    
    if (!ipfsResult.success) {
      console.error('[KYC] IPFS upload failed:', ipfsResult.error);
      // Continue with submission even if IPFS upload fails
    }
    
    const submission = await KYCSubmission.create({
      userId,
      nationalId: kycData.nationalId || kycData.national_id,
      fullName: kycData.fullName || kycData.full_name,
      dateOfBirth: new Date(kycData.dateOfBirth || kycData.date_of_birth),
      address: kycData.address,
      email: kycData.email,
      phone: kycData.phone,
      idFrontHash: kycData.idFrontHash || kycData.id_front_hash,
      idBackHash: kycData.idBackHash || kycData.id_back_hash,
      photoHash: kycData.photoHash || kycData.photo_hash,
      ipfsHash: ipfsResult.success ? ipfsResult.hash : null,
      status: 'PENDING',
    });

    // Update user KYC status
    await User.update(
      { kycStatus: 'PENDING' },
      { where: { id: userId } }
    );

    return submission;
  } catch (error) {
    console.error('Error submitting KYC:', error);
    throw error;
  }
}

async function getKYCStatus(userId) {
  try {
    const submission = await KYCSubmission.findOne({
      where: { userId },
      order: [['submittedAt', 'DESC']],
    });

    if (!submission) {
      return { status: 'NONE' };
    }

    return {
      status: submission.status,
      submissionId: submission.id,
      submittedAt: submission.submittedAt,
    };
  } catch (error) {
    console.error('Error getting KYC status:', error);
    throw error;
  }
}

async function approveKYC(kycId, ownerId, adminNotes = null) {
  try {
    const submission = await KYCSubmission.findByPk(kycId);
    if (!submission) {
      throw new Error('KYC submission not found');
    }

    submission.status = 'APPROVED';
    submission.adminNotes = adminNotes; // Field name kept for backward compatibility
    submission.reviewedAt = new Date();
    submission.reviewedBy = ownerId;
    await submission.save();

    // Update user KYC status
    await User.update(
      { kycStatus: 'APPROVED' },
      { where: { id: submission.userId } }
    );

    return submission;
  } catch (error) {
    console.error('Error approving KYC:', error);
    throw error;
  }
}

async function rejectKYC(kycId, ownerId, reason, adminNotes = null) {
  try {
    const submission = await KYCSubmission.findByPk(kycId);
    if (!submission) {
      throw new Error('KYC submission not found');
    }

    submission.status = 'REJECTED';
    submission.rejectedReason = reason;
    submission.adminNotes = adminNotes; // Field name kept for backward compatibility
    submission.reviewedAt = new Date();
    submission.reviewedBy = ownerId;
    await submission.save();

    // Update user KYC status
    await User.update(
      { kycStatus: 'REJECTED' },
      { where: { id: submission.userId } }
    );

    return submission;
  } catch (error) {
    console.error('Error rejecting KYC:', error);
    throw error;
  }
}

async function getPendingKYC(limit = 100) {
  try {
    const submissions = await KYCSubmission.findAll({
      where: { status: 'PENDING' },
      include: [{ 
        model: User, 
        as: 'user', 
        attributes: ['id', 'email', 'name', 'role', 'is_active', 'is_blocked', 'wallet_address', 'kyc_status', 'created_at', 'updated_at'] 
      }],
      limit,
      order: [['submittedAt', 'ASC']],
    });

    return submissions;
  } catch (error) {
    console.error('Error getting pending KYC:', error);
    throw error;
  }
}

module.exports = {
  submitKYC,
  getKYCStatus,
  approveKYC,
  rejectKYC,
  getPendingKYC,
};

