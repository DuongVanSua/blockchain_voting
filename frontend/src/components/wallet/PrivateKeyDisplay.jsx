import { useState } from 'react';
import PropTypes from 'prop-types';
import { QRCodeSVG } from 'qrcode.react';
import Button from '../common/Button';
import Card from '../common/Card';
import Alert from '../common/Alert';
import Checkbox from '../common/Checkbox';
import { toast } from 'react-hot-toast';

const PrivateKeyDisplay = ({ privateKey, walletAddress, onConfirm, onCancel }) => {
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [confirmedBackup, setConfirmedBackup] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (window.navigator?.clipboard) {
      window.navigator.clipboard.writeText(privateKey);
      setCopied(true);
      toast.success('Đã sao chép private key!');
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const backupData = {
      walletAddress,
      privateKey,
      createdAt: new Date().toISOString(),
      warning: 'KHÔNG CHIA SẺ FILE NÀY VỚI BẤT KỲ AI!',
    };

    const encrypted = window.btoa(JSON.stringify(backupData));
    const blob = new window.Blob([encrypted], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-backup-${walletAddress.slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success('Đã tải về file backup!');
  };


  return (
    <Card className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Private Key của bạn
        </h2>
        <p className="text-gray-600">
          Private key này chỉ được hiển thị một lần duy nhất. Hãy lưu lại ngay bây giờ!
        </p>
      </div>

      <Alert variant="error" className="mb-6">
        <div className="space-y-2">
          <p className="font-semibold">[WARNING] CẢNH BÁO BẢO MẬT:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Private key này chỉ được hiển thị một lần duy nhất</li>
            <li>Không chia sẻ private key với bất kỳ ai</li>
            <li>Nếu mất private key, bạn sẽ mất quyền truy cập ví vĩnh viễn</li>
            <li>Lưu trữ private key ở nơi an toàn, không lưu trên thiết bị công cộng</li>
            <li>Owner không giữ private key của bạn</li>
          </ul>
        </div>
      </Alert>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Địa chỉ ví</h3>
        </div>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <code className="font-mono text-sm bg-gray-100 p-3 rounded-lg break-all flex-1">
            {walletAddress}
          </code>
          <div className="flex flex-col items-center">
            <QRCodeSVG value={walletAddress} size={150} />
            <p className="text-sm text-gray-500 mt-2">Quét mã QR để xem địa chỉ</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Private Key</h3>
          <Button
            variant="outline"
            size="small"
            onClick={() => setShowPrivateKey(!showPrivateKey)}
          >
            {showPrivateKey ? 'Ẩn' : 'Hiện'}
          </Button>
        </div>

        {showPrivateKey ? (
          <div className="space-y-4">
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <code className="font-mono text-sm text-red-900 break-all block">
                {privateKey}
              </code>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="flex-1"
              >
                {copied ? '✓ Đã sao chép' : 'Sao chép Private Key'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                className="flex-1"
              >
                Tải về file backup
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 bg-gray-100 rounded-lg text-center">
            <p className="text-gray-600 mb-2">Nhấn nút &quot;Hiện&quot; để xem private key</p>
            <p className="text-sm text-gray-500">
              Private key sẽ chỉ được hiển thị một lần duy nhất
            </p>
          </div>
        )}
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">Hướng dẫn sử dụng:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Lưu private key ở nơi an toàn (ghi ra giấy hoặc lưu trong password manager)</li>
          <li>Bạn có thể import private key này vào MetaMask để sử dụng</li>
          <li>Hoặc sử dụng private key này để kết nối với ví khác</li>
          <li>Owner không giữ private key của bạn - chỉ bạn mới có quyền truy cập</li>
        </ol>
      </div>

      <div className="mb-6">
        <Checkbox
          checked={confirmedBackup}
          onChange={(e) => setConfirmedBackup(e.target.checked)}
          label="Tôi xác nhận đã ghi lại private key và lưu trữ ở nơi an toàn. Tôi hiểu rằng nếu mất private key, tôi sẽ mất quyền truy cập ví vĩnh viễn."
        />
      </div>

      <div className="flex gap-4">
        <Button
          onClick={onConfirm}
          variant="primary"
          size="large"
          disabled={!confirmedBackup}
          className="flex-1"
        >
          Tôi đã lưu private key - Tiếp tục
        </Button>
        {onCancel && (
          <Button
            onClick={onCancel}
            variant="ghost"
            size="medium"
          >
            Hủy
          </Button>
        )}
      </div>
    </Card>
  );
};

PrivateKeyDisplay.propTypes = {
  privateKey: PropTypes.string.isRequired,
  walletAddress: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};

export default PrivateKeyDisplay;

