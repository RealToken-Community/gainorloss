import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { TOKENS } from '../utils/constants';
import Chart from '../components/Chart';
import TransactionsTable from '../components/TransactionsTable';
import FinancialSummary from '../components/FinancialSummary';
import FiltersBar from '../components/FiltersBar';
import logger from '../utils/logger';
import { calculateStartBalance } from '../lib/utils/interest-calculator';

// Types pour les données de l'API V3
interface DailyDetail {
  date: string;
  timestamp: number;
  debt?: string;
  supply?: string;
  dailyRate: number;
  apr: number;
  periodInterest: string;
  totalInterest: string;
  transactionAmount?: string;
  transactionType?: string;
  source?: 'real' | 'estimated'; // Ajouter un champ pour indiquer la source
}

// Types pour les données de l'API V2
interface V2Transaction {
  txHash: string;
  amount: string;
  amountFormatted: number;
  timestamp: number;
  type: 'borrow' | 'repay' | 'deposit' | 'withdraw';
  reserve: 'rmmWXDAI';
}

// Types pour les balances des tokens
interface TokenBalance {
  token: string;
  balance: string;
  symbol: string;
  decimals: number;
}

interface ApiResponse {
  success: boolean;
  data: {
    results: Array<{
      address: string;
      success: boolean;
      data: {
        interests: {
          USDC?: {
            token: string;
            borrow: {
              totalInterest: string;
              dailyDetails: DailyDetail[];
            };
            supply: {
              totalInterest: string;
              dailyDetails: DailyDetail[];
            };
            summary: {
              totalBorrowInterest: string;
              totalSupplyInterest: string;
              netInterest: string;
            };
          };
          WXDAI: {
            token: string;
            borrow: {
              totalInterest: string;
              dailyDetails: DailyDetail[];
            };
            supply: {
              totalInterest: string;
              dailyDetails: DailyDetail[];
            };
            summary: {
              totalBorrowInterest: string;
              totalSupplyInterest: string;
              netInterest: string;
            };
          };
        };
        transactions?: {
          USDC: {
            debt: Array<{
              txHash: string;
              amount: string;
              timestamp: number;
              type: string;
            }>;
            supply: Array<{
              txHash: string;
              amount: string;
              timestamp: number;
              type: string;
            }>;
          };
          WXDAI: {
            debt: Array<{
              txHash: string;
              amount: string;
              timestamp: number;
              type: string;
            }>;
            supply: Array<{
              txHash: string;
              amount: string;
              timestamp: number;
              type: string;
            }>;
          };
        };
      };
    }>;
  };
}

