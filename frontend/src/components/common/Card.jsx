import PropTypes from 'prop-types';

const Card = ({
  children,
  className = '',
  variant = 'default',
  hoverable = false,
  ...props
}) => {
  // Tailwind CSS classes with improved styling
  const baseClasses = 'bg-white rounded-2xl p-5 sm:p-6 transition-all duration-300 border border-gray-200/80';
  
  const variantClasses = {
    default: 'shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-200',
    outlined: 'shadow-none hover:border-blue-400 hover:shadow-md',
    elevated: 'shadow-lg shadow-gray-200/50 border-gray-200',
    flat: 'shadow-none border-gray-100 bg-gray-50/50',
  };
  
  const hoverClasses = hoverable ? 'hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.01] cursor-pointer' : '';

  const classes = `${baseClasses} ${variantClasses[variant] || variantClasses.default} ${hoverClasses} ${className}`.trim();

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

Card.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,

  variant: PropTypes.oneOf(['default', 'outlined', 'elevated', 'flat']),
  hoverable: PropTypes.bool,
};

export default Card;