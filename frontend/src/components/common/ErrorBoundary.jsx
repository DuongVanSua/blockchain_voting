import React from 'react';
import PropTypes from 'prop-types';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {


    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-6 bg-white w-full">
          <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-md border border-gray-200">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mx-auto mb-5">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">Đã xảy ra sự cố</h2>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed bg-gray-50 p-3 rounded-lg font-mono">
              {this.state.error?.message || 'Hệ thống gặp lỗi không xác định. Vui lòng thử lại.'}
            </p>

            <button className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold cursor-pointer border-none transition-all bg-indigo-600 text-white shadow-[0_4px_6px_-1px_rgba(79,70,229,0.25)] hover:bg-indigo-700 hover:-translate-y-px" onClick={this.handleReload}>
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;