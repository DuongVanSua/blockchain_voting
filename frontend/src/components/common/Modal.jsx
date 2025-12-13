import { useEffect } from 'react';
import PropTypes from 'prop-types';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  className = ''
}) => {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    full: 'max-w-[95vw] h-[90vh]'
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] w-full relative overflow-hidden animate-scaleIn ${sizeClasses[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-6 sm:p-5 border-b border-gray-200/80 bg-gradient-to-r from-white to-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
          {title && <h3 className="text-xl font-bold text-gray-900 leading-tight m-0 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{title}</h3>}
          <button
            className="bg-transparent border-none text-gray-400 cursor-pointer p-2 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="p-6 sm:p-5 overflow-y-auto flex-1 text-gray-700 text-base leading-relaxed scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  children: PropTypes.node,
  size: PropTypes.oneOf(['small', 'medium', 'large', 'full']),
  className: PropTypes.string,
};

export default Modal;