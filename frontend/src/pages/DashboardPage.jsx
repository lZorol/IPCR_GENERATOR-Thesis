import React from 'react';
import { BarChart3, CheckCircle, Clock, Download } from 'lucide-react';
import { CATEGORY_NAMES } from '../constants';

const DashboardPage = ({ user, ipcrData, onExport }) => {
  const calculateRating = (target, accomplished) => {
    if (target === 0) return 0;
    const ratio = accomplished / target;
    if (ratio >= 1.0) return 5;
    if (ratio >= 0.8) return 4;
    if (ratio >= 0.6) return 3;
    if (ratio >= 0.4) return 2;
    return 1;
  };

  const calculateOverallRating = () => {
    const categories = Object.values(ipcrData);
    const validCategories = categories.filter(cat => cat.target > 0);
    if (validCategories.length === 0) return 0;

    const totalRating = validCategories.reduce((sum, cat) => {
      const r = cat.rating != null && cat.rating > 0
        ? Number(cat.rating)
        : calculateRating(cat.target, cat.accomplished);
      return sum + r;
    }, 0);

    return (totalRating / validCategories.length).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Google Drive Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          {user.tokens ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">Google Drive Connected</p>
                <p className="text-xs text-gray-600">Documents will be automatically uploaded to your Drive</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-yellow-500"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Google Drive Not Connected</p>
                <p className="text-xs text-gray-600">Documents will only be stored locally</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Overall Rating Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium mb-2">Overall IPCR Rating</p>
            <h2 className="text-5xl font-bold">{calculateOverallRating()}</h2>
            <p className="text-blue-100 text-sm mt-2">out of 5.00</p>
          </div>
          <BarChart3 className="w-20 h-20 text-blue-300 opacity-50" />
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(ipcrData).map(([key, data]) => {
          const rating = data.rating != null && data.rating > 0
            ? Number(data.rating)
            : calculateRating(data.target, data.accomplished);

          return (
            <div key={key} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">{CATEGORY_NAMES[key]}</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  rating >= 4 ? 'bg-green-100 text-green-700' :
                  rating >= 3 ? 'bg-yellow-100 text-yellow-700' :
                  rating >= 1 ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {rating.toFixed(1)}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Target:</span>
                  <span className="font-semibold text-gray-800">{data.target}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accomplished:</span>
                  <span className="font-semibold text-blue-600">{data.accomplished}</span>
                </div>

                <div className="pt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        rating >= 4 ? 'bg-green-500' :
                        rating >= 3 ? 'bg-yellow-500' :
                        rating >= 1 ? 'bg-orange-500' :
                        'bg-gray-400'
                      }`}
                      style={{ width: `${Math.min((data.accomplished / (data.target || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {data.submitted && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 pt-2">
                    <Clock className="w-3 h-3" />
                    Last updated: {data.submitted}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Export Button */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Export IPCR Document</h3>
            <p className="text-sm text-gray-600">Download your complete IPCR in Excel format</p>
          </div>
          <button
            onClick={onExport}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
