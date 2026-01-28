import { fetchAllTokenBalances } from './graphql';
import { fetchSupplyTokenTransactionsViaGnosisScan } from './gnosisscan';
import { fetchAllTransactionsV3, transformTransactionsV3ToFrontendFormat } from './fetch-transactions';
import logger from '../../utils/logger';

/**
 * Configuration depuis les variables d'environnement
 * Utilise NEXT_PUBLIC_GNOSIS_RPC_URL comme fallback pour compatibilité avec le .env partagé
 */
const GNOSIS_RPC_URL = process.env.GNOSIS_RPC_URL || process.env.NEXT_PUBLIC_GNOSIS_RPC_URL || 'https://rpc.gnosischain.com/';
const RAY = BigInt(10 ** 27);
import { TOKENS } from '../../utils/constants';


const TOKENS_V3 = {
  armmUSDC: {
    address: TOKENS.USDC.supplyAddress,
    symbol: TOKENS.USDC.supplySymbol,
    decimals: TOKENS.USDC.decimals
  },
  armmWXDAI: {
    address: TOKENS.WXDAI.supplyAddress,
    symbol: TOKENS.WXDAI.supplySymbol,
    decimals: TOKENS.WXDAI.decimals
  },
  debtUSDC: {
    address: TOKENS.USDC.debtAddress,
    symbol: TOKENS.USDC.debtSymbol,
    decimals: TOKENS.USDC.decimals
  },
  debtWXDAI: {
    address: TOKENS.WXDAI.debtAddress,
    symbol: TOKENS.WXDAI.debtSymbol,
    decimals: TOKENS.WXDAI.decimals
  }
};

/**
 * Récupère le balanceOf actuel via RPC
 */
async function getCurrentBalances(userAddress: string): Promise<any> {
  try {

    // Préparer les appels balanceOf pour tous les tokens
    const calls = Object.entries(TOKENS_V3).map(([key, token]: [string, any], index: number) => ({
      jsonrpc: "2.0",
      id: index + 1,
      method: "eth_call",
      params: [
        {
          to: token.address,
          data: `0x70a08231000000000000000000000000${userAddress.toLowerCase().slice(2)}`
        },
        "latest"
      ]
    }));

    logger.debug(`Multicall RPC: ${calls.length} tokens`);

    const response = await fetch(GNOSIS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calls)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Réponse RPC invalide');
    }

    // Traiter les résultats
    const balances: Record<string, any> = {};
    Object.entries(TOKENS_V3).forEach(([key, token]: [string, any], index: number) => {
      const result = data[index];

      if (result && result.result) {
        const hexBalance = result.result;
        const decimalBalance = BigInt(hexBalance).toString();

        balances[key] = {
          token: token.address,
          symbol: token.symbol,
          balance: decimalBalance,
          decimals: token.decimals
        };
      } else {
        balances[key] = {
          token: token.address,
          symbol: token.symbol,
          balance: '0',
          decimals: token.decimals
        };
      }
    });

    return balances;

  } catch (error) {
    logger.error('Erreur lors de la récupération des balances RPC:', error);
    return null;
  }
}

/**
 * Logique de calcul interne factorisée pour supply et debt
 */
