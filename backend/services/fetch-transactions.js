// Configuration TheGraph V3
const THEGRAPH_URL_V3 = 'https://api.thegraph.com/subgraphs/id/QmVH7ota6caVV2ceLY91KYYh6BJs2zeMScTTYgKDpt7VRg';
// Utilise NEXT_PUBLIC_THEGRAPH_API_KEY comme fallback pour compatibilité avec le .env partagé
const API_KEY = process.env.THEGRAPH_API_KEY || process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;

// Client GraphQL (utilise un import dynamique pour ES modules)
let client = null;
async function getClient() {
  if (!client) {
    const { GraphQLClient } = await import('graphql-request');
    client = new GraphQLClient(THEGRAPH_URL_V3, {
      headers: {
        ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
      }
    });
  }
  return client;
}

/**
 * Génère dynamiquement la requête GraphQL en fonction des types de transactions à récupérer
 * @param {Object} typesToFetch - Objet avec les flags pour chaque type { borrows, supplies, withdraws, repays }
 * @returns {string} - Requête GraphQL
 */
function buildTransactionsQueryV3(typesToFetch) {
  const queryParts = [];
  
  if (typesToFetch.borrows) {
    queryParts.push(`
    borrows: borrows(
      first: $first
      skip: $skipBorrows
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      reserve { 
        id
        symbol
        decimals
      }
      amount
      timestamp
    }`);
  }
  
  if (typesToFetch.supplies) {
    queryParts.push(`
    supplies: supplies(
      first: $first
      skip: $skipSupplies
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      reserve { 
        id
        symbol
        decimals
      }
      amount
      timestamp
    }`);
  }
  
  if (typesToFetch.withdraws) {
    queryParts.push(`
    withdraws: redeemUnderlyings(
      first: $first
      skip: $skipWithdraws
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      reserve { 
        id
        symbol
        decimals
      }
      amount
      timestamp
    }`);
  }
  
  if (typesToFetch.repays) {
    queryParts.push(`
    repays: repays(
      first: $first
      skip: $skipRepays
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      reserve { 
        id
        symbol
        decimals
      }
      amount
      timestamp
    }`);
  }
  
  return `
  query GetTransactionsV3(
    $userAddress: String!
    $first: Int!
    $skipBorrows: Int!
    $skipSupplies: Int!
    $skipWithdraws: Int!
    $skipRepays: Int!
  ) {
    ${queryParts.join('\n')}
  }
`;
}

/**
 * Récupère toutes les transactions V3 d'une adresse avec pagination
 * Utilise une pagination indépendante pour chaque type de transaction
 * @param {string} userAddress - Adresse de l'utilisateur
 * @param {boolean} debug - Si true, affiche les logs détaillés (défaut: false)
 */
