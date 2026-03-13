import React from 'react';
import { Home, Upload, User, Shield } from 'lucide-react';

const NavBar = ({ currentPage, setCurrentPage, isAdmin }) => {
  const btnClass = (page) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
      currentPage === page ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <nav className="bg-white rounded-lg shadow-sm mb-6 p-2 flex gap-2 overflow-x-auto">
      <button onClick={() => setCurrentPage('dashboard')} className={btnClass('dashboard')}>
        <Home className="w-4 h-4" />
        Dashboard
      </button>
      <button onClick={() => setCurrentPage('upload')} className={btnClass('upload')}>
        <Upload className="w-4 h-4" />
        Upload Documents
      </button>
      <button onClick={() => setCurrentPage('profile')} className={btnClass('profile')}>
        <User className="w-4 h-4" />
        Profile
      </button>
      {isAdmin && (
        <button onClick={() => setCurrentPage('admin')} className={btnClass('admin')}>
          <Shield className="w-4 h-4" />
          Admin Panel
        </button>
      )}
    </nav>
  );
};

export default NavBar;
