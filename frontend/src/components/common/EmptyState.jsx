import PropTypes from 'prop-types';

const EmptyState = ({
  icon,
  title,
  description,
  action,
  children
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 sm:p-8 bg-white rounded-2xl border-2 border-dashed border-gray-200 h-full min-h-[320px] box-border transition-all hover:border-blue-500 hover:bg-blue-50/50">
      {icon && (
        <div className="flex items-center justify-center w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-indigo-50 text-indigo-600 text-3xl sm:text-2xl mb-6 shadow-sm">
          {icon}
        </div>
      )}

      <div className="max-w-[420px] mb-6">
        {title && <h3 className="m-0 mb-2 text-lg font-bold text-gray-900">{title}</h3>}
        {description && <p className="m-0 text-sm text-gray-500 leading-relaxed">{description}</p>}
      </div>

      {(children || action) && (
        <div className="flex gap-3 items-center justify-center mt-2">
          {children}
          {action}
        </div>
      )}
    </div>
  );
};

EmptyState.propTypes = {

  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  title: PropTypes.string,
  description: PropTypes.string,
  action: PropTypes.node,
  children: PropTypes.node,
};

export default EmptyState;