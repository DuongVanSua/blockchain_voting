import { useState, useRef } from 'react';
import PropTypes from 'prop-types';

const FileUpload = ({
  label,
  accept,
  multiple = false,
  onFileChange,
  disabled = false,
  required = false,
  error,
  maxSize = 5 * 1024 * 1024,
  className = ''
}) => {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);


  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateAndSetFiles = (newFiles) => {
    const validFiles = Array.from(newFiles).filter(file => {
      if (file.size > maxSize) {

        window.alert(`File "${file.name}" quá lớn. Tối đa ${formatFileSize(maxSize)}.`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {

      const updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
      setFiles(updatedFiles);
      if (onFileChange) {
        onFileChange(multiple ? updatedFiles : updatedFiles[0]);
      }
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFiles(e.target.files);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    if (onFileChange) {
      onFileChange(multiple ? newFiles : (newFiles[0] || null));
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-gray-900 flex items-center">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        className={`relative flex flex-col items-center justify-center p-8 text-center bg-gray-50 border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden ${dragActive ? 'border-indigo-500 bg-indigo-50 -translate-y-px' : 'border-gray-200'} ${error ? 'border-red-500 bg-red-50' : ''} ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-100 border-gray-300' : 'hover:border-indigo-500 hover:bg-indigo-50 hover:-translate-y-px'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center pointer-events-none">
          <div className="w-12 h-12 flex items-center justify-center mb-3 bg-indigo-100 text-indigo-600 rounded-full">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="text-sm text-gray-900 mb-1">
            <span className="text-indigo-600 font-semibold underline underline-offset-2">Nhấn để tải lên</span> hoặc kéo thả file vào đây
          </div>
          <div className="text-xs text-gray-500">
            {accept ? `Hỗ trợ: ${accept.replace(/,/g, ', ')}` : 'Mọi định dạng'}
            {' • '}
            Tối đa {formatFileSize(maxSize)}
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg transition-all">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <svg className="w-8 h-8 p-1.5 bg-gray-100 rounded-md text-gray-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{file.name}</span>
                  <span className="text-[11px] text-gray-500">{formatFileSize(file.size)}</span>
                </div>
              </div>
              <button
                type="button"
                className="flex items-center justify-center w-6 h-6 p-0 bg-transparent border-none rounded text-gray-500 text-lg leading-none cursor-pointer transition-all hover:bg-red-100 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <span className="text-xs font-medium text-red-500 mt-0.5 flex items-center gap-1">{error}</span>}
    </div>
  );
};

FileUpload.propTypes = {
  label: PropTypes.string,
  accept: PropTypes.string,
  multiple: PropTypes.bool,
  onFileChange: PropTypes.func,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  error: PropTypes.string,
  maxSize: PropTypes.number,
  className: PropTypes.string,
};

export default FileUpload;