import { Link, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';

const Sidebar = () => {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  const voterMenu = [
    { path: '/dashboard/voter', label: 'Trang chủ', icon: '' },
  ];

  const creatorMenu = [
    { path: '/dashboard/creator', label: 'Quản lý Bầu cử', icon: '' },
  ];

  const ownerMenu = [
    { path: '/dashboard/owner', label: 'Quản lý Hệ thống', icon: '' },
  ];

  const getMenu = () => {
    const role = user.role;

    if (role === 'OWNER') {
      return ownerMenu;
    }

    if (role === 'CREATOR') {
      return creatorMenu;
    }

    if (role === 'VOTER') {
      return voterMenu;
    }

    return [];
  };

  const menu = getMenu();

  if (menu.length === 0) return null;

  return (
    <aside className="w-60 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] sticky top-16 hidden lg:block">
      <nav className="py-4">
        {menu.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-6 py-3 no-underline text-gray-600 text-sm font-medium transition-all border-l-4 ${isActive(item.path) ? 'bg-blue-50 text-blue-600 border-l-blue-600' : 'border-l-transparent hover:bg-gray-100 hover:text-blue-600'}`}
          >
            <span className="text-xl w-6 text-center">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;

