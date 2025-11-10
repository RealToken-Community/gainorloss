import React, { useState, useMemo } from 'react';
import { Transaction } from '../utils/api/types';
import { TOKEN_TO_VERSION } from '../utils/constants';

interface TransactionWithType extends Transaction {
  type: 'borrow' | 'repay' | 'deposit' | 'withdraw' | 'ronday' | 'in_others' | 'out_others';
  token: 'USDC' | 'WXDAI';
  version?: 'V2' | 'V3';
}

interface TransactionsTableProps {
  transactions: TransactionWithType[];
  userAddress: string;
  title: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  // Filtres partagés depuis le parent
  selectedTokens: string[];
  dateRange: { start: string; end: string };
}

const TransactionsTable: React.FC<TransactionsTableProps> = ({ 
  transactions, 
  userAddress, 
  title, 
  isCollapsed = false, 
  onToggleCollapse,
  selectedTokens,
  dateRange: dateRangeProp
}) => {
  // Sélection multiple des types de transactions (local)
  // Si le Set contient 'all', alors tous les types sont sélectionnés
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['all']));

  // Filtrer les transactions
  const filteredTransactions = useMemo(() => {
    // Normaliser les dates pour la comparaison (éviter les problèmes de timezone)
    const startDate = new Date(dateRangeProp.start);
    startDate.setHours(0, 0, 0, 0);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    
    const endDate = new Date(dateRangeProp.end);
    endDate.setHours(23, 59, 59, 999);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);
    
    return transactions.filter(tx => {
      // Filtre par token et version (depuis props du parent)
      // Utilise TOKEN_TO_VERSION pour déterminer automatiquement la version
      const tokenMatch = selectedTokens.some(selectedToken => {
        const expectedVersion = TOKEN_TO_VERSION[selectedToken];
        if (!expectedVersion) return false;
        
        // Pour USDC, on vérifie juste le token
        if (selectedToken === 'USDC') {
          return tx.token === 'USDC' && tx.version === expectedVersion;
        }
        
        // Pour WXDAI et WXDAI_V2, on vérifie le token ET la version
        if (selectedToken === 'WXDAI' || selectedToken === 'WXDAI_V2') {
          return tx.token === 'WXDAI' && tx.version === expectedVersion;
        }
        
        return false;
      });
      
      // Filtre par type de transaction (local)
      const typeMatch = selectedTypes.has('all') || selectedTypes.has(tx.type);
      
      // Filtre par date (depuis props du parent) - Comparer les timestamps directement
      const txTimestamp = tx.timestamp; // Déjà en Unix timestamp
      const dateMatch = txTimestamp >= startTimestamp && txTimestamp <= endTimestamp;
      
      return tokenMatch && typeMatch && dateMatch;
    });
  }, [transactions, selectedTokens, selectedTypes, dateRangeProp.start, dateRangeProp.end]);

  // Gérer la sélection/désélection d'un type
  const handleTypeToggle = (type: string) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      
      if (type === 'all') {
        // Si on clique sur 'all', on vide le Set et on ajoute seulement 'all'
        return new Set(['all']);
      } else {
        // Si on sélectionne un type spécifique, on retire 'all' s'il était présent
        newSet.delete('all');
        
        // Toggle le type sélectionné
        if (newSet.has(type)) {
          newSet.delete(type);
          // Si plus rien n'est sélectionné, on remet 'all'
          if (newSet.size === 0) {
            return new Set(['all']);
          }
        } else {
          newSet.add(type);
        }
        
        return newSet;
      }
    });
  };

  // Fonction pour formater les montants
  const formatAmount = (amount: string, decimals = 6): number => {
    return parseFloat(amount) / Math.pow(10, decimals);
  };

  // Fonction pour formater les dates
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fonction pour formater une date pour l'input
  const formatDateForInput = (dateStr: string): string => {
    return dateStr;
  };

  // Fonction pour obtenir l'icône du type de transaction
  const getTransactionIcon = (type: string): string => {
    switch (type) {
      case 'borrow': return '🤝';
      case 'repay': return '📥';
      case 'deposit': return '💰';
      case 'withdraw': return '💸';
      case 'ronday': return '🗓';
      case 'in_others': return '⬇️';
      case 'out_others': return '⬆️';
      default: return '📊';
    }
  };

  // Fonction pour obtenir la couleur du type de transaction
  const getTransactionColor = (type: string): string => {
    switch (type) {
      case 'borrow': return 'text-red-600';
      case 'repay': return 'text-green-600';
      case 'deposit': return 'text-blue-600';
      case 'withdraw': return 'text-orange-600';
      case 'ronday': return 'text-purple-600';
      case 'in_others': return 'text-cyan-600';
      case 'out_others': return 'text-pink-600';
      default: return 'text-gray-600';
    }
  };

  // Fonction pour exporter en CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Token', 'Montant', 'Hash', 'Version'];
    const csvData = [
      headers.join(','),
      ...filteredTransactions.map(tx => [
        formatDate(tx.timestamp),
        tx.type,
        tx.token,
        formatAmount(tx.amount, tx.token === 'USDC' ? 6 : 18).toFixed(2),
        tx.txHash || 'Hash non disponible',
        tx.version || 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${userAddress}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label={isCollapsed ? "Scroll" : "Unscroll"}
            >
              {isCollapsed ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              )}
            </button>
          )}
        </div>
        
        <div className="flex flex-col lg:flex-row gap-4">
          {isCollapsed && (
            <div className="flex flex-wrap items-center gap-2 lg:gap-4 text-sm text-gray-600">
              <span>Total: {filteredTransactions.length}</span>
              <span>Borrow: {filteredTransactions.filter(tx => tx.type === 'borrow').length}</span>
              <span>Repay: {filteredTransactions.filter(tx => tx.type === 'repay').length}</span>
              <span>Deposit: {filteredTransactions.filter(tx => tx.type === 'deposit').length}</span>
              <span>Withdraw: {filteredTransactions.filter(tx => tx.type === 'withdraw').length}</span>
              <span>Period: {formatDateForInput(dateRangeProp.start)} - {formatDateForInput(dateRangeProp.end)}</span>
            </div>
          )}

          {!isCollapsed && (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Sélection multiple des types de transactions (local) */}
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white min-w-[200px]">
                    {([
                      { value: 'all', label: 'All', icon: '📊' },
                      { value: 'borrow', label: 'Borrow', icon: '🤝' },
                      { value: 'repay', label: 'Repay', icon: '📥' },
                      { value: 'deposit', label: 'Deposit', icon: '💰' },
                      { value: 'withdraw', label: 'Withdraw', icon: '💸' },
                      { value: 'ronday', label: 'Ronday', icon: '🗓' },
                      { value: 'in_others', label: 'In others', icon: '⬇️' },
                      { value: 'out_others', label: 'Out others', icon: '⬆️' },
                    ] as const).map(({ value, label, icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleTypeToggle(value)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          selectedTypes.has(value)
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span>{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedTypes(new Set(['all']));
                    }}
                    className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                    🔄 Reset Filters
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
            {/* Colonne 1: Total */}
            <div className="bg-blue-50 border border-blue-100 p-3 sm:p-4 rounded-xl">
              <h3 className="text-xs sm:text-sm font-medium text-blue-700 mb-1">Total</h3>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">{filteredTransactions.length}</p>
            </div>
            
            {/* Colonne 2: Emprunts */}
            <div className="bg-red-50 border border-red-100 p-3 sm:p-4 rounded-xl">
              <h3 className="text-xs sm:text-sm font-medium text-red-700 mb-1">Borrow</h3>
              <p className="text-lg sm:text-2xl font-bold text-red-600">
                {filteredTransactions.filter(tx => tx.type === 'borrow').length}
              </p>
            </div>
            
            {/* Colonne 3: Remboursements */}
            <div className="bg-purple-50 border border-purple-100 p-3 sm:p-4 rounded-xl">
              <h3 className="text-xs sm:text-sm font-medium text-purple-700 mb-1">Repay</h3>
              <p className="text-lg sm:text-2xl font-bold text-purple-600">
                {filteredTransactions.filter(tx => tx.type === 'repay').length}
              </p>
            </div>
            
            {/* Colonne 4: Dépôts */}
            <div className="bg-green-50 border border-green-100 p-3 sm:p-4 rounded-xl">
              <h3 className="text-xs sm:text-sm font-medium text-green-700 mb-1">Deposit</h3>
              <p className="text-lg sm:text-2xl font-bold text-green-600">
                {filteredTransactions.filter(tx => tx.type === 'deposit').length}
              </p>
            </div>
            
            {/* Colonne 5: Retraits */}
            <div className="bg-orange-50 border border-orange-100 p-3 sm:p-4 rounded-xl">
              <h3 className="text-xs sm:text-sm font-medium text-orange-700 mb-1">Withdraw</h3>
              <p className="text-lg sm:text-2xl font-bold text-orange-600">
                {filteredTransactions.filter(tx => tx.type === 'withdraw').length}
              </p>
            </div>
            
            {/* Colonne 6: Période */}
            <div className="bg-gray-50 border border-gray-100 p-3 sm:p-4 rounded-xl col-span-2 sm:col-span-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-1">Period</h3>
              <p className="text-xs sm:text-sm font-bold text-gray-600">
                {formatDateForInput(dateRangeProp.start)} - {formatDateForInput(dateRangeProp.end)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Date</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Type</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Token</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Amount</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Hash</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Version</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                      No transaction found with the current filters
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600">
                        {formatDate(tx.timestamp)}
                      </td>
                      <td className="py-3 px-2 sm:px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTransactionColor(tx.type)}`}>
                          {getTransactionIcon(tx.type)} {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600">
                        {tx.token}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-900">
                        {formatAmount(tx.amount, tx.token === 'USDC' ? 6 : 18).toFixed(2)} {tx.token}
                      </td>
                      <td className="py-3 px-2 sm:px-4">
                        {tx.txHash ? (
                          <a
                            href={`https://gnosisscan.io/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-mono truncate block max-w-xs"
                          >
                            {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs sm:text-sm">Hash not available</span>
                        )}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          tx.version === 'V2' ? 'bg-blue-100 text-blue-700' : 
                          tx.version === 'V3' ? 'bg-green-100 text-green-700' : 
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {tx.version || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionsTable; 