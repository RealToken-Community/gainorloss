// Configuration TheGraph V3
const THEGRAPH_URL_V3 = 'https://api.thegraph.com/subgraphs/id/QmVH7ota6caVV2ceLY91KYYh6BJs2zeMScTTYgKDpt7VRg';
const API_KEY = process.env.THEGRAPH_API_KEY;

// Client GraphQL (utilise un import dynamique pour ES modules)
let client = null;
async function getClient() {
  if (!client) {
    const { GraphQLClient } = await import('graphql-request');
    client = new GraphQLClient(THEGRAPH_URL_V3, {
      headers: API_KEY ? {
        'Authorization': `Bearer ${API_KEY}`
      } : {}
    });
  }
  return client;
}

// Requête pour récupérer toutes les transactions avec pagination (V3 uniquement)
const TRANSACTIONS_QUERY_V3 = `
  query GetTransactionsV3($userAddress: String!, $first: Int!, $skip: Int!) {
    borrows: borrows(
      first: $first
      skip: $skip
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id           # Seulement l'id, on extrait le txHash
      reserve { 
        id
        symbol
        decimals
      }
      amount
      timestamp
    }
    
    supplies: supplies(
      first: $first
      skip: $skip
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id           # Seulement l'id, on extrait le txHash
      reserve { 
        id
        symbol
        decimals
      }
      amount
      timestamp
    }
    
    withdraws: redeemUnderlyings(
      first: $first
      skip: $skip
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id           # Seulement l'id, on extrait le txHash
      reserve { 
        id
        symbol
        decimals
      }
      amount
      timestamp
    }
    
    repays: repays(
      first: $first
      skip: $skip
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id           # extrait le txHash
      reserve { 
        id
        symbol
        decimals
      }
      amount
      timestamp
    }
  }
`;

/**
 * Récupère toutes les transactions V3 d'une adresse avec pagination
 */
async function fetchAllTransactionsV3(userAddress) {
  const LIMIT = 1000;
  const allTransactions = {
    borrows: [],
    supplies: [],
    withdraws: [],
    repays: []
  };
  let skip = 0;
  let hasMore = true;

  try {

    while (hasMore) {
      const variables = {
        userAddress: userAddress.toLowerCase(),
        first: LIMIT,
        skip: skip
      };

      const graphqlClient = await getClient();
      const data = await graphqlClient.request(TRANSACTIONS_QUERY_V3, variables);

      const validSymbols = ['USDC', 'WXDAI'];

      // Ajouter les transactions filtrées de ce batch
      allTransactions.borrows.push(...(data.borrows || []).filter(tx =>
        validSymbols.includes(tx.reserve?.symbol)
      ));

      allTransactions.supplies.push(...(data.supplies || []).filter(tx =>
        validSymbols.includes(tx.reserve?.symbol)
      ));

      allTransactions.withdraws.push(...(data.withdraws || []).filter(tx =>
        validSymbols.includes(tx.reserve?.symbol)
      ));

      allTransactions.repays.push(...(data.repays || []).filter(tx =>
        validSymbols.includes(tx.reserve?.symbol)
      ));


   
      // Vérifier s'il y a plus de données
      const totalInBatch = (data.borrows?.length || 0) + (data.supplies?.length || 0) + (data.withdraws?.length || 0) + (data.repays?.length || 0);
      if (totalInBatch < LIMIT * 4) {
        hasMore = false;
      } else {
        skip += LIMIT;
        console.log(`⏭️  Pagination suivante1: skip=${skip}`);
      }
    }

    const totalTransactions = allTransactions.borrows.length + allTransactions.supplies.length +
      allTransactions.withdraws.length + allTransactions.repays.length;

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
};
