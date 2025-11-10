// Configuration TheGraph V2
const THEGRAPH_URL_V2 = 'https://api.thegraph.com/subgraphs/id/QmXT8Cpkjevu2sPN1fKkwb7Px9Wqj84DALA2TQ8nokhj7e';
const API_KEY = process.env.THEGRAPH_API_KEY;

// Client GraphQL (utilise un import dynamique pour ES modules)
let client = null;
async function getClient() {
  if (!client) {
    const { GraphQLClient } = await import('graphql-request');
    client = new GraphQLClient(THEGRAPH_URL_V2, {
      headers: API_KEY ? {
        'Authorization': `Bearer ${API_KEY}`
      } : {}
    });
  }
  return client;
}

// Requête pour récupérer toutes les transactions V2 avec pagination
const TRANSACTIONS_QUERY_V2 = `
  query GetTransactionsV2($userAddress: String!, $first: Int!, $skip: Int!) {
    borrows: borrows(
      first: $first
      skip: $skip
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id           # Pour extraire le txHash
      reserve { 
        id
        symbol
        decimals
      }
      amount
      timestamp
    }
    
    supplies: deposits(
      first: $first
      skip: $skip
      where: { user_: { id: $userAddress } }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id           # Pour extraire le txHash
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
      id           #  Pour extraire le txHash
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
      id           #  Pour extraire le txHash
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
 * Extrait le txHash depuis l'id TheGraph V2
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
 * Récupère toutes les transactions V2 d'une adresse avec pagination
 */
async function fetchAllTransactionsV2(userAddress) {
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
      const data = await graphqlClient.request(TRANSACTIONS_QUERY_V2, variables);

      const isValidSymbol = (symbol) => symbol === 'rmmWXDAI';
      
      // Ajouter les transactions de ce batch
      allTransactions.borrows.push(...(data.borrows || []).filter(tx => isValidSymbol(tx.reserve?.symbol)));
      allTransactions.supplies.push(...(data.supplies || []).filter(tx => isValidSymbol(tx.reserve?.symbol)));
      allTransactions.withdraws.push(...(data.withdraws || []).filter(tx => isValidSymbol(tx.reserve?.symbol)));
      allTransactions.repays.push(...(data.repays || []).filter(tx => isValidSymbol(tx.reserve?.symbol)));
      

      // Vérifier s'il y a plus de données
      const totalInBatch = (data.borrows?.length || 0) + (data.supplies?.length || 0) + (data.withdraws?.length || 0) + (data.repays?.length || 0);
      if (totalInBatch < LIMIT * 4) {
        hasMore = false;
      } else {
        skip += LIMIT;
        console.log(`⏭️  Pagination suivante V2: skip=${skip}`);
      }
    }
    
    const totalTransactions = allTransactions.borrows.length + allTransactions.supplies.length + 
                            allTransactions.withdraws.length + allTransactions.repays.length;
    

    return allTransactions;
    
  } catch (error) {   
    console.error('❌ Erreur lors de la récupération des transactions V2:', error);
    throw error;
  }
}

/**
 * Transforme les transactions V2 en format compatible frontend
 */
function transformTransactionsV2ToFrontendFormat(transactions, gnosisTransactions = null) {
  const frontendTransactions = {
    USDC: { debt: [], supply: [] },  // V2: pas d'USDC, mais garder la structure
    WXDAI: { debt: [], supply: [] }
  };
  
  // Fonction helper pour déterminer le token (V2: seulement WXDAI)
  function getTokenFromReserve(reserve) {
    // V2: seulement WXDAI, pas d'USDC
    return 'WXDAI';
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
        version: 'V2'
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
        version: 'V2'
      });
    }
  });
  
  // Traiter les supplies (supply) → type: 'deposit'
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
        version: 'V2'
      });
    }
  });
  
  // Traiter les withdraws (supply) → type: 'withdraw'
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
        version: 'V2'
      });
    }
  });
  
  console.log(`🔄 Transactions V2 transformées: ${frontendTransactions.WXDAI.debt.length} debt, ${frontendTransactions.WXDAI.supply.length} supply`);

  // Ajouter les transactions GnosisScan (supply tokens uniquement)
  if (gnosisTransactions) {
    Object.keys(gnosisTransactions).forEach(tokenSymbol => {
      const gnosisTxs = gnosisTransactions[tokenSymbol] || [];
      
      if (gnosisTxs.length > 0) {
        // Ajouter à la section supply du bon token
        frontendTransactions[tokenSymbol].supply.push(...gnosisTxs);
        
        console.log(`➕ ${gnosisTxs.length} transactions GnosisScan ajoutées pour ${tokenSymbol}`);
      }
    });
    
    // Trier toutes les transactions supply par timestamp (plus vieux → plus récent)
    Object.keys(frontendTransactions).forEach(tokenSymbol => {
      frontendTransactions[tokenSymbol].supply.sort((a, b) => a.timestamp - b.timestamp);
    });
  }

  return frontendTransactions;
}

module.exports = {
  fetchAllTransactionsV2,
  transformTransactionsV2ToFrontendFormat,
  extractTxHashFromId
};
