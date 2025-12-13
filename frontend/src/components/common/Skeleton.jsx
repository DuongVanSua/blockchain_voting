import PropTypes from 'prop-types';

const Skeleton = ({
  width,
  height,
  variant = 'text',
  className = '',
  style = {}
}) => {
  const baseClasses = 'bg-gray-100 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer inline-block leading-none';
  
  const variantClasses = {
    text: 'rounded w-full h-4 mb-2',
    rectangular: 'rounded-lg w-full h-full',
    circular: 'rounded-full w-10 h-10'
  };

  const styles = {
    width,
    height,
    ...style
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={styles}
      aria-hidden="true"
    />
  );
};

Skeleton.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  variant: PropTypes.oneOf(['text', 'rectangular', 'circular']),
  className: PropTypes.string,
  style: PropTypes.object,
};

export default Skeleton;