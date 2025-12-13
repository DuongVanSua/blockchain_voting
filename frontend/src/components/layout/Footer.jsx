import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-400 mt-auto pt-16 pb-8 border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-12 mb-12">
          <div className="lg:col-span-2">
            <h4 className="text-slate-50 text-base font-bold m-0 mb-5 tracking-wide">Hệ thống Bầu cử Blockchain</h4>
            <p className="text-sm leading-relaxed max-w-[300px]">
              Nền tảng bầu cử minh bạch, an toàn và có thể kiểm chứng trên nền tảng Ethereum.
            </p>
          </div>

          <div>
            <h4 className="text-slate-50 text-base font-bold m-0 mb-5 tracking-wide">Điều hướng</h4>
            <ul className="list-none p-0 m-0">
              <li className="mb-3"><Link to="/" className="text-sm text-slate-400 no-underline transition-all inline-block hover:text-indigo-500 hover:translate-x-1">Trang chủ</Link></li>
              <li className="mb-3"><Link to="/voter/dashboard" className="text-sm text-slate-400 no-underline transition-all inline-block hover:text-indigo-500 hover:translate-x-1">Bỏ phiếu</Link></li>
              <li className="mb-3"><Link to="/voter/results" className="text-sm text-slate-400 no-underline transition-all inline-block hover:text-indigo-500 hover:translate-x-1">Kết quả</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-50 text-base font-bold m-0 mb-5 tracking-wide">Tài khoản</h4>
            <ul className="list-none p-0 m-0">
              <li className="mb-3"><Link to="/auth/login" className="text-sm text-slate-400 no-underline transition-all inline-block hover:text-indigo-500 hover:translate-x-1">Đăng nhập</Link></li>
              <li className="mb-3"><Link to="/auth/register" className="text-sm text-slate-400 no-underline transition-all inline-block hover:text-indigo-500 hover:translate-x-1">Đăng ký cử tri</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-50 text-base font-bold m-0 mb-5 tracking-wide">Hỗ trợ</h4>
            <ul className="list-none p-0 m-0">
              <li className="mb-3"><a href="#" className="text-sm text-slate-400 no-underline transition-all inline-block hover:text-indigo-500 hover:translate-x-1">Hướng dẫn sử dụng</a></li>
              <li className="mb-3"><a href="#" className="text-sm text-slate-400 no-underline transition-all inline-block hover:text-indigo-500 hover:translate-x-1">Câu hỏi thường gặp</a></li>
              <li className="mb-3"><a href="#" className="text-sm text-slate-400 no-underline transition-all inline-block hover:text-indigo-500 hover:translate-x-1">Liên hệ</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 text-center">
          <p className="m-0 text-[13px] text-slate-500">&copy; {currentYear} Blockchain Voting System. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;