function calculateInterestInternal(
  balances: any[],
  token: string,
  config: {
    type: 'supply' | 'debt',
    balanceField: string,
    scaledBalanceField: string,
    increaseLabel: string,
    decreaseLabel: string
  }
): any {
  const { type, balanceField, scaledBalanceField, increaseLabel, decreaseLabel } = config;
  logger.info(`Calcul des intérêts de ${type} pour ${token} via TheGraph (Factorisé)`);

  if (!balances || balances.length === 0) {
    return createEmptyResult(type);
  }

  // Filtrer seulement le token demandé
  const tokenBalances = balances.filter((balance: any) =>
    balance.userReserve.reserve.symbol === token
  );

  if (tokenBalances.length === 0) {
    return createEmptyResult(type);
  }

  // Trier par timestamp et dédupliquer par jour (garder le dernier)
  const sortedBalances = tokenBalances.sort((a: any, b: any) => a.timestamp - b.timestamp);
  const balancesByDay = new Map<string, any>();

  sortedBalances.forEach((balance: any) => {
    const dateKey = formatDateYYYYMMDD(balance.timestamp);
    balancesByDay.set(dateKey, balance);
  });

  const periodBalances = Array.from(balancesByDay.values())
    .sort((a: any, b: any) => a.timestamp - b.timestamp);

  // Traiter chaque jour
  const dailyDetails: any[] = [];
  let totalInterest = 0n;
  let currentBalanceWeiValue = 0n;
  let totalIncreases = 0n;
  let totalDecreases = 0n;

  for (let i = 0; i < periodBalances.length; i++) {
    const currentPoint = periodBalances[i];
    const currentBalance = BigInt(currentPoint[balanceField]);
    const scaledBalance = BigInt(currentPoint[scaledBalanceField]);
    const currentIndex = BigInt(currentPoint.index);

    let dayTotalInterest = 0n;
    let dayIncrease = 0n;
    let dayDecrease = 0n;

    if (i === 0) {
      dayTotalInterest = 0n;
      // Si une balance existe au premier snapshot, on la considère comme un mouvement initial
      if (currentBalance > 0n) {
        dayIncrease = currentBalance;
        totalIncreases += currentBalance;
      }
    } else {
      const previousPoint: any = periodBalances[i - 1];
      const previousScaledBalance = BigInt(previousPoint[scaledBalanceField]);
      const previousIndex = BigInt(previousPoint.index);

      // Identifier le type de mouvement
      if (scaledBalance > previousScaledBalance) {
        const deltaScaled = scaledBalance - previousScaledBalance;
        const increaseAmountWei = (deltaScaled * currentIndex) / RAY;
        dayIncrease = increaseAmountWei;
        totalIncreases += increaseAmountWei;
      } else if (scaledBalance < previousScaledBalance) {
        const deltaScaled = previousScaledBalance - scaledBalance;
        const decreaseAmountWei = (deltaScaled * currentIndex) / RAY;
        dayDecrease = decreaseAmountWei;
        totalDecreases += decreaseAmountWei;
      }

      // Intérêts = (scaled précédent * (index actuel - index précédent)) / RAY
      const periodInterest = (previousScaledBalance * (currentIndex - previousIndex)) / RAY;

      if (periodInterest > 0n) {
        dayTotalInterest = periodInterest;
      }
    }

    // Détail journalier
    dailyDetails.push({
      date: formatDateYYYYMMDD(currentPoint.timestamp),
      timestamp: currentPoint.timestamp,
      [type]: currentBalance.toString(),
      periodInterest: dayTotalInterest.toString(),
      totalInterest: (totalInterest + dayTotalInterest).toString(),
      transactionAmount: dayIncrease > 0n ? dayIncrease.toString() : (dayDecrease > 0n ? dayDecrease.toString() : "0"),
      transactionType: dayIncrease > 0n ? increaseLabel : (dayDecrease > 0n ? decreaseLabel : 'none'),
      source: "real"
    });

    totalInterest += dayTotalInterest;
    currentBalanceWeiValue = currentBalance;
  }

  // Summary avec clés dynamiques
  const summary: any = {
    totalInterest: totalInterest.toString(),
    totalInterestWei: totalInterest.toString(), // pour compatibilité
  };

  if (type === 'supply') {
    summary.totalSupplies = totalIncreases.toString();
    summary.totalWithdraws = totalDecreases.toString();
    summary.currentSupply = currentBalanceWeiValue.toString();
  } else {
    summary.totalBorrows = totalIncreases.toString();
    summary.totalRepays = totalDecreases.toString();
    summary.currentDebt = currentBalanceWeiValue.toString();
  }

  return {
    totalInterest: totalInterest.toString(),
    dailyDetails,
    summary
  };
}

function calculateSupplyInterestFromBalances(atokenBalances: any[], token: string): any {
  return calculateInterestInternal(atokenBalances, token, {
    type: 'supply',
    balanceField: 'currentATokenBalance',
    scaledBalanceField: 'scaledATokenBalance',
    increaseLabel: 'supply',
    decreaseLabel: 'withdraw'
  });
}

/**
 * Calcule les intérêts pour les debt tokens (vTokens)
 */
function calculateDebtInterestFromBalances(vtokenBalances: any[], token: string): any {
  return calculateInterestInternal(vtokenBalances, token, {
    type: 'debt',
    balanceField: 'currentVariableDebt',
    scaledBalanceField: 'scaledVariableDebt',
    increaseLabel: 'borrow',
    decreaseLabel: 'repay'
  });
}


