import PropTypes from 'prop-types';
import Card from '../common/Card';
import Button from '../common/Button';
import Alert from '../common/Alert';


const KycStatus = ({ status = 'NONE', rejectionReason }) => {


  const getStatusConfig = () => {
    switch (status) {
      case 'PENDING':
        return {
          variant: 'warning',
          label: 'Đang chờ xét duyệt',
          icon: '⏳',
          description: 'Hồ sơ của bạn đang được hệ thống và quản trị viên xem xét. Quá trình này thường mất 24-48 giờ.',
          progress: 60,
          step: 2
        };
      case 'APPROVED':
        return {
          variant: 'success',
          label: 'Đã được phê duyệt',
          icon: '✓',
          description: 'Chúc mừng! Danh tính của bạn đã được xác minh. Bạn đã có thể tham gia bỏ phiếu.',
          progress: 100,
          step: 3
        };
      case 'REJECTED':
        return {
          variant: 'error',
          label: 'Đã bị từ chối',
          icon: '✕',
          description: 'Hồ sơ của bạn không đạt yêu cầu. Vui lòng kiểm tra lý do và cập nhật lại thông tin.',
          progress: 100,
          step: 3
        };
      default:
        return {
          variant: 'neutral',
          label: 'Chưa nộp hồ sơ',
          icon: '📄',
          description: 'Vui lòng hoàn thành KYC để kích hoạt quyền bỏ phiếu.',
          progress: 0,
          step: 0
        };
    }
  };

  const config = getStatusConfig();


  const renderTimelineItem = (stepIndex, title, subtext) => {
    const isCompleted = config.step > stepIndex || (config.step === stepIndex && status === 'APPROVED');
    const isActive = config.step === stepIndex && status === 'PENDING';
    const isRejected = status === 'REJECTED' && stepIndex === 3;

    return (
      <div className="relative flex gap-4 pb-8 last:pb-0">
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
            isRejected ? 'bg-red-100 text-red-600 border-2 border-red-300' :
            isCompleted ? 'bg-green-100 text-green-600 border-2 border-green-300' :
            isActive ? 'bg-blue-100 text-blue-600 border-2 border-blue-300 animate-pulse' :
            'bg-gray-100 text-gray-400 border-2 border-gray-200'
          }`}>
            {isCompleted && !isRejected ? '✓' : isRejected ? '✕' : stepIndex}
          </div>
          {stepIndex < 3 && (
            <div className={`absolute top-10 w-0.5 h-full ${
              isCompleted ? 'bg-green-300' : 'bg-gray-200'
            }`} />
          )}
        </div>
        <div className="flex-1 pt-1">
          <h4 className={`font-semibold mb-1 ${
            isRejected ? 'text-red-900' :
            isCompleted ? 'text-green-900' :
            isActive ? 'text-blue-900' :
            'text-gray-500'
          }`}>
            {title}
          </h4>
          <p className="text-sm text-gray-600">{subtext}</p>
        </div>
      </div>
    );
  };

  const getIconWrapperClass = () => {
    const variants = {
      success: 'bg-green-100 text-green-600',
      warning: 'bg-yellow-100 text-yellow-600',
      error: 'bg-red-100 text-red-600',
      neutral: 'bg-gray-100 text-gray-600'
    };
    return variants[config.variant] || variants.neutral;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Trạng thái KYC</h1>
      </div>

      <Card className="p-8">
        <div className="text-center mb-8">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-4 ${getIconWrapperClass()}`}>
            {config.icon}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{config.label}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">{config.description}</p>
        </div>

        <div className="mb-8">
          {renderTimelineItem(1, 'Nộp hồ sơ', 'Thông tin và tài liệu đã được gửi lên hệ thống.')}
          {renderTimelineItem(2, 'Đang xác minh', 'Hệ thống AI và Owner đang kiểm tra tính hợp lệ.')}
          {renderTimelineItem(3, status === 'REJECTED' ? 'Từ chối' : 'Hoàn tất', status === 'REJECTED' ? 'Hồ sơ không đạt yêu cầu.' : 'Quyền bỏ phiếu đã được kích hoạt.')}
        </div>

        {status === 'REJECTED' && (
          <Alert variant="error" title="Lý do từ chối" className="mb-6">
            {rejectionReason || 'Thông tin không khớp hoặc hình ảnh không rõ nét.'}
          </Alert>
        )}

        <div className="mt-8">
          {status === 'REJECTED' ? (
            <Button variant="primary" onClick={() => window.location.reload()} className="w-full">
              Cập nhật hồ sơ
            </Button>
          ) : status === 'APPROVED' ? (
            <Button variant="primary" onClick={() => window.location.href = '/voter/dashboard'} className="w-full">
              Bắt đầu bỏ phiếu
            </Button>
          ) : status === 'NONE' ? (
            <Button variant="primary" onClick={() => window.location.reload()} className="w-full">
              Bắt đầu KYC
            </Button>
          ) : (
            <Button variant="outline" onClick={() => window.location.href = '/voter/dashboard'} className="w-full">
              Quay về trang chủ
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

KycStatus.propTypes = {
  status: PropTypes.oneOf(['NONE', 'PENDING', 'APPROVED', 'REJECTED']),
  rejectionReason: PropTypes.string,
};

export default KycStatus;