async function fetchAllTransactionsV3(userAddress, debug = false) {
  const LIMIT = 1000;
  const allTransactions = {
    borrows: [],
    supplies: [],
    withdraws: [],
    repays: []
  };
  
  // Skip séparé pour chaque type de transaction
  const skip = {
    borrows: 0,
    supplies: 0,
    withdraws: 0,
    repays: 0
  };
  
  // Flags pour indiquer si chaque type a atteint sa limite
  const limitReached = {
    borrows: false,
    supplies: false,
    withdraws: false,
    repays: false
  };

  try {
    if (debug) {
      console.log(`🚀 Début de la récupération des transactions V3 pour ${userAddress}`);
    }
    let batchNumber = 0;

    // Continuer tant qu'au moins un type n'a pas atteint sa limite
    while (!limitReached.borrows || !limitReached.supplies || !limitReached.withdraws || !limitReached.repays) {
      batchNumber++;
      
      // Déterminer quels types doivent être récupérés
      const typesToFetch = {
        borrows: !limitReached.borrows,
        supplies: !limitReached.supplies,
        withdraws: !limitReached.withdraws,
        repays: !limitReached.repays
      };
      
      // Générer la requête dynamiquement
      const query = buildTransactionsQueryV3(typesToFetch);
      
      // Préparer les variables pour la requête
      const variables = {
        userAddress: userAddress.toLowerCase(),
        first: LIMIT,
        skipBorrows: skip.borrows,
        skipSupplies: skip.supplies,
        skipWithdraws: skip.withdraws,
        skipRepays: skip.repays
      };

      const graphqlClient = await getClient();
      const data = await graphqlClient.request(query, variables);

      const validSymbols = ['USDC', 'WXDAI'];

      // Traiter chaque type de transaction
      if (typesToFetch.borrows && data.borrows) {
        const filteredBorrows = (data.borrows || []).filter(tx =>
          validSymbols.includes(tx.reserve?.symbol)
        );
        allTransactions.borrows.push(...filteredBorrows);
        
        // Si on a reçu moins que la limite, on a atteint la fin
        if (data.borrows.length < LIMIT) {
          limitReached.borrows = true;
        } else {
          skip.borrows += LIMIT;
        }
      }

      if (typesToFetch.supplies && data.supplies) {
        const filteredSupplies = (data.supplies || []).filter(tx =>
          validSymbols.includes(tx.reserve?.symbol)
        );
        allTransactions.supplies.push(...filteredSupplies);
        
        if (data.supplies.length < LIMIT) {
          limitReached.supplies = true;
        } else {
          skip.supplies += LIMIT;
        }
      }

      if (typesToFetch.withdraws && data.withdraws) {
        const filteredWithdraws = (data.withdraws || []).filter(tx =>
          validSymbols.includes(tx.reserve?.symbol)
        );
        allTransactions.withdraws.push(...filteredWithdraws);
        
        if (data.withdraws.length < LIMIT) {
          limitReached.withdraws = true;
        } else {
          skip.withdraws += LIMIT;
        }
      }

      if (typesToFetch.repays && data.repays) {
        const filteredRepays = (data.repays || []).filter(tx =>
          validSymbols.includes(tx.reserve?.symbol)
        );
        allTransactions.repays.push(...filteredRepays);
        
        if (data.repays.length < LIMIT) {
          limitReached.repays = true;
        } else {
          skip.repays += LIMIT;
        }
      }

      // Logs détaillés uniquement en mode debug
      if (debug) {
        const activeTypes = Object.entries(typesToFetch)
          .filter(([_, active]) => active)
          .map(([type, _]) => type)
          .join(', ');
        
        console.log(`\n📦 Batch #${batchNumber} (types: ${activeTypes}):`);
        if (typesToFetch.borrows) {
          console.log(`   borrows: ${data.borrows?.length || 0} → total: ${allTransactions.borrows.length} ${limitReached.borrows ? '(terminé)' : ''}`);
        }
        if (typesToFetch.supplies) {
          console.log(`   supplies: ${data.supplies?.length || 0} → total: ${allTransactions.supplies.length} ${limitReached.supplies ? '(terminé)' : ''}`);
        }
        if (typesToFetch.withdraws) {
          console.log(`   withdraws: ${data.withdraws?.length || 0} → total: ${allTransactions.withdraws.length} ${limitReached.withdraws ? '(terminé)' : ''}`);
        }
        if (typesToFetch.repays) {
          console.log(`   repays: ${data.repays?.length || 0} → total: ${allTransactions.repays.length} ${limitReached.repays ? '(terminé)' : ''}`);
        }
      }
    }

    const totalTransactions = allTransactions.borrows.length + allTransactions.supplies.length +
      allTransactions.withdraws.length + allTransactions.repays.length;

    // Logs finaux récapitulatifs uniquement en mode debug
    if (debug) {
      console.log(`\n✅ Récupération terminée !`);
      console.log(`📊 Résumé final:`);
      console.log(`   borrows: ${allTransactions.borrows.length}`);
      console.log(`   supplies: ${allTransactions.supplies.length}`);
      console.log(`   withdraws: ${allTransactions.withdraws.length}`);
      console.log(`   repays: ${allTransactions.repays.length}`);
      console.log(`   TOTAL: ${totalTransactions} transactions\n`);
    }

    return allTransactions;

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des transactions V3:', error);
    throw error;
  }
}