async function retrieveInterestAndTransactionsForAllTokens(userAddress: string, req: any = null): Promise<any> {

  try {
    logger.info(`Calcul des intérêts V3 pour ${userAddress} via TheGraph`);

    // Récupérer les balances pour les calculs d'intérêts
    const allBalances = await fetchAllTokenBalances(userAddress);

    // 1 the graph + others via gnosisscan 
    const allTransactions = await fetchAllTransactionsV3(userAddress);
    const gnosisTransactions = await fetchSupplyTokenTransactionsViaGnosisScan(userAddress, allTransactions, 'V3', req);

    // 2 transformation unifiée
    const frontendTransactions = transformTransactionsV3ToFrontendFormat(allTransactions, gnosisTransactions);

    // Récupérer les balances actuels via RPC
    const currentBalances = await getCurrentBalances(userAddress);

    // Calculer les intérêts pour chaque token
    const results: Record<string, any> = {};
    const tokens = ['USDC', 'WXDAI'];

    for (const token of tokens) {
      // Calculer les intérêts d'emprunt
      const borrowInterest = calculateDebtInterestFromBalances(allBalances.vtoken, token);

      // Calculer les intérêts de dépôt
      const supplyInterest = calculateSupplyInterestFromBalances(allBalances.atoken, token);

      //  Ajouter le point "aujourd'hui" et calculer les intérêts
      if (borrowInterest.dailyDetails.length > 0 && currentBalances) {
        const currentDebtBalance = currentBalances[`debt${token}`]?.balance || "0";

        // Ajouter le point d'aujourd'hui
        addTodayPoint(borrowInterest.dailyDetails, currentDebtBalance, 'debt', token);

      }

      if (supplyInterest.dailyDetails.length > 0 && currentBalances) {
        const currentSupplyBalance = currentBalances[`armm${token}`]?.balance || "0";

        // Ajouter le point d'aujourd'hui
        addTodayPoint(supplyInterest.dailyDetails, currentSupplyBalance, 'supply', token);

      }

      // Créer un relevé journalier combiné
      const dailyStatement = createDailyStatement(borrowInterest.dailyDetails, supplyInterest.dailyDetails, token);

      results[token] = {
        token,
        borrow: borrowInterest,
        supply: supplyInterest,
        dailyStatement: dailyStatement
      };
    }
    return {
      USDC: {
        token: 'USDC',
        borrow: results.USDC.borrow,
        supply: results.USDC.supply,
        dailyStatement: results.USDC.dailyStatement
      },
      WXDAI: {
        token: 'WXDAI',
        borrow: results.WXDAI.borrow,
        supply: results.WXDAI.supply,
        dailyStatement: results.WXDAI.dailyStatement
      },
      transactions: frontendTransactions
    };

  } catch (error) {
    logger.error(`Erreur lors du calcul des intérêts TheGraph pour tous les tokens:`, error);
    throw error;
  }
}

/**
 * Crée un relevé journalier combiné au format YYYYMMDD
 */
