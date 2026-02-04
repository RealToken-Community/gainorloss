import { GraphQLClient } from 'graphql-request';
import logger from '../../utils/logger';

// Configuration TheGraph V2
// Subgraph ID pour RealToken RMM V2 sur Gnosis (décentralisé sur TheGraph Network)
const SUBGRAPH_ID_V2 = 'GLPJ8va2UbjoTpcQQwG8FXQYYQChYZWczuDubsQfzR7K';
const THEGRAPH_URL_V2 = `https://gateway.thegraph.com/api/subgraphs/id/${SUBGRAPH_ID_V2}`;

// IMPORTANT: Lire les variables d'environnement dans une fonction pour le runtime Docker
function getApiKey(): string | undefined {
  return process.env.THEGRAPH_API_KEY || process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;
}

// Client GraphQL V2 - recréé si l'API key change
let clientV2: GraphQLClient | null = null;
let clientApiKey: string | undefined = undefined;

async function getClientV2(): Promise<GraphQLClient> {
  const apiKey = getApiKey();

  if (!clientV2 || clientApiKey !== apiKey) {
    logger.debug(`TheGraph V2 client init - API key present: ${!!apiKey}`);
    clientV2 = new GraphQLClient(THEGRAPH_URL_V2, {
      headers: apiKey ? {
        'Authorization': `Bearer ${apiKey}`
      } : {}
    });
    clientApiKey = apiKey;
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

interface BalanceItem {
  timestamp: number;
  currentATokenBalance?: string;
  scaledATokenBalance?: string;
  currentVariableDebt?: string;
  scaledVariableDebt?: string;
  index: string;
  userReserve: {
    reserve: {
      symbol: string;
      decimals: number;
    };
  };
}

/**
 * Récupère tous les atokenBalanceHistoryItems V2 avec pagination
 */
export async function fetchAllATokenBalancesV2(userAddress: string, req: any = null): Promise<BalanceItem[]> {
  const LIMIT = 1000; // Limite TheGraph par défaut
  const allBalances: BalanceItem[] = [];
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
      const data: { atokenBalanceHistoryItems: BalanceItem[] } = await client.request(sTokenBalance_V2_QUERY, variables);
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
    logger.error('Erreur lors de la récupération des balances atoken V2:', error);
    throw error;
  }
}

/**
 * Récupère tous les vtokenBalanceHistoryItems V2 avec pagination
 */
export async function fetchAllVTokenBalancesV2(userAddress: string, req: any = null): Promise<BalanceItem[]> {
  const LIMIT = 1000; // Limite TheGraph par défaut
  const allBalances: BalanceItem[] = [];
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
      const data: { vtokenBalanceHistoryItems: BalanceItem[] } = await client.request(dTokenBalance_V2_QUERY, variables);
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
    logger.error('Erreur lors de la récupération des balances vtoken V2:', error);
    throw error;
  }
}

/**
 * Récupère tous les balances V2 (atoken + vtoken) en une seule fois
 */
export async function fetchAllTokenBalancesV2(userAddress: string, req: any = null): Promise<{
  atoken: BalanceItem[];
  vtoken: BalanceItem[];
}> {
  try {
    logger.info(`Récupération de tous les balances V2 pour ${userAddress}`);
    
    // Récupérer en parallèle
    const [atokenBalances, vtokenBalances] = await Promise.all([
      fetchAllATokenBalancesV2(userAddress, req),
      fetchAllVTokenBalancesV2(userAddress, req)
    ]);
    
    return {
      atoken: atokenBalances,
      vtoken: vtokenBalances
    };
    
  } catch (error) { 
    logger.error('Erreur lors de la récupération de tous les balances V2:', error);
    throw error;
  }
}

