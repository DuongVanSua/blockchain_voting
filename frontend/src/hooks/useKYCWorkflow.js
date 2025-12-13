import { useMutation, useQuery } from '@tanstack/react-query';
import { contractService } from '../services/contractService';
import apiService from '../services/apiService';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';

export const useKYCWorkflow = () => {
  const { updateKYCStatus, updateUser, user } = useAppStore();
  const { user: authUser } = useAuthStore();


  const { data: kycStatusData, isLoading } = useQuery({
    queryKey: ['kycStatus', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return { status: 'NONE' };

      try {
        const response = await apiService.getKYCStatus();
        if (response.success) {
          return {
            status: response.status || 'NONE',
            kyc: response.kyc,
            rejectionReason: response.kyc?.rejected_reason,
          };
        }
        return { status: 'NONE' };
      } catch (error) {
        console.warn('Error fetching KYC status from API:', error);

        // Try to get wallet address from database (authUser) first, then fallback to app store
        const walletAddress = authUser?.walletAddress || authUser?.wallet_address || user?.wallet?.address;
        if (walletAddress) {
          try {
            const eligibleResult = await contractService.isVoterEligible(walletAddress);
            if (eligibleResult && eligibleResult.success && eligibleResult.eligible) {
              return { status: 'APPROVED' };
            }
          } catch (blockchainError) {
            console.warn('Error checking blockchain KYC status:', blockchainError);
          }
        }
        return { status: 'NONE' };
      }
    },
    enabled: !!authUser?.id,
    retry: 1,
    retryDelay: 1000,
  });


  const submitKYCMutation = useMutation({
    mutationFn: async (kycData) => {
      // Validate that all required hashes are present
      if (!kycData.idFrontHash || !kycData.idBackHash || !kycData.photoHash) {
        throw new Error('Vui lòng upload đầy đủ các tài liệu (mặt trước, mặt sau, chân dung)');
      }

      // Submit KYC to backend - backend will handle IPFS upload
      // Backend expects camelCase format
      const apiResponse = await apiService.submitKYC({
        fullName: kycData.fullName,
        nationalId: kycData.nationalId,
        dateOfBirth: kycData.dateOfBirth,
        address: kycData.address,
        email: kycData.email,
        phone: kycData.phone,
        idFrontHash: kycData.idFrontHash,
        idBackHash: kycData.idBackHash,
        photoHash: kycData.photoHash,
      });

      if (apiResponse.success) {
        return {
          success: true,
          kycId: apiResponse.submission?.id,
          status: apiResponse.submission?.status,
          ipfsHash: apiResponse.submission?.ipfsHash,
        };
      }
      throw new Error(apiResponse.error || 'Failed to submit KYC');
    },
    onSuccess: (data) => {
      updateKYCStatus('PENDING');
      if (data.ipfsHash) {
        updateUser({ kycHash: data.ipfsHash });
      }
      toast.success('Gửi KYC thành công! Đang chờ phê duyệt.');
    },
    onError: (error) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });


  const registerVoterMutation = useMutation({
    mutationFn: async (kycData) => {
      return submitKYCMutation.mutateAsync({
        fullName: kycData.name || kycData.fullName,
        nationalId: kycData.nationalId,
        dateOfBirth: kycData.dateOfBirth,
        address: kycData.address,
        email: kycData.email,
        phone: kycData.phone,
        idFrontHash: kycData.idFrontHash,
        idBackHash: kycData.idBackHash,
        photoHash: kycData.photoHash,
      });
    },
  });

  return {

    submitKYC: submitKYCMutation.mutateAsync,
    isSubmitting: submitKYCMutation.isPending,
    kycStatus: kycStatusData?.status || 'NONE',
    rejectionReason: kycStatusData?.reason,
    isLoading,


    registerVoter: registerVoterMutation.mutate,
    isRegistering: registerVoterMutation.isPending,
  };
};

export default useKYCWorkflow;

