import { GraphQLClient } from 'graphql-request';
import logger from '../../utils/logger';

// Configuration TheGraph
// Subgraph ID pour RealToken RMM sur Gnosis (décentralisé sur TheGraph Network)
const SUBGRAPH_ID = '2xrWGGZ5r8Z7wdNdHxhbRVKcAD2dDgv3F2NcjrZmxifJ';
const THEGRAPH_URL = `https://gateway.thegraph.com/api/subgraphs/id/${SUBGRAPH_ID}`;

// IMPORTANT: Lire les variables d'environnement dans une fonction pour le runtime Docker
// (les variables au top-level sont évaluées au build, pas au runtime en mode standalone)
function getApiKey(): string | undefined {
  return process.env.THEGRAPH_API_KEY || process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;
}

// Client GraphQL - recréé si l'API key change
let client: GraphQLClient | null = null;
let clientApiKey: string | undefined = undefined;

async function getClient(): Promise<GraphQLClient> {
  const apiKey = getApiKey();

  // Recréer le client si l'API key a changé ou si le client n'existe pas
  if (!client || clientApiKey !== apiKey) {
    logger.debug(`TheGraph client init - API key present: ${!!apiKey}`);
    client = new GraphQLClient(THEGRAPH_URL, {
      headers: apiKey ? {
        'Authorization': `Bearer ${apiKey}`
      } : {}
    });
    clientApiKey = apiKey;
  }
  return client;
}

const sTokenBalance_QUERY = `query ATokenMovements($user: String!, $first: Int!, $skip: Int!) {
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
}
`;

const dTokenBalance_QUERY = `query VTokenMovements($user: String!, $first: Int!, $skip: Int!) {
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
 * Récupère tous les atokenBalanceHistoryItems avec pagination
 */
export async function fetchAllATokenBalances(userAddress: string): Promise<BalanceItem[]> {
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
      
      const graphqlClient = await getClient();
      const data: { atokenBalanceHistoryItems: BalanceItem[] } = await graphqlClient.request(sTokenBalance_QUERY, variables);
      const balances = data.atokenBalanceHistoryItems || [];
      
      // Filtrer seulement USDC et WXDAI
      const filteredBalances = balances.filter(item => {
        const symbol = item.userReserve?.reserve?.symbol;
        return symbol === 'USDC' || symbol === 'WXDAI';
      });
      
      allBalances.push(...filteredBalances);
     
      // Vérifier s'il y a plus de données
      if (balances.length < LIMIT) {
        hasMore = false;
      } else {
        skip += LIMIT;
        logger.debug(`Pagination suivante2: skip=${skip}`);
      }
    }
    
    return allBalances;
    
  } catch (error) {  
    logger.error('Erreur lors de la récupération des atoken balances:', error);
    throw error;
  }
}

/**
 * Récupère tous les vtokenBalanceHistoryItems avec pagination
 */
export async function fetchAllVTokenBalances(userAddress: string, req: any = null): Promise<BalanceItem[]> {
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
      
      const graphqlClient = await getClient();
      const data: { vtokenBalanceHistoryItems: BalanceItem[] } = await graphqlClient.request(dTokenBalance_QUERY, variables);
      const balances = data.vtokenBalanceHistoryItems || [];
      
      // Filtrer seulement USDC et WXDAI
      const filteredBalances = balances.filter(item => {
        const symbol = item.userReserve?.reserve?.symbol;
        return symbol === 'USDC' || symbol === 'WXDAI';
      });
      
      allBalances.push(...filteredBalances);
   
      // Vérifier s'il y a plus de données
      if (balances.length < LIMIT) {
        hasMore = false;
      } else {
        skip += LIMIT;
        logger.debug(`Pagination suivante3: skip=${skip}`);
      }
    }
    
    return allBalances;
    
  } catch (error) {
    logger.error('Erreur lors de la récupération des vtoken balances:', error);
    throw error;
  }
}

/**
 * Récupère tous les balances (atoken + vtoken) avec pagination
 */
export async function fetchAllTokenBalances(userAddress: string): Promise<{
  atoken: BalanceItem[];
  vtoken: BalanceItem[];
  total: number;
}> {
  try {
    logger.info(`Récupération de tous les balances pour ${userAddress}`);
    
    // Récupérer en parallèle pour optimiser
    const [atokenBalances, vtokenBalances] = await Promise.all([
      fetchAllATokenBalances(userAddress),
      fetchAllVTokenBalances(userAddress)
    ]);
    
    const result = {
      atoken: atokenBalances,
      vtoken: vtokenBalances,
      total: atokenBalances.length + vtokenBalances.length
    };
    
    return result;
    
  } catch (error) {
    logger.error('Erreur lors de la récupération de tous les balances:', error);
    throw error;
  }
}

export { sTokenBalance_QUERY, dTokenBalance_QUERY };

