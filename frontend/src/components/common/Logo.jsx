import PropTypes from 'prop-types';

const Logo = ({ size = 32, className = '' }) => {
  return (
    <div className={`flex items-center justify-center flex-shrink-0 ${className}`} style={{ width: `${size}px`, height: `${size}px` }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block transition-transform hover:scale-105"
      >
        {}
        <circle cx="8" cy="16" r="3" fill="#3b82f6" opacity="0.8"/>
        <circle cx="16" cy="10" r="3" fill="#3b82f6" opacity="0.8"/>
        <circle cx="24" cy="16" r="3" fill="#3b82f6" opacity="0.8"/>

        {}
        <path
          d="M11 16 L13 10"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M19 10 L21 16"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {}
        <rect
          x="10"
          y="18"
          width="12"
          height="10"
          rx="2"
          fill="#1e3a8a"
        />

        {}
        <rect
          x="12"
          y="20"
          width="8"
          height="2"
          rx="1"
          fill="#60a5fa"
        />

        {}
        <path
          d="M13 24 L15 26 L19 22"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

Logo.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};

export default Logo;