function createDailyStatement(borrowDetails: any[], supplyDetails: any[], token: string): any[] {
  logger.debug(`Création du relevé journalier pour ${token}`);

  // Combiner tous les détails journaliers
  const allDailyDetails: any[] = [];

  // Ajouter les détails d'emprunt
  borrowDetails.forEach((detail: any) => {
    allDailyDetails.push({
      date: detail.date,
      timestamp: detail.timestamp,
      type: 'borrow',
      debt: detail.debt || 0,
      supply: 0,
      periodInterest: detail.periodInterest,
      totalInterest: detail.totalInterest,
      transactionAmount: detail.transactionAmount,
      transactionType: detail.transactionType,
      source: detail.source
    });
  });

  // Ajouter les détails de dépôt
  supplyDetails.forEach((detail: any) => {
    allDailyDetails.push({
      date: detail.date,
      timestamp: detail.timestamp,
      type: 'supply',
      debt: 0,
      supply: detail.supply || 0,
      periodInterest: detail.periodInterest,
      totalInterest: detail.totalInterest,
      transactionAmount: detail.transactionAmount,
      transactionType: detail.transactionType,
      source: detail.source
    });
  });

  // Grouper par date et créer le relevé journalier
  const dailyStatement: Record<string, any> = {};

  allDailyDetails.forEach((detail: any) => {
    const dateKey = detail.date;

    if (!dailyStatement[dateKey]) {
      dailyStatement[dateKey] = {
        date: dateKey,
        timestamp: detail.timestamp,
        debt: 0,
        supply: 0,
        borrowInterest: 0,
        supplyInterest: 0,
        totalInterest: 0,
        transactions: [],
        source: detail.source
      };
    }

    // Mettre à jour les montants
    if (detail.type === 'borrow') {
      dailyStatement[dateKey].debt = detail.debt;
      dailyStatement[dateKey].borrowInterest = detail.periodInterest;
    } else {
      dailyStatement[dateKey].supply = detail.supply;
      dailyStatement[dateKey].supplyInterest = detail.periodInterest;
    }

    dailyStatement[dateKey].totalInterest = dailyStatement[dateKey].borrowInterest + dailyStatement[dateKey].supplyInterest;

    // Ajouter la transaction si elle existe
    if (detail.transactionAmount && detail.transactionAmount !== "0") {
      dailyStatement[dateKey].transactions.push({
        type: detail.transactionType,
        amount: detail.transactionAmount
      });
    }
  });

  // Convertir en tableau et trier par date
  const statementArray = Object.values(dailyStatement).sort((a: any, b: any) => a.timestamp - b.timestamp);

  logger.debug(`Relevé journalier créé: ${statementArray.length} jours pour ${token}`);

  return statementArray;
}

/**
 * Ajoute un point "aujourd'hui" aux dailyDetails avec interpolation des jours manquants
 * Si un point existe déjà pour aujourd'hui, il est remplacé par le balanceOf actuel
 * Les jours manquants entre le dernier snapshot et aujourd'hui sont interpolés linéairement
 * Le point "aujourd'hui" utilise le timestamp exact de la requête pour une interpolation précise
 */
