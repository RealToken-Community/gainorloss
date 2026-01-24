import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

type TimePeriod = 'all' | '1y' | '1q' | '1m' | '1w' | '1d';

interface FiltersBarProps {
  selectedTokens: string[];
  onTokensChange: (tokens: string[]) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  onReset: () => void;
  address: string;
  onResetAddress: () => void;
  oldestDataDate?: string; // Date la plus ancienne des données (pour "All")
}

export default function FiltersBar({
  selectedTokens,
  onTokensChange,
  dateRange,
  onDateRangeChange,
  onReset,
  address,
  onResetAddress,
  oldestDataDate,
}: FiltersBarProps) {
  const { theme, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isAddressExpanded, setIsAddressExpanded] = React.useState(false);
  const [activePeriod, setActivePeriod] = React.useState<TimePeriod>('all');

  // Calcul de la date de début pour chaque période
  const getDateForPeriod = (period: TimePeriod): string => {
    const today = new Date();
    let startDate: Date;

    switch (period) {
      case '1d':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        break;
      case '1w':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case '1m':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        break;
      case '1q':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 3);
        break;
      case '1y':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'all':
      default:
        return oldestDataDate || new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    }

    return startDate.toISOString().split('T')[0];
  };

  const handlePeriodChange = (period: TimePeriod) => {
    setActivePeriod(period);
    const startDate = getDateForPeriod(period);
    const endDate = new Date().toISOString().split('T')[0];
    onDateRangeChange({ start: startDate, end: endDate });
  };

  const timePeriods: { key: TimePeriod; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: '1y', label: '1Y' },
    { key: '1q', label: '1Q' },
    { key: '1m', label: '1M' },
    { key: '1w', label: '1W' },
    { key: '1d', label: '1D' },
  ];

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
    <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header avec titre, texte central et adresse */}
        <div className="flex items-center justify-between py-3 gap-4">
          {/* Gauche : Filters + bouton collapse */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filters</h2>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label={isCollapsed ? "Expand filters" : "Collapse filters"}
            >
              <svg
                className={`w-5 h-5 text-gray-600 dark:text-gray-300 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analytics and transaction details for your RMM positions.
            </p>
          </div>

          {/* Droite : Adresse + bouton collapse + bouton dark mode */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {address && (
              <>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  {truncateAddress(address)}
                </span>
                <button
                  onClick={() => setIsAddressExpanded(!isAddressExpanded)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label={isAddressExpanded ? "Collapse address" : "Expand address"}
                >
                  <svg
                    className="w-5 h-5 text-gray-600 dark:text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </>
            )}
            <button
              onClick={toggleTheme}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === 'dark' ? (
                <svg
                  className="w-5 h-5 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-gray-600 dark:text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Section adresse expandée - Overlay */}
        {isAddressExpanded && address && (
          <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Address</h3>
                  <button
                    onClick={() => setIsAddressExpanded(false)}
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
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Full Address</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{address}</p>
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
        )}

        {/* Contenu des filtres */}
        {!isCollapsed && (
          <div className="pb-4 border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-center">
              {/* Sélection des tokens */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tokens:</label>
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
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>

              {/* Boutons de période rapide */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                {timePeriods.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handlePeriodChange(key)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                      activePeriod === key
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Sélection de la plage de dates personnalisée */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From:</label>
                  <input
                    type="date"
                    lang="en"
                    value={dateRange.start}
                    onChange={(e) => {
                      setActivePeriod('all'); // Désélectionner les présets lors d'une sélection manuelle
                      onDateRangeChange({ ...dateRange, start: e.target.value });
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To:</label>
                  <input
                    type="date"
                    lang="en"
                    value={dateRange.end}
                    onChange={(e) => {
                      setActivePeriod('all'); // Désélectionner les présets lors d'une sélection manuelle
                      onDateRangeChange({ ...dateRange, end: e.target.value });
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Bouton Reset */}
              <button
                onClick={onReset}
                className="px-4 py-2 bg-gray-500 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
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

