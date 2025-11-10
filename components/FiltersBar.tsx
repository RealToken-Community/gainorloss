import React from 'react';

interface FiltersBarProps {
  selectedTokens: string[];
  onTokensChange: (tokens: string[]) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  onReset: () => void;
  address: string;
  onResetAddress: () => void;
}

export default function FiltersBar({
  selectedTokens,
  onTokensChange,
  dateRange,
  onDateRangeChange,
  onReset,
  address,
  onResetAddress,
}: FiltersBarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isAddressExpanded, setIsAddressExpanded] = React.useState(false);

  // Fonction pour tronquer l'adresse (4 premiers + 4 derniers caractères)
  const truncateAddress = (addr: string): string => {
    if (!addr || addr.length < 8) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const tokens = [
    { key: 'USDC', label: 'USDC' },
    { key: 'WXDAI', label: 'WXDAI' },
    { key: 'WXDAI_V2', label: 'WXDAI V2' }
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header avec titre, texte central et adresse */}
        <div className="flex items-center justify-between py-3 gap-4">
          {/* Gauche : Filters + bouton collapse */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900">Filters</h2>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={isCollapsed ? "Expand filters" : "Collapse filters"}
            >
              <svg
                className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>

          {/* Milieu : Texte descriptif */}
          <div className="flex-1 text-center hidden md:block">
            <p className="text-sm text-gray-600">
              Analytics and transaction details for your RMM positions.
            </p>
          </div>

          {/* Droite : Adresse + bouton collapse */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {address && (
              <>
                <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                  {truncateAddress(address)}
                </span>
                <button
                  onClick={() => setIsAddressExpanded(!isAddressExpanded)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label={isAddressExpanded ? "Collapse address" : "Expand address"}
                >
                  <svg
                    className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${isAddressExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Section adresse expandée - Overlay */}
        {isAddressExpanded && address && (
          <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full border border-gray-200">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Current Address</h3>
                  <button
                    onClick={() => setIsAddressExpanded(false)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <svg
                      className="w-5 h-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Full Address</p>
                  <p className="text-sm font-mono text-gray-900 break-all">{address}</p>
                </div>
                <button
                  onClick={onResetAddress}
                  className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  Try another address
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contenu des filtres */}
        {!isCollapsed && (
          <div className="pb-4 border-t border-gray-100 pt-4">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-center">
              {/* Sélection des tokens */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Tokens:</label>
                {tokens.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTokens.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onTokensChange([...selectedTokens, key]);
                        } else {
                          onTokensChange(selectedTokens.filter(t => t !== key));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              {/* Sélection de la plage de dates */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">From:</label>
                  <input
                    type="date"
                    lang="en"
                    value={dateRange.start}
                    onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">To:</label>
                  <input
                    type="date"
                    lang="en"
                    value={dateRange.end}
                    onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Bouton Reset */}
              <button
                onClick={onReset}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                🔄 Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