export default function Home() {
  const [address, setAddress] = useState('');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [dataV2, setDataV2] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setCollapsed] = useState(true);
  
  // Filtres partagés entre FinancialSummary et TransactionsTable
  const [selectedTokens, setSelectedTokens] = useState<string[]>(['USDC', 'WXDAI', 'WXDAI_V2']);
  
  // Fonction pour calculer la date range par défaut depuis les données
  const calculateDefaultDateRange = (): { start: string; end: string } => {
    const allDates: string[] = [];
    
    // Collecter toutes les dates des données V3
    const usdcData = data?.data?.results?.[0]?.data?.interests?.USDC;
    const wxdaiData = data?.data?.results?.[0]?.data?.interests?.WXDAI;
    const v2Data = dataV2?.data?.results?.[0]?.data?.interests?.WXDAI;
    
    if (usdcData?.borrow?.dailyDetails) {
      usdcData.borrow.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
    }
    if (usdcData?.supply?.dailyDetails) {
      usdcData.supply.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
    }
    if (wxdaiData?.borrow?.dailyDetails) {
      wxdaiData.borrow.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
    }
    if (wxdaiData?.supply?.dailyDetails) {
      wxdaiData.supply.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
    }
    if (v2Data?.borrow?.dailyDetails) {
      v2Data.borrow.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
    }
    if (v2Data?.supply?.dailyDetails) {
      v2Data.supply.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
    }
    
    // Collecter toutes les dates des transactions (sans filtre pour calculer la plage complète)
    const transactions = prepareAllTransactions();
    if (transactions) {
      transactions.forEach((tx: any) => {
        const date = new Date(tx.timestamp * 1000);
        const dateString = date.toISOString().split('T')[0];
        allDates.push(dateString);
      });
    }
    
    // Trouver la date la plus ancienne
    if (allDates.length > 0) {
      // Convertir les dates YYYYMMDD en YYYY-MM-DD pour le tri
      const sortedDates = allDates
        .map(date => {
          // Si format YYYYMMDD, convertir en YYYY-MM-DD
          if (date.length === 8 && !date.includes('-')) {
            return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
          }
          return date;
        })
        .sort();
      const oldestDate = sortedDates[0];
      return {
        start: oldestDate,
        end: new Date().toISOString().split('T')[0] // Aujourd'hui
      };
    }
    
    // Fallback : 1er janvier de l'année en cours
    const today = new Date().toISOString().split('T')[0];
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    return { start: startOfYear, end: today };
  };
  
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const today = new Date().toISOString().split('T')[0];
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    return { start: startOfYear, end: today };
  });
  
  // Mettre à jour la date range quand les données sont chargées
  useEffect(() => {
    if (data || dataV2) {
      // Recalculer avec une fonction inline pour éviter les dépendances circulaires
      const allDates: string[] = [];
      
      const usdcData = data?.data?.results?.[0]?.data?.interests?.USDC;
      const wxdaiData = data?.data?.results?.[0]?.data?.interests?.WXDAI;
      const v2Data = dataV2?.data?.results?.[0]?.data?.interests?.WXDAI;
      
      if (usdcData?.borrow?.dailyDetails) {
        usdcData.borrow.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
      }
      if (usdcData?.supply?.dailyDetails) {
        usdcData.supply.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
      }
      if (wxdaiData?.borrow?.dailyDetails) {
        wxdaiData.borrow.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
      }
      if (wxdaiData?.supply?.dailyDetails) {
        wxdaiData.supply.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
      }
      if (v2Data?.borrow?.dailyDetails) {
        v2Data.borrow.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
      }
      if (v2Data?.supply?.dailyDetails) {
        v2Data.supply.dailyDetails.forEach((detail: any) => allDates.push(detail.date));
      }
      
      // Collecter les dates des transactions (sans filtre pour calculer la plage complète)
      const transactions = prepareAllTransactions();
      if (transactions) {
        transactions.forEach((tx: any) => {
          const date = new Date(tx.timestamp * 1000);
          const dateString = date.toISOString().split('T')[0];
          allDates.push(dateString);
        });
      }
      
      if (allDates.length > 0) {
        const sortedDates = allDates
          .map(date => {
            if (date.length === 8 && !date.includes('-')) {
              return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
            }
            return date;
          })
          .sort();
        const oldestDate = sortedDates[0];
        setDateRange({
          start: oldestDate,
          end: new Date().toISOString().split('T')[0]
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dataV2]);

  // Fonction pour formater les montants (conversion depuis base units)
  const formatAmount = (amount: string, decimals = 6): number => {
    return parseFloat(amount) / Math.pow(10, decimals);
  };

  // Fonction pour formater les dates YYYYMMDD
  const formatDate = (dateStr: string): string => {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}/${month}/${year}`;
  };

  // Fonction pour normaliser une date en YYYY-MM-DD pour comparaison
  const normalizeDate = (date: string): string => {
    // Si format YYYYMMDD (8 caractères sans tiret)
    if (date.length === 8 && !date.includes('-')) {
      return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
    }
    // Si déjà en YYYY-MM-DD
    return date;
  };

  // Fonction pour vérifier si une date est dans la plage
  const isDateInRange = (date: string, start: string, end: string): boolean => {
    const normalizedDate = normalizeDate(date);
    const normalizedStart = normalizeDate(start);
    const normalizedEnd = normalizeDate(end);
    return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
  };

  // Fonction pour créer un point de départ synthétique pour les graphiques filtrés
  // Utilise l'interpolation linéaire entre les points existants
  const createSyntheticStartPoint = (
    filteredDetails: DailyDetail[],
    allDetails: DailyDetail[],
    valueKey: 'debt' | 'supply',
    decimals: number,
    startDate: string
  ): { date: string; value: number; formattedDate: string; isSynthetic?: boolean } | null => {
    if (allDetails.length === 0) return null;

    const normalizedStartDate = normalizeDate(startDate);

    // Vérifier si un point existe déjà à la date de début
    const existingPointAtStart = filteredDetails.find(
      detail => normalizeDate(detail.date) === normalizedStartDate
    );
    if (existingPointAtStart) return null;

    // Utiliser l'interpolation pour calculer la balance à la date de début
    const result = calculateStartBalance(allDetails, startDate, valueKey);
    if (!result) return null;

    // Convertir en unités formatées
    const startValue = result.balance / Math.pow(10, decimals);

    // Formater la date de début pour l'affichage
    const startDateFormatted = normalizedStartDate.replace(/-/g, '');

    return {
      date: startDateFormatted.length === 10
        ? `${startDateFormatted.substring(0, 4)}${startDateFormatted.substring(5, 7)}${startDateFormatted.substring(8, 10)}`
        : startDateFormatted,
      value: Math.max(0, startValue),
      formattedDate: new Date(normalizedStartDate).toLocaleDateString('fr-CH'),
      isSynthetic: result.isInterpolated
    };
  };

  // Fonction prepareChartData avec filtrage par date et point de départ synthétique
  const prepareChartData = (
    dailyDetails: DailyDetail[],
    valueKey: 'debt' | 'supply',
    decimals = 6,
    dateRange?: { start: string; end: string }
  ) => {
    if (!dailyDetails || dailyDetails.length === 0) return [];

    // Filtrer par date si dateRange est fourni
    let filteredDetails = dailyDetails;
    if (dateRange) {
      filteredDetails = dailyDetails.filter(detail =>
        isDateInRange(detail.date, dateRange.start, dateRange.end)
      );
    }

    // Convertir les détails filtrés en données de graphique
    const chartData = filteredDetails.map(detail => ({
      date: detail.date,
      value: formatAmount(detail[valueKey] || '0', decimals),
      formattedDate: formatDate(detail.date),
      isSynthetic: false
    }));

    // Créer un point de départ synthétique si on filtre par période (pas "all")
    // et qu'il n'y a pas déjà un point à la date de début
    if (dateRange && filteredDetails.length > 0) {
      const oldestDataDate = calculateDefaultDateRange().start;
      const isAllData = normalizeDate(dateRange.start) <= normalizeDate(oldestDataDate);

      if (!isAllData) {
        const syntheticPoint = createSyntheticStartPoint(
          filteredDetails,
          dailyDetails,
          valueKey,
          decimals,
          dateRange.start
        );

        if (syntheticPoint) {
          // Insérer le point synthétique au début
          chartData.unshift(syntheticPoint);
        }
      }
    }

    return chartData;
  };

  // Fonction pour préparer les données V2 pour Recharts avec filtrage par date
  const prepareV2ChartData = (
    transactions: V2Transaction[],
    dateRange?: { start: string; end: string }
  ) => {
    // Filtrer les transactions par date si dateRange est fourni
    let filteredTransactions = transactions;
    if (dateRange) {
      filteredTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.timestamp * 1000).toISOString().split('T')[0];
        return isDateInRange(txDate, dateRange.start, dateRange.end);
      });
    }
    
    // Calculer la dette cumulée pour V2 (avec support des valeurs négatives)
    let cumulativeDebt = 0;
    const chartData: Array<{date: string; value: number; formattedDate: string; type?: string; amount?: number; timestamp?: number}> = [];
    
    // Trier les transactions par timestamp
    const sortedTransactions = [...filteredTransactions].sort((a, b) => a.timestamp - b.timestamp);
    
    for (const tx of sortedTransactions) {
      if (tx.type === 'borrow') {
        cumulativeDebt += tx.amountFormatted;
      } else if (tx.type === 'repay') {
        cumulativeDebt -= tx.amountFormatted;
      }
      
      chartData.push({
        date: new Date(tx.timestamp * 1000).toISOString().split('T')[0],
        value: cumulativeDebt, // Utiliser la dette cumulée au lieu du montant individuel
        formattedDate: new Date(tx.timestamp * 1000).toLocaleDateString('fr-CH'),
        type: tx.type,
        amount: tx.amountFormatted,
        timestamp: tx.timestamp
      });
    }
    
    return chartData;
  };

  // Fonction pour préparer toutes les transactions pour le tableau avec filtrage par date
  const prepareAllTransactions = (dateRange?: { start: string; end: string }) => {
    const allTransactions: any[] = [];

    // Ajouter les transactions V3
    if (data?.data?.results?.[0]?.data?.transactions) {
      const v3Transactions = data.data.results[0].data.transactions;
      
      // Transactions USDC V3
      if (v3Transactions.USDC) {
        v3Transactions.USDC.debt.forEach((tx: any) => {
          allTransactions.push({
            timestamp: tx.timestamp,
            amount: tx.amount,
            type: tx.type,
            token: 'USDC',
            txHash: tx.txHash,
            version: 'V3'
          });
        });
        
        v3Transactions.USDC.supply.forEach((tx: any) => {
          allTransactions.push({
            timestamp: tx.timestamp,
            amount: tx.amount,
            type: tx.type,
            token: 'USDC',
            txHash: tx.txHash,
            version: 'V3'
          });
        });
      }

      // Transactions WXDAI V3
      if (v3Transactions.WXDAI) {
        v3Transactions.WXDAI.debt.forEach((tx: any) => {
          allTransactions.push({
            timestamp: tx.timestamp,
            amount: tx.amount,
            type: tx.type,
            token: 'WXDAI',
            txHash: tx.txHash,
            version: 'V3'
          });
        });
        
        v3Transactions.WXDAI.supply.forEach((tx: any) => {
          allTransactions.push({
            timestamp: tx.timestamp,
            amount: tx.amount,
            type: tx.type,
            token: 'WXDAI',
            txHash: tx.txHash,
            version: 'V3'
          });
        });
      }
    }

    //  Ajouter les transactions V2
    if (dataV2?.data?.results?.[0]?.data?.transactions?.WXDAI) {
      //  Même chemin que V3 !
      const v2Data = dataV2.data.results[0].data.transactions.WXDAI;
      
      // Transactions de dette WXDAI V2
      v2Data.debt.forEach((tx: any) => {
        allTransactions.push({
          timestamp: tx.timestamp,
          amount: tx.amount,
          type: tx.type,
          token: 'WXDAI',
          txHash: tx.txHash,
          version: 'V2'
        });
      });

      // Transactions de supply WXDAI V2
      v2Data.supply.forEach((tx: any) => {
        allTransactions.push({
          timestamp: tx.timestamp,
          amount: tx.amount,
          type: tx.type,
          token: 'WXDAI',
          txHash: tx.txHash,
          version: 'V2'
        });
      });
    }

    // Filtrer par date si dateRange est fourni
    let filteredTransactions = allTransactions;
    if (dateRange) {
      filteredTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.timestamp * 1000).toISOString().split('T')[0];
        return isDateInRange(txDate, dateRange.start, dateRange.end);
      });
    }
    
    // Trier par timestamp décroissant (plus récent en premier)
    return filteredTransactions.sort((a, b) => b.timestamp - a.timestamp);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address.trim()) {
      alert('Veuillez saisir une adresse');
      return;
    }

    // Déclarer normalizedAddress avant le bloc try pour qu'elle soit accessible après
    let normalizedAddress: string;
    
    // Validation de l'adresse EVM avec vérification du checksum EIP-55
    try {
      const { isAddress, getAddress } = await import('ethers');
      const trimmedAddress = address.trim();
      
      if (!isAddress(trimmedAddress)) {
        alert('Adresse EVM invalide (format: 0x...)');
        return;
      }
      
      // Normaliser l'adresse avec le bon checksum EIP-55
      normalizedAddress = getAddress(trimmedAddress);
      
      // Vérifier si l'adresse fournie avait le bon checksum
      // Si l'adresse originale n'est pas identique à la normalisée, le checksum était incorrect
      if (trimmedAddress !== normalizedAddress && trimmedAddress.toLowerCase() !== normalizedAddress.toLowerCase()) {
        // L'adresse était valide mais avec un mauvais checksum - on normalise silencieusement
        // mais on pourrait aussi informer l'utilisateur pour des raisons de sécurité
        logger.warn(`Adresse normalisée (checksum corrigé): ${trimmedAddress} → ${normalizedAddress}`);
      }
      
      setAddress(normalizedAddress);
    } catch (error) {
      logger.error('Erreur lors de la validation de l\'adresse:', error);
      alert('Erreur lors de la validation de l\'adresse');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      // Utiliser les routes API internes Next.js avec l'adresse normalisée
      const apiUrl = `/api/rmm/v3/${normalizedAddress}`;
      logger.debug('Appel API vers:', apiUrl);
      
      const response = await fetch(apiUrl);
      logger.debug('Réponse API:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      logger.debug('Données reçues:', result);
      setData(result);
      
      // Récupérer les données RMM v2
      logger.debug('Récupération des données RMM v2...');
      try {
        const v2Response = await fetch(`/api/rmm/v2/${normalizedAddress}`);
        if (v2Response.ok) {
          const v2Result = await v2Response.json();
          logger.debug('Données RMM v2 reçues:', v2Result);
          setDataV2(v2Result);
        } else {
          logger.warn('Erreur lors de la récupération des données RMM v2');
        }
      } catch (v2Error) {
        logger.warn('Erreur lors de la récupération des données RMM v2:', v2Error);
      }

    } catch (err) {
      logger.error('Erreur lors de la récupération des données:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAddress('');
    setData(null);
    setDataV2(null);
    setError(null);
    setLoading(false);
  };

  // Écran de chargement
  if (loading) {
    return (
      <>
        <Head>
          <title>RMM Analytics - Analysis in progress</title>
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center max-w-md">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 dark:border-gray-700 border-t-blue-500 mx-auto mb-6"></div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Analysis in progress</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">RMM data recovery for {address}</p>
          </div>
        </div>
      </>
    );
  }

  // Si on a des données ou une erreur, afficher les résultats
  if (data || error) {
    const result = data?.data?.results?.[0];
    const usdcData = result?.data?.interests?.USDC;
    const wxdaiData = result?.data?.interests?.WXDAI;
    
    //  NOUVEAU: Récupérer directement depuis les derniers points
    const usdcLastDebtPoint = usdcData?.borrow?.dailyDetails?.[usdcData.borrow.dailyDetails.length - 1];
    const usdcLastSupplyPoint = usdcData?.supply?.dailyDetails?.[usdcData.supply.dailyDetails.length - 1];

    const wxdaiLastDebtPoint = wxdaiData?.borrow?.dailyDetails?.[wxdaiData.borrow.dailyDetails.length - 1];
    const wxdaiLastSupplyPoint = wxdaiData?.supply?.dailyDetails?.[wxdaiData.supply.dailyDetails.length - 1];

    //  NOUVEAU: Calculer les valeurs finales
    const usdcTotalDebtInterest = usdcLastDebtPoint ? parseFloat(usdcLastDebtPoint.totalInterest) : 0;
    const usdcTotalSupplyInterest = usdcLastSupplyPoint ? parseFloat(usdcLastSupplyPoint.totalInterest) : 0;
    const usdcNetInterest = usdcTotalSupplyInterest - usdcTotalDebtInterest;

    const wxdaiTotalDebtInterest = wxdaiLastDebtPoint ? parseFloat(wxdaiLastDebtPoint.totalInterest) : 0;
    const wxdaiTotalSupplyInterest = wxdaiLastSupplyPoint ? parseFloat(wxdaiLastSupplyPoint.totalInterest) : 0;
    const wxdaiNetInterest = wxdaiTotalSupplyInterest - wxdaiTotalDebtInterest;

    const usdcBorrowDetails = usdcData?.borrow?.dailyDetails || [];
    const usdcSupplyDetails = usdcData?.supply?.dailyDetails || [];
    const wxdaiBorrowDetails = wxdaiData?.borrow?.dailyDetails || [];
    const wxdaiSupplyDetails = wxdaiData?.supply?.dailyDetails || [];

    return (
      <>
        <Head>
          <title>RMM Analytics</title>
        </Head>

        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Barre de filtres fixe en haut */}
          <FiltersBar
            selectedTokens={selectedTokens}
            onTokensChange={setSelectedTokens}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onReset={() => {
              setSelectedTokens(['USDC', 'WXDAI', 'WXDAI_V2']);
              const calculatedRange = calculateDefaultDateRange();
              setDateRange(calculatedRange);
            }}
            address={address}
            onResetAddress={resetForm}
            oldestDataDate={calculateDefaultDateRange().start}
          />

          {/* Contenu principal avec padding-top pour éviter le chevauchement */}
          <div className="pt-24 sm:pt-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <FinancialSummary
              usdcData={usdcData}
              wxdaiData={wxdaiData}
              v2Data={dataV2?.data?.results?.[0]?.data?.interests?.WXDAI}
              userAddress={address}
              transactions={prepareAllTransactions(dateRange)}
              selectedTokens={selectedTokens}
              dateRange={dateRange}
            />

            {/* Erreur */}
            {error && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-8">
                <div className="text-center">
                  <div className="text-red-500 text-6xl mb-4">⚠️</div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Erreur</h2>
                  <p className="text-gray-600 dark:text-gray-400">{error}</p>
                </div>
              </div>
            )}

            
            {usdcData && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">USDC Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-6 rounded-xl">
                    <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Borrow Interest</h3>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {formatAmount(usdcTotalDebtInterest.toString()).toFixed(2)} USDC
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-6 rounded-xl">
                    <h3 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Supply Interest</h3>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {formatAmount(usdcTotalSupplyInterest.toString()).toFixed(2)} USDC
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 p-6 rounded-xl">
                    <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">PnL Net</h3>
                    <p className={`text-3xl font-bold ${usdcNetInterest >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatAmount(usdcNetInterest.toString()).toFixed(2)} USDC
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Graphiques USDC */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Graphique Dette USDC */}
              <Chart
                data={prepareChartData(usdcBorrowDetails, 'debt', 6, dateRange)}
                title="USDC Debt Evolution"
                color="#dc2626"
                type="line"
                tokenAddress={TOKENS.USDC.debtAddress}
                userAddress={address}
              />

              {/* Graphique Supply USDC */}
              <Chart
                data={prepareChartData(usdcSupplyDetails, 'supply', 6, dateRange)}
                title="USDC Supply Evolution"
                color="#059669"
                type="area"
                tokenAddress={TOKENS.USDC.address}
                userAddress={address}
              />
            </div>

            {/* WXDAI Summary */}
            {wxdaiData && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">WXDAI Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-6 rounded-xl">
                    <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Borrow Interest</h3>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {formatAmount(wxdaiTotalDebtInterest.toString(), 18).toFixed(2)} WXDAI
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-6 rounded-xl">
                    <h3 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Supply Interest</h3>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {formatAmount(wxdaiTotalSupplyInterest.toString(), 18).toFixed(2)} WXDAI
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 p-6 rounded-xl">
                    <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">PnL Net</h3>
                    <p className={`text-3xl font-bold ${wxdaiNetInterest >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatAmount(wxdaiNetInterest.toString(), 18).toFixed(2)} WXDAI
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Graphiques WXDAI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Graphique Dette WXDAI */}
              <Chart
                data={prepareChartData(wxdaiBorrowDetails, 'debt', 18, dateRange)}
                title="WXDAI Debt Evolution"
                color="#dc2626"
                type="line"
                tokenAddress={TOKENS.WXDAI.supplyAddress}
                userAddress={address}
              />
                    
              {/* Graphique Supply WXDAI */}
              <Chart
                data={prepareChartData(wxdaiSupplyDetails, 'supply', 18, dateRange)}
                title="WXDAI Supply Evolution"
                color="#059669"
                type="area"
                tokenAddress="0x0ca4f5554dd9da6217d62d8df2816c82bba4157b"
                userAddress={address}
              />
            </div>

            {/* Graphiques RMM v2 - Montants */}
            {dataV2 && (
              <>
               
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">RMM v2 Transactions</h2>
                  
                  {/* Vérifier si le wallet a des données V2 */}
                  {!dataV2.data?.results?.[0]?.data?.interests?.WXDAI ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">😢</div>
                      <p className="text-lg text-gray-600 dark:text-gray-400">
                        This wallet is too young and has never known the V2 :&apos;(
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Extraire les données V2 comme V3 */}
                      {(() => {
                        const v2Result = dataV2.data.results[0];
                        const v2WxdaiData = v2Result.data.interests.WXDAI;
                        const v2WxdaiBorrowDetails = v2WxdaiData.borrow.dailyDetails || [];
                        const v2WxdaiSupplyDetails = v2WxdaiData.supply.dailyDetails || [];
                        
                        return (
                          <>
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 mb-8">
                              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">WXDAI Summary (V2)</h2>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-6 rounded-xl">
                                  <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Borrow Interest</h3>
                                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                                    {formatAmount(v2WxdaiData.borrow.totalInterest.toString(), 18).toFixed(2)} WXDAI
                                  </p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-6 rounded-xl">
                                  <h3 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Supply Interest</h3>
                                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                    {formatAmount(v2WxdaiData.supply.totalInterest.toString(), 18).toFixed(2)} WXDAI
                                  </p>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 p-6 rounded-xl">
                                  <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">PnL Net</h3>
                                  <p className={`text-3xl font-bold ${(parseFloat(v2WxdaiData.supply.totalInterest) - parseFloat(v2WxdaiData.borrow.totalInterest)) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatAmount((parseFloat(v2WxdaiData.supply.totalInterest) - parseFloat(v2WxdaiData.borrow.totalInterest)).toString(), 18).toFixed(2)} WXDAI
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Graphiques WXDAI v2 */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                              {/* Graphique Dette WXDAI v2 */}
                              <Chart
                                data={prepareChartData(v2WxdaiBorrowDetails, 'debt', 18, dateRange)}
                                title="WXDAI Debt Evolution (v2)"
                                color="#f59e0b"
                                type="line"
                                tokenAddress={TOKENS.WXDAI.debtV2Address}
                                userAddress={address}
                              />

                              {/* Graphique Supply WXDAI v2 */}
                              <Chart
                                data={prepareChartData(v2WxdaiSupplyDetails, 'supply', 18, dateRange)}
                                title="WXDAI Supply Evolution (v2)"
                                color="#3b82f6"
                                type="area"
                                tokenAddress={TOKENS.WXDAI.supplyV2Address}
                                userAddress={address}
                              />
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}
              
              </>
            )}

            {/* Aucune donnée */}
            {data?.data.results.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
                <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📊</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No data</h2>
                <p className="text-gray-600 dark:text-gray-400">No RMM transaction found for this address</p>
              </div>
            )}

            {/* Tableau des transactions unifié */}
            {(data || dataV2) && prepareAllTransactions(dateRange).length > 0 && (
              <TransactionsTable 
                transactions={prepareAllTransactions(dateRange)}
                userAddress={address}
                title="Transactions"
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setCollapsed(!isCollapsed)}
                selectedTokens={selectedTokens}
                dateRange={dateRange}
              />
            )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Formulaire initial
  return (
    <>
      <Head>
        <title>RMM Analytics</title>
        <meta name="description" content="Analyze your RMM earnings and losses" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 w-full max-w-md">
          {/* En-tête */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
              RMM Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
            Analyze your RMM earnings and losses
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                EVM address
              </label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x3f3994bb23c48204ddeb99aa6bf6dd275abf7a3f"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 dark:text-white dark:bg-gray-700"
              />
            </div>

            <button
              type="submit"
              disabled={!address.trim()}
              className="w-full bg-gray-900 dark:bg-gray-700 text-white py-4 px-6 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Analyze
            </button>
          </form>

          {/* Note */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>Info:</strong> Enter your EVM address to view your RMM transactions and calculate your earnigns/losses
            </p>
          </div>
        </div>
      </div>
    </>
  );
} 