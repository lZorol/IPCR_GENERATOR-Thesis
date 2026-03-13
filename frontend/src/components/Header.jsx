import React from 'react';
import { FileText, LogOut } from 'lucide-react';

const Header = ({ user, onLogout }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">IPCR Management System</h1>
              <p className="text-sm text-gray-500">Laguna State Polytechnic University</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role === 'admin' ? 'Administrator' : 'Faculty'}</p>
            </div>
            {user.profileImage ? (
              <img src={user.profileImage} alt={user.name} className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
            <button
              onClick={onLogout}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