function addTodayPoint(dailyDetails: any[], currentBalance: string, balanceType: string, token: string): any[] {
  if (dailyDetails.length === 0) return dailyDetails as any[];

  // Timestamp exact de la requête (pour le point "aujourd'hui")
  const now = new Date();
  const nowTimestamp = Math.floor(now.getTime() / 1000);

  // Date d'aujourd'hui à minuit (pour les comparaisons de dates)
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const todayDate = formatDateYYYYMMDD(Math.floor(todayMidnight.getTime() / 1000));

  // Trouver le dernier point qui n'est pas aujourd'hui
  let referencePointIndex = dailyDetails.length - 1;
  while (referencePointIndex >= 0 && dailyDetails[referencePointIndex].date === todayDate) {
    referencePointIndex--;
  }

  if (referencePointIndex < 0) {
    // Tous les points sont pour aujourd'hui, on met juste à jour le dernier
    const lastPoint = dailyDetails[dailyDetails.length - 1];
    lastPoint[balanceType] = currentBalance;
    return dailyDetails;
  }

  const referencePoint = dailyDetails[referencePointIndex];
  const referenceBalance = BigInt(referencePoint[balanceType] || 0);
  const referenceTotalInterest = BigInt(referencePoint.totalInterest || 0);

  // Calculer le nombre de jours entre le point de référence et aujourd'hui
  const referenceDate = new Date(
    parseInt(referencePoint.date.substring(0, 4)),
    parseInt(referencePoint.date.substring(4, 6)) - 1,
    parseInt(referencePoint.date.substring(6, 8))
  );
  referenceDate.setHours(0, 0, 0, 0);

  const daysDiff = Math.round((todayMidnight.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculer les intérêts totaux à distribuer
  const totalInterestToDistribute = BigInt(currentBalance) - referenceBalance;

  // Supprimer les points existants après le point de référence (ils seront recréés)
  dailyDetails.splice(referencePointIndex + 1);

  // Si plus d'un jour de différence, interpoler les jours manquants
  if (daysDiff > 1 && totalInterestToDistribute > 0n) {
    const dailyInterest = totalInterestToDistribute / BigInt(daysDiff);
    let accumulatedInterest = referenceTotalInterest;
    let interpolatedBalance = referenceBalance;

    // Créer des points pour chaque jour manquant (sauf aujourd'hui)
    for (let i = 1; i < daysDiff; i++) {
      const interpolatedDate = new Date(referenceDate);
      interpolatedDate.setDate(interpolatedDate.getDate() + i);
      const interpolatedDateStr = formatDateYYYYMMDD(Math.floor(interpolatedDate.getTime() / 1000));

      interpolatedBalance = interpolatedBalance + dailyInterest;
      accumulatedInterest = accumulatedInterest + dailyInterest;

      dailyDetails.push({
        date: interpolatedDateStr,
        timestamp: Math.floor(interpolatedDate.getTime() / 1000),
        [balanceType]: interpolatedBalance.toString(),
        periodInterest: dailyInterest.toString(),
        totalInterest: accumulatedInterest.toString(),
        transactionAmount: "0",
        transactionType: "none",
        source: "interpolated"
      });
    }
  }

  // Calculer les intérêts restants pour aujourd'hui
  const lastPointBeforeToday = dailyDetails[dailyDetails.length - 1];
  const lastBalance = BigInt(lastPointBeforeToday[balanceType] || 0);
  const lastTotalInterest = BigInt(lastPointBeforeToday.totalInterest || 0);

  const todayPeriodInterest = BigInt(currentBalance) - lastBalance;
  const todayTotalInterest = lastTotalInterest + todayPeriodInterest;

  const todayPoint = {
    date: todayDate,
    timestamp: nowTimestamp, // Timestamp exact de la requête, pas minuit
    [balanceType]: currentBalance,
    periodInterest: todayPeriodInterest.toString(),
    totalInterest: todayTotalInterest.toString(),
    transactionAmount: "0",
    transactionType: "BalanceOf",
    source: "real"
  };

  dailyDetails.push(todayPoint);

  return dailyDetails;
}

/**
 * Calcule les intérêts du dernier point avec le balanceOf actuel
 */
function calculateLastPointInterest(lastPoint: any, currentBalance: string, balanceType: string, token: string): any {
  if (!lastPoint || !currentBalance) return lastPoint;

  const currentBalanceWei = BigInt(currentBalance);
  const lastPointBalance = BigInt(lastPoint[balanceType]); // 'supply' ou 'debt'

  // Calculer les intérêts générés depuis le dernier point
  let periodInterest = 0n;

  if (balanceType === 'supply') {
    // Pour les supply tokens, calculer la différence
    const totalIncrease = currentBalanceWei > lastPointBalance ?
      currentBalanceWei - lastPointBalance : 0n;

    // Les mouvements de capital sont déjà dans transactionAmount
    const capitalMovements = BigInt(lastPoint.transactionAmount || '0');

    periodInterest = totalIncrease - capitalMovements;
  } else if (balanceType === 'debt') {
    // Pour les debt tokens, même logique
    const totalIncrease = currentBalanceWei > lastPointBalance ?
      currentBalanceWei - lastPointBalance : 0n;

    const capitalMovements = BigInt(lastPoint.transactionAmount || '0');

    periodInterest = totalIncrease - capitalMovements;
  }

  // Mettre à jour le dernier point
  const updatedLastPoint = {
    ...lastPoint,
    periodInterest: periodInterest.toString(),
    totalInterest: (BigInt(lastPoint.totalInterest) + periodInterest).toString(),
    transactionAmount: "0",
    transactionType: "BalanceOf",
    source: "real"
  };

  return updatedLastPoint;
}

/**
 * Crée un résultat vide pour les cas sans données
 */
function createEmptyResult(type: string): any {
  const emptySummary = type === 'supply'
    ? {
      totalSupplies: "0",
      totalWithdraws: "0",
      currentSupply: "0",
      totalInterest: "0"
    }
    : {
      totalBorrows: "0",
      totalRepays: "0",
      currentDebt: "0",
      totalInterest: "0"
    };

  return {
    totalInterest: "0",
    dailyDetails: [],
    summary: emptySummary
  };
}

/**
 * Formate une date en YYYYMMDD
 */
function formatDateYYYYMMDD(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

export {
  retrieveInterestAndTransactionsForAllTokens,
  calculateSupplyInterestFromBalances,
  calculateDebtInterestFromBalances,
  createDailyStatement
};
