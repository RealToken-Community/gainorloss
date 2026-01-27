import React from 'react';

interface SettingsPanelProps {
  address: string;
  onResetAddress: () => void;
  isOpen: boolean;
  onClose: () => void;
  compressDate: boolean;
  onCompressDateChange: (value: boolean) => void;
}

export default function SettingsPanel({
  address,
  onResetAddress,
  isOpen,
  onClose,
  compressDate,
  onCompressDateChange,
}: SettingsPanelProps) {
  if (!isOpen || !address) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-gray-600 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Address section */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Full Address</p>
            <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{address}</p>
          </div>

          {/* Compress Dates toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Compress dates</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Equal spacing between points on charts</p>
            </div>
            <button
              onClick={() => onCompressDateChange(!compressDate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                compressDate ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={compressDate}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  compressDate ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <button
            onClick={onResetAddress}
            className="w-full px-4 py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            Try another address
          </button>
        </div>
      </div>
    </div>
  );
}