/**
 * Extrait le txHash depuis l'id TheGraph
 * Format: "32350433:4:0x4d1c2ad0bf1b47500ddbab4640230f8c05a920b5282816ea256d8bb315e1b9e6:14:14"
 * Le txHash est entre le 2ème et 3ème ":"
 */
function extractTxHashFromId(id) {
  if (!id || typeof id !== 'string') return null;

  const parts = id.split(':');
  if (parts.length >= 3) {
    return parts[2];
  }

  return null;
}

/**
 * Transforme les transactions V3 en format compatible frontend
 */
function transformTransactionsV3ToFrontendFormat(transactions, gnosisTransactions = null) {
  const frontendTransactions = {
    USDC: { debt: [], supply: [] },
    WXDAI: { debt: [], supply: [] }
  };

  // Fonction helper pour déterminer le token
  function getTokenFromReserve(reserve) {
    if (!reserve || !reserve.symbol) return 'WXDAI';
    return reserve.symbol === 'USDC' ? 'USDC' : 'WXDAI';
  }

  // Traiter les borrows (debt)
  transactions.borrows.forEach(tx => {
    const token = getTokenFromReserve(tx.reserve);
    const txHash = extractTxHashFromId(tx.id);

    if (txHash) {
      frontendTransactions[token].debt.push({
        txHash: txHash,
        amount: tx.amount,
        timestamp: tx.timestamp,
        type: 'borrow',
        token: token,
        version: 'V3'
      });
    }
  });

  // Traiter les repays (debt)
  transactions.repays.forEach(tx => {
    const token = getTokenFromReserve(tx.reserve);
    const txHash = extractTxHashFromId(tx.id);

    if (txHash) {
      frontendTransactions[token].debt.push({
        txHash: txHash,
        amount: tx.amount,
        timestamp: tx.timestamp,
        type: 'repay',
        token: token,
        version: 'V3'
      });
    }
  });

  // Traiter les supplies (supply)
  transactions.supplies.forEach(tx => {
    const token = getTokenFromReserve(tx.reserve);
    const txHash = extractTxHashFromId(tx.id);

    if (txHash) {
      frontendTransactions[token].supply.push({
        txHash: txHash,
        amount: tx.amount,
        timestamp: tx.timestamp,
        type: 'deposit',
        token: token,
        version: 'V3'
      });
    }
  });

  // Traiter les withdraws (supply)
  transactions.withdraws.forEach(tx => {
    const token = getTokenFromReserve(tx.reserve);
    const txHash = extractTxHashFromId(tx.id);

    if (txHash) {
      frontendTransactions[token].supply.push({
        txHash: txHash,
        amount: tx.amount,
        timestamp: tx.timestamp,
        type: 'withdraw',
        token: token,
        version: 'V3'
      });
    }
  });

  console.log(`🔄 Transactions V3 transformées: ${frontendTransactions.USDC.debt.length + frontendTransactions.USDC.supply.length} USDC, ${frontendTransactions.WXDAI.debt.length + frontendTransactions.WXDAI.supply.length} WXDAI`);


  if (gnosisTransactions) {
    Object.keys(gnosisTransactions).forEach(tokenSymbol => {
      const gnosisTxs = gnosisTransactions[tokenSymbol] || [];

      if (gnosisTxs.length > 0) {

        frontendTransactions[tokenSymbol].supply.push(...gnosisTxs);

        console.log(`➕ ${gnosisTxs.length} transactions GnosisScan ajoutées pour ${tokenSymbol}`);
      }
    });

    //Trier toutes les transactions supply par timestamp (plus vieux → plus récent)
    Object.keys(frontendTransactions).forEach(tokenSymbol => {
      frontendTransactions[tokenSymbol].supply.sort((a, b) => a.timestamp - b.timestamp);
    });
  }

  return frontendTransactions;
}

module.exports = {
  fetchAllTransactionsV3,
  transformTransactionsV3ToFrontendFormat,
  extractTxHashFromId
};
