import React from 'react';

const ProfilePage = ({ user }) => {
  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Profile Information</h2>

        <div className="space-y-6">
          <div className="flex items-center gap-6">
            {user.profileImage ? (
              <img src={user.profileImage} alt={user.name} className="w-24 h-24 rounded-full" />
            ) : (
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold text-gray-800">{user.name}</h3>
              <p className="text-gray-600">{user.department}</p>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-gray-800">{user.email}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Role</label>
              <p className="mt-1 text-gray-800 capitalize">{user.role}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Department</label>
              <p className="mt-1 text-gray-800">{user.department}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
