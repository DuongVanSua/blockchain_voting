import { useState } from 'react';
import { useKYCWorkflow } from '../../hooks/useKYCWorkflow';
import { ipfsService } from '../../services/ipfsService';
import { toast } from 'react-hot-toast';
import Card from '../common/Card';
import Button from '../common/Button';
import Textarea from '../common/Textarea';
import FileUpload from '../common/FileUpload';
import Alert from '../common/Alert';
import Badge from '../common/Badge';


const KycForm = () => {
  const { submitKYC, isSubmitting } = useKYCWorkflow();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({

    fullName: '',
    nationalId: '',
    dateOfBirth: '',
    address: '',
    email: '',
    phone: '',


    idFrontImage: null,
    idBackImage: null,
    idFrontPreview: null,
    idBackPreview: null,
    idFrontHash: null,
    idBackHash: null,


    photo: null,
    photoPreview: null,
    photoHash: null,
  });

  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);


  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.fullName.trim()) newErrors.fullName = 'Vui lòng nhập họ tên';
      if (!formData.nationalId.trim()) newErrors.nationalId = 'Vui lòng nhập số CMND/CCCD';
      if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Vui lòng chọn ngày sinh';
      if (!formData.address.trim()) newErrors.address = 'Vui lòng nhập địa chỉ';
      if (!formData.email.trim()) newErrors.email = 'Vui lòng nhập email';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email không hợp lệ';
      if (!formData.phone.trim()) newErrors.phone = 'Vui lòng nhập SĐT';
      else if (!/^[0-9]{10,11}$/.test(formData.phone.replace(/\s/g, ''))) newErrors.phone = 'SĐT không hợp lệ';
    }

    if (step === 2) {
      if (!formData.idFrontImage) newErrors.idFrontImage = 'Thiếu ảnh mặt trước';
      if (!formData.idBackImage) newErrors.idBackImage = 'Thiếu ảnh mặt sau';
    }

    if (step === 3) {
      if (!formData.photo) newErrors.photo = 'Thiếu ảnh chân dung';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleFileUpload = async (field, file) => {
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      return toast.error('Chỉ chấp nhận file ảnh JPG/PNG');
    }

    if (file.size > 5 * 1024 * 1024) {
      return toast.error('Kích thước file tối đa 5MB');
    }

    // Map field name to hash field name
    const hashFieldMap = {
      'idFrontImage': 'idFrontHash',
      'idBackImage': 'idBackHash',
      'photo': 'photoHash',
    };
    const hashField = hashFieldMap[field] || `${field}Hash`;

    const reader = new window.FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({
        ...prev,
        [field]: file,
        [`${field}Preview`]: e.target.result,
      }));
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const result = await ipfsService.uploadFile(file);
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.log(`[KYC] Upload result for ${field}:`, result);
      
      if (result.success && result.hash) {
        // Use functional update to ensure state is updated correctly
        setFormData(prev => {
          const updated = { 
            ...prev, 
            [hashField]: result.hash 
          };
          // eslint-disable-next-line no-console
          if (import.meta.env.DEV) console.log(`[KYC] State updated - ${hashField}: ${result.hash}`, {
            ...updated,
            // Only log relevant fields
            idFrontHash: updated.idFrontHash,
            idBackHash: updated.idBackHash,
            photoHash: updated.photoHash,
          });
          return updated;
        });
        toast.success('Upload lên IPFS thành công');
      } else {
        const errorMsg = result.error || 'Upload failed - no hash returned';
        // eslint-disable-next-line no-console
        console.error(`[KYC] Upload failed for ${field}:`, errorMsg, result);
        throw new Error(errorMsg);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[KYC] Upload error for ${field}:`, error);
      toast.error(`Lỗi upload: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    // Check if upload is in progress
    if (uploading) {
      return toast.error('Vui lòng đợi upload ảnh hoàn tất');
    }

    // Debug: Log current form data
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[KYC] handleNext - Current form data:', {
        idFrontHash: formData.idFrontHash,
        idBackHash: formData.idBackHash,
        photoHash: formData.photoHash,
        currentStep,
        uploading,
      });
    }

    if (currentStep === 2) {
      if (!formData.idFrontHash || !formData.idBackHash) {
        const missing = [];
        if (!formData.idFrontHash) missing.push('mặt trước');
        if (!formData.idBackHash) missing.push('mặt sau');
        console.warn('[KYC] Missing hashes:', { idFrontHash: formData.idFrontHash, idBackHash: formData.idBackHash });
        return toast.error(`Vui lòng upload ảnh ${missing.join(' và ')}`);
      }
    }
    
    if (currentStep === 3) {
      if (!formData.photoHash) {
        console.warn('[KYC] Missing photo hash:', formData.photoHash);
        return toast.error('Vui lòng upload ảnh chân dung');
      }
    }

    if (currentStep < totalSteps) setCurrentStep(prev => prev + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      const result = await submitKYC({
        fullName: formData.fullName,
        nationalId: formData.nationalId,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        email: formData.email,
        phone: formData.phone,
        idFrontHash: formData.idFrontHash,
        idBackHash: formData.idBackHash,
        photoHash: formData.photoHash,
      });

      if (result.success) {
        toast.success('Gửi hồ sơ KYC thành công!');

      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Xác thực Danh tính (KYC)</h1>
        <p className="text-gray-600">Hoàn thành các bước để kích hoạt quyền bỏ phiếu</p>
      </div>

      <div className="mb-8">
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="flex justify-between mt-4">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`flex flex-col items-center ${
                currentStep >= step ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 ${
                currentStep > step ? 'bg-green-500 text-white' :
                currentStep >= step ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {currentStep > step ? '✓' : step}
              </div>
              <span className="text-xs font-medium">
                {['Thông tin', 'Giấy tờ', 'Chân dung', 'Gửi'][step-1]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Card className="p-6">
        {currentStep === 1 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Thông tin cá nhân</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange('fullName')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.fullName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.fullName && <span className="text-red-500 text-sm mt-1 block">{errors.fullName}</span>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số CMND/CCCD <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nationalId}
                  onChange={handleInputChange('nationalId')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.nationalId ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.nationalId && <span className="text-red-500 text-sm mt-1 block">{errors.nationalId}</span>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày sinh <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange('dateOfBirth')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.dateOfBirth && <span className="text-red-500 text-sm mt-1 block">{errors.dateOfBirth}</span>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange('phone')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.phone && <span className="text-red-500 text-sm mt-1 block">{errors.phone}</span>}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.email && <span className="text-red-500 text-sm mt-1 block">{errors.email}</span>}
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Địa chỉ thường trú"
                  value={formData.address}
                  onChange={handleInputChange('address')}
                  error={errors.address}
                  required
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Tải lên giấy tờ tùy thân</h2>
            <Alert variant="info" className="mb-6">
              Ảnh cần rõ nét, không bị lóa sáng và đầy đủ 4 góc.
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mặt trước *</label>
                <FileUpload
                  accept="image/*"
                  onFileChange={(file) => handleFileUpload('idFrontImage', file)}
                  disabled={uploading}
                  error={errors.idFrontImage}
                />
                {formData.idFrontPreview && (
                  <div className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <img src={formData.idFrontPreview} alt="Front ID" className="w-full h-auto rounded" />
                    {formData.idFrontHash && (
                      <Badge variant="success" className="mt-2">Đã lưu IPFS</Badge>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mặt sau *</label>
                <FileUpload
                  accept="image/*"
                  onFileChange={(file) => handleFileUpload('idBackImage', file)}
                  disabled={uploading}
                  error={errors.idBackImage}
                />
                {formData.idBackPreview && (
                  <div className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <img src={formData.idBackPreview} alt="Back ID" className="w-full h-auto rounded" />
                    {formData.idBackHash && (
                      <Badge variant="success" className="mt-2">Đã lưu IPFS</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Xác thực khuôn mặt</h2>
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ảnh chân dung cầm giấy tờ *</label>
                <FileUpload
                  accept="image/*"
                  onFileChange={(file) => handleFileUpload('photo', file)}
                  disabled={uploading}
                  error={errors.photo}
                />
                {formData.photoPreview && (
                  <div className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <img src={formData.photoPreview} alt="Selfie" className="w-full h-auto rounded" />
                    {formData.photoHash && (
                      <Badge variant="success" className="mt-2">Đã lưu IPFS</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Kiểm tra thông tin</h2>
            <Alert variant="warning" className="mb-6">
              Vui lòng kiểm tra kỹ trước khi gửi. Thông tin không thể thay đổi sau khi xác nhận.
            </Alert>

            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Thông tin cá nhân</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600">Họ tên:</span> <strong className="text-gray-900">{formData.fullName}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-600">CMND/CCCD:</span> <strong className="text-gray-900">{formData.nationalId}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-600">Email:</span> <strong className="text-gray-900">{formData.email}</strong></div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Trạng thái tài liệu</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Mặt trước:</span>
                    <Badge variant={formData.idFrontHash ? 'success' : 'error'}>
                      {formData.idFrontHash ? 'Sẵn sàng' : 'Thiếu'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Mặt sau:</span>
                    <Badge variant={formData.idBackHash ? 'success' : 'error'}>
                      {formData.idBackHash ? 'Sẵn sàng' : 'Thiếu'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Chân dung:</span>
                    <Badge variant={formData.photoHash ? 'success' : 'error'}>
                      {formData.photoHash ? 'Sẵn sàng' : 'Thiếu'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
          {currentStep > 1 && (
            <Button variant="outline" onClick={() => setCurrentStep(p => p - 1)} disabled={isSubmitting}>
              Quay lại
            </Button>
          )}

          <div className="flex-1" />

          {currentStep < totalSteps ? (
            <Button variant="primary" onClick={handleNext} disabled={uploading}>
              Tiếp tục
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || uploading}>
              {isSubmitting ? 'Đang gửi...' : 'Xác nhận gửi hồ sơ'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default KycForm;