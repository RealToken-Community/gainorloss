const { fetchAllTokenBalancesV2 } = require('./graphql-v2');
//  Importer le service des transactions V2
const { fetchAllTransactionsV2, transformTransactionsV2ToFrontendFormat } = require('./fetch-transactions-v2');
//  Importer le service GnosisScan
const { fetchSupplyTokenTransactionsViaGnosisScan } = require('./gnosisscan');

/**
 * Configuration depuis les variables d'environnement
 * Utilise NEXT_PUBLIC_GNOSIS_RPC_URL comme fallback pour compatibilité avec le .env partagé
 */
const GNOSIS_RPC_URL = process.env.GNOSIS_RPC_URL || process.env.NEXT_PUBLIC_GNOSIS_RPC_URL || 'https://rpc.gnosischain.com/';


const RAY = BigInt(10 ** 27); // 1e27

const { TOKENS } = require('../../utils/constants');


const TOKENS_V2 = {
  rmmWXDAI: {
    address: TOKENS.WXDAI.supplyV2Address,
    symbol: TOKENS.WXDAI.supplyV2Symbol,
    decimals: TOKENS.WXDAI.decimals
  },
  debtWXDAI: {
    address: TOKENS.WXDAI.debtV2Address,
    symbol: TOKENS.WXDAI.debtV2Symbol,
    decimals: TOKENS.WXDAI.decimals
  }
};

/**
 * Récupère le balanceOf actuel via RPC pour la V2
 */
