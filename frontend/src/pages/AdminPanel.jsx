import React, { useState } from 'react';
import { Search } from 'lucide-react';

/**
 * AdminPanel — displays all faculty IPCR data for admin users.
 *
 * Props:
 *   adminData  - array of faculty objects fetched from the API
 */
const AdminPanel = ({ adminData }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = adminData.filter(faculty =>
    (faculty.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (faculty.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Faculty Overview</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search faculty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Faculty Name</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">IPCR Status</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.length > 0 ? (
                filteredData.map((faculty, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold">
                          {faculty.name ? faculty.name.split(' ').map(n => n[0]).join('') : 'U'}
                        </div>
                        <span className="font-medium text-gray-800">{faculty.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{faculty.department || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    {adminData.length === 0 ? 'No faculty data available' : 'No results match your search'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
