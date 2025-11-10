// Configuration TheGraph V2
const THEGRAPH_URL_V2 = 'https://api.thegraph.com/subgraphs/id/QmXT8Cpkjevu2sPN1fKkwb7Px9Wqj84DALA2TQ8nokhj7e';
const API_KEY = process.env.THEGRAPH_API_KEY;

// Client GraphQL V2 (utilise un import dynamique pour ES modules)
let clientV2 = null;
async function getClientV2() {
  if (!clientV2) {
    const { GraphQLClient } = await import('graphql-request');
    clientV2 = new GraphQLClient(THEGRAPH_URL_V2, {
      headers: API_KEY ? {
        'Authorization': `Bearer ${API_KEY}`
      } : {}
    });
  }
  return clientV2;
}

// Requête pour les balances historiques V2 (sans filtrage imbriqué)
const sTokenBalance_V2_QUERY = `query ATokenMovementsV2($user: String!, $first: Int!, $skip: Int!) {
  atokenBalanceHistoryItems(
    where: { userReserve_: { user: $user } } 
    orderBy: timestamp
    orderDirection: asc
    first: $first
    skip: $skip
  ) {
    timestamp
    currentATokenBalance
    scaledATokenBalance
    index
    userReserve {
      reserve { symbol decimals }
    }
  }
}`;

const dTokenBalance_V2_QUERY = `query VTokenMovementsV2($user: String!, $first: Int!, $skip: Int!) {
  vtokenBalanceHistoryItems(
    where: { userReserve_: { user: $user } }
    orderBy: timestamp
    orderDirection: asc
    first: $first
    skip: $skip
  ) {
    timestamp
    currentVariableDebt
    scaledVariableDebt
    index
    userReserve {
      reserve { symbol decimals }
    }
  }
}`;

/**
 * Récupère tous les atokenBalanceHistoryItems V2 avec pagination
 */
async function fetchAllATokenBalancesV2(userAddress, req = null) {
  const LIMIT = 1000; // Limite TheGraph par défaut
  const allBalances = [];
  let skip = 0;
  let hasMore = true;

  try {
  
    while (hasMore) {
      const variables = { 
        user: userAddress.toLowerCase(), 
        first: LIMIT, 
        skip: skip 
      };
      
      const client = await getClientV2();
      const data = await client.request(sTokenBalance_V2_QUERY, variables);
      const balances = data.atokenBalanceHistoryItems || [];
      
     
      allBalances.push(...balances);
      
      // Vérifier s'il y a plus de données
      if (balances.length < LIMIT) {
        hasMore = false;
      } else {
        skip += LIMIT;
      }
    }
    
    // Filtrer seulement WXDAI (double vérification)
    const wxdaiBalances = allBalances.filter(balance => 
      balance.userReserve.reserve.symbol === 'rmmWXDAI'
    );
    
  
    
    return wxdaiBalances;
    
  } catch (error) {   
    console.error('❌ Erreur lors de la récupération des balances atoken V2:', error);
    throw error;
  }
}

/**
 * Récupère tous les vtokenBalanceHistoryItems V2 avec pagination
 */
async function fetchAllVTokenBalancesV2(userAddress, req = null) {

  const LIMIT = 1000; // Limite TheGraph par défaut
  const allBalances = [];
  let skip = 0;
  let hasMore = true;

  try {

    while (hasMore) {
      const variables = { 
        user: userAddress.toLowerCase(), 
        first: LIMIT, 
        skip: skip 
      };
      
      const client = await getClientV2();
      const data = await client.request(dTokenBalance_V2_QUERY, variables);
      const balances = data.vtokenBalanceHistoryItems || [];
      
      
      allBalances.push(...balances);
      
      // Vérifier s'il y a plus de données
      if (balances.length < LIMIT) {
        hasMore = false;
      } else {
        skip += LIMIT;
      }
    }
    
    // Filtrer seulement WXDAI (double vérification)
    const wxdaiBalances = allBalances.filter(balance => 
      balance.userReserve.reserve.symbol === 'rmmWXDAI'
    );
    
   
    return wxdaiBalances;
    
  } catch (error) {  
    console.error('❌ Erreur lors de la récupération des balances vtoken V2:', error);
    throw error;
  }
}

/**
 * Récupère tous les balances V2 (atoken + vtoken) en une seule fois
 */
async function fetchAllTokenBalancesV2(userAddress, req = null) {

  try {
    console.log(`🚀 Récupération de tous les balances V2 pour ${userAddress}`);
    
    // Récupérer en parallèle
    const [atokenBalances, vtokenBalances] = await Promise.all([
      fetchAllATokenBalancesV2(userAddress, req),
      fetchAllVTokenBalancesV2(userAddress, req)
    ]);
    
    const totalCount = atokenBalances.length + vtokenBalances.length;
   
    
    return {
      atoken: atokenBalances,
      vtoken: vtokenBalances
    };
    
  } catch (error) { 
    console.error('❌ Erreur lors de la récupération de tous les balances V2:', error);
    throw error;
  }
}

module.exports = {
  fetchAllTokenBalancesV2,
  fetchAllATokenBalancesV2,
  fetchAllVTokenBalancesV2
};
