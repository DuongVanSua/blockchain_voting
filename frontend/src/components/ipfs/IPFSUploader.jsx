import { useState } from 'react';
import PropTypes from 'prop-types';
import { ipfsService } from '../../services/ipfsService';
import FileUpload from '../common/FileUpload';
import Button from '../common/Button';
import ProgressBar from '../common/ProgressBar';
import Alert from '../common/Alert';


const IPFSUploader = ({
  onUploadComplete,
  accept,
  label = 'Tải lên IPFS',
  className = ''
}) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hash, setHash] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleFileChange = (selectedFile) => {
    setFile(selectedFile);
    setError(null);
    setHash(null);
    setProgress(0);
  };

  const handleReset = () => {
    setFile(null);
    setHash(null);
    setError(null);
    setProgress(0);
  };

  const handleCopy = () => {
    if (hash && window.navigator.clipboard) {
      window.navigator.clipboard.writeText(hash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Vui lòng chọn file');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {

      const progressInterval = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            window.clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const result = await ipfsService.uploadFile(file);

      window.clearInterval(progressInterval);
      setProgress(100);
      setHash(result.hash);

      if (onUploadComplete) {
        onUploadComplete(result);
      }
    } catch (err) {
      setError(err.message || 'Upload thất bại. Vui lòng thử lại.');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`ipfs-uploader ${className}`}>
      {!hash ? (
        <>
          <FileUpload
            label={label}
            accept={accept}
            onFileChange={handleFileChange}
            disabled={uploading}
          />

          {file && (
            <div className="upload-actions">
              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? 'Đang tải lên...' : 'Upload lên IPFS'}
              </Button>
            </div>
          )}

          {uploading && (
            <div className="upload-progress-container">
              <ProgressBar value={progress} showPercentage={true} variant="primary" />
              <span className="progress-text">Đang mã hóa và đẩy lên mạng lưới IPFS...</span>
            </div>
          )}
        </>
      ) : (
        <div className="upload-success-state">
          <Alert variant="success" title="Upload thành công!">
            File của bạn đã được lưu trữ phi tập trung.
          </Alert>

          <div className="ipfs-hash-box">
            <span className="hash-label">IPFS Hash (CID):</span>
            <div className="hash-content">
              <code>{hash}</code>
              <button
                className="copy-btn"
                onClick={handleCopy}
                title="Sao chép Hash"
              >
                {copied ? '✓' : '❐'}
              </button>
            </div>
          </div>

          <Button variant="outline" size="small" onClick={handleReset} className="w-full">
            Upload file khác
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="error" title="Lỗi Upload">
          {error}
        </Alert>
      )}
    </div>
  );
};

IPFSUploader.propTypes = {
  onUploadComplete: PropTypes.func,
  accept: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
};

export default IPFSUploader;