async function getCurrentBalancesV2(userAddress) {
  try {

    // Préparer les appels balanceOf pour les tokens V2
    const calls = Object.entries(TOKENS_V2).map(([key, token], index) => ({
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

    console.log(` Multicall RPC V2: ${calls.length} tokens`);

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
    const balances = {};
    Object.entries(TOKENS_V2).forEach(([key, token], index) => {
      const result = data[index];

      if (result && result.result) {
        const hexBalance = result.result;
        const decimalBalance = parseInt(hexBalance, 16).toString();

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
    console.error('❌ Erreur lors de la récupération des balances RPC V2:', error);
    return null;
  }
}

/**
 * Calcule les intérêts pour les supply tokens V2 (rmmWXDAI uniquement)
 */
function calculateSupplyInterestFromBalancesV2(atokenBalances) {
  console.log(`💰 Calcul des intérêts de supply V2 pour WXDAI via TheGraph`);

  if (!atokenBalances || atokenBalances.length === 0) {
    return createEmptyResultV2('supply');
  }

  // Filtrer seulement rmmWXDAI
  const tokenBalances = atokenBalances.filter(balance =>
    balance.userReserve.reserve.symbol === 'rmmWXDAI'
  );

  if (tokenBalances.length === 0) {
    return createEmptyResultV2('supply');
  }

  console.log(`📊 ${tokenBalances.length} balances atoken V2 trouvées pour WXDAI`);

  // Trier par timestamp et dédupliquer par jour (garder le dernier)
  const sortedBalances = tokenBalances.sort((a, b) => a.timestamp - b.timestamp);
  const balancesByDay = new Map();

  sortedBalances.forEach(balance => {
    const dateKey = formatDateYYYYMMDD(balance.timestamp);
    balancesByDay.set(dateKey, balance); // Le dernier écrase le précédent
  });

  const dailyBalances = Array.from(balancesByDay.values())
    .sort((a, b) => a.timestamp - b.timestamp);

  console.log(`📅 ${dailyBalances.length} jours uniques trouvés (après déduplication)`);

  // Traiter chaque jour
  const dailyDetails = [];
  let totalInterest = 0n;
  let currentSupply = 0n;
  let totalSupplies = 0n;
  let totalWithdraws = 0n;

  for (let i = 0; i < dailyBalances.length; i++) {
    const currentBalance = dailyBalances[i];
    const currentATokenBalance = BigInt(currentBalance.currentATokenBalance);
    const scaledATokenBalance = BigInt(currentBalance.scaledATokenBalance);
    const currentIndex = BigInt(currentBalance.index);

    let dayTotalInterest = 0n;
    let daySupply = 0n;
    let dayWithdraw = 0n;

    if (i === 0) {
      // Premier jour = pas d'intérêts générés
      dayTotalInterest = 0n;
    } else {
      // Jour suivant : comparer avec le jour précédent
      const previousBalance = dailyBalances[i - 1];
      const previousATokenBalance = BigInt(previousBalance.currentATokenBalance);
      const previousScaledATokenBalance = BigInt(previousBalance.scaledATokenBalance);
      const previousIndex = BigInt(previousBalance.index);

      //  Identifier le type de mouvement avec conversion en sous-jacent
      if (scaledATokenBalance > previousScaledATokenBalance) {
        // Supply : scaled a augmenté
        const deltaScaled = scaledATokenBalance - previousScaledATokenBalance;
        //  Convertir en sous-jacent avec l'index courant
        const supplyAmountWei = (deltaScaled * currentIndex) / RAY;
        daySupply = supplyAmountWei;
        totalSupplies += supplyAmountWei;
      } else if (scaledATokenBalance < previousScaledATokenBalance) {
        // Withdraw : scaled a diminué
        const deltaScaled = previousScaledATokenBalance - scaledATokenBalance;
        //  Convertir en sous-jacent avec l'index courant
        const withdrawAmountWei = (deltaScaled * currentIndex) / RAY;
        dayWithdraw = withdrawAmountWei;
        totalWithdraws += withdrawAmountWei;
      }

      //  Calculer les intérêts générés avec la vraie formule RMM
      // Intérêts = (scaled précédent * (index actuel - index précédent)) / RAY
      const periodInterest = (previousScaledATokenBalance * (currentIndex - previousIndex)) / RAY;

      if (periodInterest > 0n) {
        dayTotalInterest = periodInterest;
      }
    }

    // Créer le détail journalier
    const dailyDetail = {
      date: formatDateYYYYMMDD(currentBalance.timestamp),
      timestamp: currentBalance.timestamp,
      supply: currentATokenBalance.toString(),
      periodInterest: dayTotalInterest.toString(),
      totalInterest: (totalInterest + dayTotalInterest).toString(),
      transactionAmount: daySupply > 0n ? daySupply.toString() : (dayWithdraw > 0n ? dayWithdraw.toString() : "0"),
      transactionType: daySupply > 0n ? 'supply' : (dayWithdraw > 0n ? 'withdraw' : 'none'),
      source: "real"
    };

    dailyDetails.push(dailyDetail);
    totalInterest += dayTotalInterest;
    currentSupply = currentATokenBalance;
  }

  console.log(`✅ Calcul V2 terminé: ${dailyDetails.length} jours, total des intérêts: ${Number(totalInterest)} WXDAI`);

  return {
    totalInterest: totalInterest.toString(),
    dailyDetails,
    summary: {
      totalSupplies: totalSupplies.toString(),
      totalWithdraws: totalWithdraws.toString(),
      currentSupply: currentSupply.toString(),
      totalInterest: totalInterest.toString()
    }
  };
}

/**
 * Calcule les intérêts pour les debt tokens V2 (debtWXDAI uniquement)
 */
function calculateDebtInterestFromBalancesV2(vtokenBalances) {
  console.log(`💰 Calcul des intérêts de dette V2 pour WXDAI via TheGraph`);

  if (!vtokenBalances || vtokenBalances.length === 0) {
    return createEmptyResultV2('debt');
  }

  // Filtrer seulement rmmWXDAI
  const tokenBalances = vtokenBalances.filter(balance =>
    balance.userReserve.reserve.symbol === 'rmmWXDAI'
  );

  if (tokenBalances.length === 0) {
    return createEmptyResultV2('debt');
  }

  console.log(`📊 ${tokenBalances.length} balances vtoken V2 trouvées pour WXDAI`);

  // Trier par timestamp et dédupliquer par jour (garder le dernier)
  const sortedBalances = tokenBalances.sort((a, b) => a.timestamp - b.timestamp);
  const balancesByDay = new Map();

  sortedBalances.forEach(balance => {
    const dateKey = formatDateYYYYMMDD(balance.timestamp);
    balancesByDay.set(dateKey, balance); // Le dernier écrase le précédent
  });

  const dailyBalances = Array.from(balancesByDay.values())
    .sort((a, b) => a.timestamp - b.timestamp);

  // Traiter chaque jour
  const dailyDetails = [];
  let totalInterest = 0n;
  let currentDebt = 0n;
  let totalBorrows = 0n;
  let totalRepays = 0n;

  for (let i = 0; i < dailyBalances.length; i++) {
    const currentBalance = dailyBalances[i];
    const currentVariableDebt = BigInt(currentBalance.currentVariableDebt);
    const scaledVariableDebt = BigInt(currentBalance.scaledVariableDebt);
    const currentIndex = BigInt(currentBalance.index);

    let dayTotalInterest = 0n;
    let dayBorrow = 0n;
    let dayRepay = 0n;

    if (i === 0) {
      //  Premier jour = pas d'intérêts générés
      dayTotalInterest = 0n;

      // Identifier le type de mouvement (premier point)
      if (currentVariableDebt > currentDebt) {
        const borrowAmount = currentVariableDebt - currentDebt;
        dayBorrow += borrowAmount;
        totalBorrows += borrowAmount;
      } else if (currentVariableDebt < currentDebt) {
        const repayAmount = currentDebt - currentVariableDebt;
        dayRepay += repayAmount;
        totalRepays += repayAmount;
      }
    } else {
      // Balance suivante
      const previousBalance = dailyBalances[i - 1];
      const previousVariableDebt = BigInt(previousBalance.currentVariableDebt);
      const previousScaledVariableDebt = BigInt(previousBalance.scaledVariableDebt);
      const previousIndex = BigInt(previousBalance.index);

      //  Identifier le type de mouvement avec conversion en sous-jacent
      if (scaledVariableDebt > previousScaledVariableDebt) {
        // Borrow : scaled a augmenté
        const deltaScaled = scaledVariableDebt - previousScaledVariableDebt;
        //  Convertir en sous-jacent avec l'index courant
        const borrowAmountWei = (deltaScaled * currentIndex) / RAY;
        dayBorrow += borrowAmountWei;
        totalBorrows += borrowAmountWei;
      } else if (scaledVariableDebt < previousScaledVariableDebt) {
        // Repay : scaled a diminué
        const deltaScaled = previousScaledVariableDebt - scaledVariableDebt;
        // Convertir en sous-jacent avec l'index courant
        const repayAmountWei = (deltaScaled * currentIndex) / RAY;
        dayRepay += repayAmountWei;
        totalRepays += repayAmountWei;
      }

      // Calculer les intérêts générés avec la vraie formule RMM
      // Intérêts = (scaled précédent * (index actuel - index précédent)) / RAY
      const periodInterest = (previousScaledVariableDebt * (currentIndex - previousIndex)) / RAY;

      if (periodInterest > 0n) {
        dayTotalInterest = periodInterest;
      }
    }

    // Créer le détail journalier
    const dailyDetail = {
      date: formatDateYYYYMMDD(currentBalance.timestamp),
      timestamp: currentBalance.timestamp,
      debt: currentVariableDebt.toString(),
      periodInterest: dayTotalInterest.toString(),
      totalInterest: (totalInterest + dayTotalInterest).toString(),
      transactionAmount: dayBorrow > 0n ? dayBorrow.toString() : (dayRepay > 0n ? dayRepay.toString() : "0"),
      transactionType: dayBorrow > 0n ? 'borrow' : (dayRepay > 0n ? 'repay' : 'none'),
      source: "real"
    };

    dailyDetails.push(dailyDetail);
    totalInterest += dayTotalInterest;
    currentDebt = currentVariableDebt;
  }

  console.log(`✅ Calcul V2 terminé: ${dailyDetails.length} jours, total des intérêts: ${Number(totalInterest)} WXDAI`);

  return {
    totalInterest: totalInterest.toString(),
    dailyDetails,
    summary: {
      totalBorrows: totalBorrows.toString(),
      totalRepays: totalRepays.toString(),
      currentDebt: currentDebt.toString(),
      totalInterest: totalInterest.toString()
    }
  };
}

async function retrieveInterestAndTransactionsForAllTokensV2(userAddress, req = null) {
  console.log(`🚀 Calcul des intérêts V2 pour WXDAI via TheGraph`);

  try {
    // Récupérer tous les balances depuis TheGraph V2
    const allBalances = await fetchAllTokenBalancesV2(userAddress, req);

    // Récupérer les transactions V2 pour le frontend
    const allTransactions = await fetchAllTransactionsV2(userAddress);

    // Récupérer les transactions GnosisScan V2
    const gnosisTransactions = await fetchSupplyTokenTransactionsViaGnosisScan(userAddress, allTransactions, 'V2', req);

    // Transformer en format frontend (avec GnosisScan)
    const frontendTransactions = transformTransactionsV2ToFrontendFormat(allTransactions, gnosisTransactions);

    // Récupérer les balances actuels via RPC
    const currentBalances = await getCurrentBalancesV2(userAddress);

    // Calculer les intérêts d'emprunt
    const borrowInterest = calculateDebtInterestFromBalancesV2(allBalances.vtoken);

    // Calculer les intérêts de dépôt
    const supplyInterest = calculateSupplyInterestFromBalancesV2(allBalances.atoken);

    // Ajouter le point "aujourd'hui" si il y a des données historiques
    if (borrowInterest.dailyDetails.length > 0 && currentBalances) {
      const currentDebtBalance = currentBalances.debtWXDAI?.balance || "0";

      // Ajouter le point d'aujourd'hui
      addTodayPointV2(borrowInterest.dailyDetails, currentDebtBalance, 'debt');

      // Calculer les intérêts du dernier point
      const lastPointIndex = borrowInterest.dailyDetails.length - 1;
      borrowInterest.dailyDetails[lastPointIndex] = calculateLastPointInterestV2(
        borrowInterest.dailyDetails[lastPointIndex],
        currentDebtBalance,
        'debt'
      );
    }

    if (supplyInterest.dailyDetails.length > 0 && currentBalances) {
      const currentSupplyBalance = currentBalances.rmmWXDAI?.balance || "0";

      // Ajouter le point d'aujourd'hui
      addTodayPointV2(supplyInterest.dailyDetails, currentSupplyBalance, 'supply');


      const lastPointIndex = supplyInterest.dailyDetails.length - 1;
      supplyInterest.dailyDetails[lastPointIndex] = calculateLastPointInterestV2(
        supplyInterest.dailyDetails[lastPointIndex],
        currentSupplyBalance,
        'supply'
      );
    }

    // Créer un relevé journalier combiné
    const dailyStatement = createDailyStatementV2(borrowInterest.dailyDetails, supplyInterest.dailyDetails);

    return {
      token: 'WXDAI',
      borrow: borrowInterest,
      supply: supplyInterest,
      dailyStatement: dailyStatement,
      transactions: frontendTransactions,
      summary: {
        totalBorrowInterest: borrowInterest.totalInterest,
        totalSupplyInterest: supplyInterest.totalInterest,
        netInterest: (BigInt(supplyInterest.totalInterest) - BigInt(borrowInterest.totalInterest)).toString()
      }
    };

  } catch (error) {

    console.error(`❌ Erreur lors du calcul des intérêts V2 TheGraph:`, error);
    throw error;
  }
}

/**
 * Crée un relevé journalier combiné V2 au format YYYYMMDD
 */
function createDailyStatementV2(borrowDetails, supplyDetails) {
  console.log(`📊 Création du relevé journalier V2 pour WXDAI`);

  // Combiner tous les détails journaliers
  const allDailyDetails = [];

  // Ajouter les détails d'emprunt
  borrowDetails.forEach(detail => {
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
  supplyDetails.forEach(detail => {
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
  const dailyStatement = {};

  allDailyDetails.forEach(detail => {
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
  const statementArray = Object.values(dailyStatement).sort((a, b) => a.timestamp - b.timestamp);

  console.log(`📊 Relevé journalier V2 créé: ${statementArray.length} jours pour WXDAI`);

  return statementArray;
}

/**
 * Ajoute un point "aujourd'hui" aux dailyDetails V2
 */
function addTodayPointV2(dailyDetails, currentBalance, balanceType) {
  if (dailyDetails.length === 0) return dailyDetails;

  // Récupérer le dernier point pour avoir le totalInterest
  const lastPoint = dailyDetails[dailyDetails.length - 1];

  // Créer le point d'aujourd'hui
  const today = new Date();
  const todayDate = formatDateYYYYMMDD(Math.floor(today.getTime() / 1000));
  const todayTimestamp = Math.floor(today.getTime() / 1000);

  const todayPoint = {
    date: todayDate,
    timestamp: todayTimestamp,
    [balanceType]: currentBalance, 
    periodInterest: "0", 
    totalInterest: lastPoint.totalInterest,
    transactionAmount: "0", 
    transactionType: "BalanceOf",
    source: "real"
  };

  // Ajouter le point d'aujourd'hui
  dailyDetails.push(todayPoint);

  return dailyDetails;
}

/**
 *  Calcule les intérêts du dernier point avec le balanceOf actuel V2
 */
function calculateLastPointInterestV2(lastPoint, currentBalance, balanceType) {
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
    source: "rpc" 
  };

  return updatedLastPoint;
}

/**
 * Crée un résultat vide pour les cas sans données V2
 */
function createEmptyResultV2(type) {
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
function formatDateYYYYMMDD(timestamp) {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

module.exports = {
  retrieveInterestAndTransactionsForAllTokensV2,
  calculateSupplyInterestFromBalancesV2,
  calculateDebtInterestFromBalancesV2,
  createDailyStatementV2
};
