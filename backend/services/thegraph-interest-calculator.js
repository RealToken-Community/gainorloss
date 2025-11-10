const { fetchAllTokenBalances } = require('./graphql');
const { fetchSupplyTokenTransactionsViaGnosisScan } = require('./gnosisscan');
const { fetchAllTransactionsV3, transformTransactionsV3ToFrontendFormat } = require('./fetch-transactions');

/**
 * Configuration depuis les variables d'environnement
 * Utilise NEXT_PUBLIC_GNOSIS_RPC_URL comme fallback pour compatibilité avec le .env partagé
 */
const GNOSIS_RPC_URL = process.env.GNOSIS_RPC_URL || process.env.NEXT_PUBLIC_GNOSIS_RPC_URL || 'https://rpc.gnosischain.com/';
const RAY = BigInt(10 ** 27);
const { TOKENS } = require('../../utils/constants');


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
async function getCurrentBalances(userAddress) {
  try {

    // Préparer les appels balanceOf pour tous les tokens
    const calls = Object.entries(TOKENS_V3).map(([key, token], index) => ({
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
    
    console.log(` Multicall RPC: ${calls.length} tokens`);
    
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
    Object.entries(TOKENS_V3).forEach(([key, token], index) => {
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
    console.error('❌ Erreur lors de la récupération des balances RPC:', error);
    return null;
  }
}

function calculateSupplyInterestFromBalances(atokenBalances, token) {
  console.log(`💰 Calcul des intérêts de supply pour ${token} via TheGraph`);
  
  if (!atokenBalances || atokenBalances.length === 0) {
    return createEmptyResult('supply');
  }

  // Filtrer seulement le token demandé
  const tokenBalances = atokenBalances.filter(balance => 
    balance.userReserve.reserve.symbol === token
  );

  if (tokenBalances.length === 0) {
    return createEmptyResult('supply');
  }




  // Trier par timestamp et dédupliquer par jour (garder le dernier)
  const sortedBalances = tokenBalances.sort((a, b) => a.timestamp - b.timestamp);
  const balancesByDay = new Map();
  
  sortedBalances.forEach(balance => {
    const dateKey = formatDateYYYYMMDD(balance.timestamp);
    balancesByDay.set(dateKey, balance); // Le dernier écrase le précédent
  });

  const periodBalances = Array.from(balancesByDay.values())
    .sort((a, b) => a.timestamp - b.timestamp);

  console.log(`📅 ${periodBalances.length} jours uniques trouvés (après déduplication)`);

  // Traiter chaque jour
  const dailyDetails = [];
  let totalInterest = 0n;
  let currentSupply = 0n;
  let totalSupplies = 0n;
  let totalWithdraws = 0n;

  for (let i = 0; i < periodBalances.length; i++) {
    const currentBalance = periodBalances[i];
    const currentATokenBalance = BigInt(currentBalance.currentATokenBalance);
    const scaledATokenBalance = BigInt(currentBalance.scaledATokenBalance);
    const currentIndex = BigInt(currentBalance.index);
    
    let dayTotalInterest = 0n;
    let daySupply = 0n;
    let dayWithdraw = 0n;
    
    if (i === 0) {
      dayTotalInterest = 0n;
    } else {
      // Jour suivant : comparer avec le jour précédent
      const previousBalance = periodBalances[i - 1];
      const previousATokenBalance = BigInt(previousBalance.currentATokenBalance);
      const previousScaledATokenBalance = BigInt(previousBalance.scaledATokenBalance);
      const previousIndex = BigInt(previousBalance.index);
      
      if (scaledATokenBalance > previousScaledATokenBalance) {
        // Supply : scaled a augmenté
        const deltaScaled = scaledATokenBalance - previousScaledATokenBalance;
        const supplyAmountWei = (deltaScaled * currentIndex) / RAY;
        daySupply = supplyAmountWei;
        totalSupplies += supplyAmountWei;
      } else if (scaledATokenBalance < previousScaledATokenBalance) {
        // Withdraw : scaled a diminué
        const deltaScaled = previousScaledATokenBalance - scaledATokenBalance;
        const withdrawAmountWei = (deltaScaled * currentIndex) / RAY;
        dayWithdraw = withdrawAmountWei;
        totalWithdraws += withdrawAmountWei;
      }
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

  console.log(`✅ Calcul terminé: ${dailyDetails.length} jours, total des intérêts: ${Number(totalInterest)} ${token}`);

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
 * Calcule les intérêts pour les debt tokens (vTokens)
 */
function calculateDebtInterestFromBalances(vtokenBalances, token) {
  console.log(`💰 Calcul des intérêts de dette pour ${token} via TheGraph`);
  
  if (!vtokenBalances || vtokenBalances.length === 0) {
    return createEmptyResult('debt');
  }

  // Filtrer seulement le token demandé
  const tokenBalances = vtokenBalances.filter(balance => 
    balance.userReserve.reserve.symbol === token
  );

  if (tokenBalances.length === 0) {
    return createEmptyResult('debt');
  }

  // Trier par timestamp et dédupliquer par jour (garder le dernier)
  const sortedBalances = tokenBalances.sort((a, b) => a.timestamp - b.timestamp);
  const balancesByDay = new Map();
  
  sortedBalances.forEach(balance => {
    const dateKey = formatDateYYYYMMDD(balance.timestamp);
    balancesByDay.set(dateKey, balance); // Le dernier écrase le précédent
  });

  const periodBalances = Array.from(balancesByDay.values())
    .sort((a, b) => a.timestamp - b.timestamp);

  // Traiter chaque jour
  const dailyDetails = [];
  let totalInterest = 0n;
  let currentDebt = 0n;
  let totalBorrows = 0n;
  let totalRepays = 0n;

  for (let i = 0; i < periodBalances.length; i++) {
    const currentBalance = periodBalances[i];
    const currentVariableDebt = BigInt(currentBalance.currentVariableDebt);
    const scaledVariableDebt = BigInt(currentBalance.scaledVariableDebt);
    const currentIndex = BigInt(currentBalance.index);
    
    let dayTotalInterest = 0n;
    let dayBorrow = 0n;
    let dayRepay = 0n;
    
    if (i === 0) {

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
      const previousBalance = periodBalances[i - 1];
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

  console.log(`✅ Calcul terminé: ${dailyDetails.length} jours, total des intérêts: ${Number(totalInterest)} ${token}`);

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


async function retrieveInterestAndTransactionsForAllTokens(userAddress, req = null) {

  try {
    console.log(`🚀 Calcul des intérêts V3 pour ${userAddress} via TheGraph`);
    
    // Récupérer les balances pour les calculs d'intérêts
    const allBalances = await fetchAllTokenBalances(userAddress, req);
    
    // 1 the graph + others via gnosisscan 
    const allTransactions = await fetchAllTransactionsV3(userAddress);
    const gnosisTransactions = await fetchSupplyTokenTransactionsViaGnosisScan(userAddress, allTransactions, 'V3', req);

    // 2 transformation unifiée
    const frontendTransactions = transformTransactionsV3ToFrontendFormat(allTransactions, gnosisTransactions);
    
    // Récupérer les balances actuels via RPC
    const currentBalances = await getCurrentBalances(userAddress);
    
    // Calculer les intérêts pour chaque token
    const results = {};
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
    console.error(`❌ Erreur lors du calcul des intérêts TheGraph pour tous les tokens:`, error);
    throw error;
  }
}

/**
 * Crée un relevé journalier combiné au format YYYYMMDD
 */
function createDailyStatement(borrowDetails, supplyDetails, token) {
  console.log(`📊 Création du relevé journalier pour ${token}`);
  
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
  
  console.log(`📊 Relevé journalier créé: ${statementArray.length} jours pour ${token}`);
  
  return statementArray;
}

/**
 * Ajoute un point "aujourd'hui" aux dailyDetails
 */
function addTodayPoint(dailyDetails, currentBalance, balanceType, token) {
  if (dailyDetails.length === 0) return dailyDetails;
  
  // Récupérer le dernier point pour avoir le totalInterest
  const lastPoint = dailyDetails[dailyDetails.length - 1];

  const periodInterest = balanceType === 'debt' ? currentBalance - lastPoint.debt : currentBalance - lastPoint.supply;
  const newtotalInterest = BigInt(lastPoint.totalInterest) + BigInt(periodInterest);
  
  // Créer le point d'aujourd'hui
  const today = new Date();
  const todayDate = formatDateYYYYMMDD(Math.floor(today.getTime() / 1000));
  const todayTimestamp = Math.floor(today.getTime() / 1000);

  const todayPoint = {
    date: todayDate,
    timestamp: todayTimestamp,
    [balanceType]: currentBalance, // 'debt' ou 'supply'
    periodInterest: periodInterest.toString(), 
    totalInterest: newtotalInterest.toString(), 
    transactionAmount: "0", 
    transactionType: "BalanceOf",
    source: "real"
  };
  
  // Ajouter le point d'aujourd'hui
  dailyDetails.push(todayPoint);
  
  return dailyDetails;
}

/**
 * Calcule les intérêts du dernier point avec le balanceOf actuel
 */
function calculateLastPointInterest(lastPoint, currentBalance, balanceType, token) {
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
function createEmptyResult(type) {
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
  retrieveInterestAndTransactionsForAllTokens,
  calculateSupplyInterestFromBalances,
  calculateDebtInterestFromBalances,
  createDailyStatement
};
