import { GraphQLClient } from 'graphql-request';
import logger from '../../utils/logger';

// Configuration TheGraph V3
const THEGRAPH_URL_V3 = 'https://api.thegraph.com/subgraphs/id/QmVH7ota6caVV2ceLY91KYYh6BJs2zeMScTTYgKDpt7VRg';
// Utilise NEXT_PUBLIC_THEGRAPH_API_KEY comme fallback pour compatibilité avec le .env partagé
const API_KEY = process.env.THEGRAPH_API_KEY || process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;

// Client GraphQL
let client: GraphQLClient | null = null;
async function getClient(): Promise<GraphQLClient> {
  if (!client) {
    client = new GraphQLClient(THEGRAPH_URL_V3, {
      headers: {
        ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
      }
    });
  }
  return client;
}

interface TypesToFetch {
  borrows?: boolean;
  supplies?: boolean;
  withdraws?: boolean;
  repays?: boolean;
}

/**
 * Génère dynamiquement la requête GraphQL en fonction des types de transactions à récupérer
 * @param {Object} typesToFetch - Objet avec les flags pour chaque type { borrows, supplies, withdraws, repays }
 * @returns {string} - Requête GraphQL
 */
function buildTransactionsQueryV3(typesToFetch: TypesToFetch): string {
  const queryParts: string[] = [];
  const variables: string[] = [];
  
  // Toujours déclarer les variables communes
  variables.push('$userAddress: String!');
  variables.push('$first: Int!');
  
  if (typesToFetch.borrows) {
    variables.push('$skipBorrows: Int!');
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
    variables.push('$skipSupplies: Int!');
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
    variables.push('$skipWithdraws: Int!');
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
    variables.push('$skipRepays: Int!');
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
  
  // Vérifier qu'au moins un type est demandé
  if (queryParts.length === 0) {
    throw new Error('Aucun type de transaction à récupérer');
  }
  
  // Construire la requête sans lignes vides inutiles
  const queryString = `query GetTransactionsV3(
    ${variables.join('\n    ')}
  ) {
${queryParts.join('')}
  }`;
  
  return queryString;
}

/**
 * Récupère toutes les transactions V3 d'une adresse avec pagination
 * Utilise une pagination indépendante pour chaque type de transaction
 * @param {string} userAddress - Adresse de l'utilisateur
 * @param {boolean} debug - Si true, affiche les logs détaillés (défaut: false)
 */
async function fetchAllTransactionsV3(userAddress: string, debug: boolean = false): Promise<any> {
  const LIMIT = 1000;
  const allTransactions: any = {
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
      logger.info(`Début de la récupération des transactions V3 pour ${userAddress}`);
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
      
      // Préparer les variables pour la requête (seulement celles nécessaires)
      const variables: any = {
        userAddress: userAddress.toLowerCase(),
        first: LIMIT
      };
      
      // Ajouter seulement les variables skip pour les types demandés
      if (typesToFetch.borrows) {
        variables.skipBorrows = skip.borrows;
      }
      if (typesToFetch.supplies) {
        variables.skipSupplies = skip.supplies;
      }
      if (typesToFetch.withdraws) {
        variables.skipWithdraws = skip.withdraws;
      }
      if (typesToFetch.repays) {
        variables.skipRepays = skip.repays;
      }

      if (debug) {
        logger.debug(`Requête GraphQL (batch ${batchNumber}):`);
        logger.debug(query);
        logger.debug(`Variables:`, JSON.stringify(variables, null, 2));
      }

      const graphqlClient = await getClient();
      let data: any;
      try {
        data = await graphqlClient.request(query, variables);
      } catch (error) {
        if (debug) {
          logger.error(`Erreur GraphQL détaillée:`, error);
          logger.debug(`Requête envoyée:`, query);
          logger.debug(`Variables envoyées:`, JSON.stringify(variables, null, 2));
        }
        throw error;
      }

      const validSymbols = ['USDC', 'WXDAI'];

      // Traiter chaque type de transaction
      if (typesToFetch.borrows && data.borrows) {
        const filteredBorrows = (data.borrows || []).filter((tx: any) =>
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
        const filteredSupplies = (data.supplies || []).filter((tx: any) =>
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
        const filteredWithdraws = (data.withdraws || []).filter((tx: any) =>
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
        const filteredRepays = (data.repays || []).filter((tx: any) =>
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
          .filter(([_, active]: [string, boolean]) => active)
          .map(([type, _]: [string, boolean]) => type)
          .join(', ');
        
        logger.debug(`Batch #${batchNumber} (types: ${activeTypes}):`);
        if (typesToFetch.borrows) {
          logger.debug(`   borrows: ${data.borrows?.length || 0} → total: ${allTransactions.borrows.length} ${limitReached.borrows ? '(terminé)' : ''}`);
        }
        if (typesToFetch.supplies) {
          logger.debug(`   supplies: ${data.supplies?.length || 0} → total: ${allTransactions.supplies.length} ${limitReached.supplies ? '(terminé)' : ''}`);
        }
        if (typesToFetch.withdraws) {
          logger.debug(`   withdraws: ${data.withdraws?.length || 0} → total: ${allTransactions.withdraws.length} ${limitReached.withdraws ? '(terminé)' : ''}`);
        }
        if (typesToFetch.repays) {
          logger.debug(`   repays: ${data.repays?.length || 0} → total: ${allTransactions.repays.length} ${limitReached.repays ? '(terminé)' : ''}`);
        }
      }
    }

    const totalTransactions = allTransactions.borrows.length + allTransactions.supplies.length +
      allTransactions.withdraws.length + allTransactions.repays.length;

    // Logs finaux récapitulatifs uniquement en mode debug
    if (debug) {
      logger.info(`Récupération terminée !`);
      logger.info(`Résumé final: borrows: ${allTransactions.borrows.length}, supplies: ${allTransactions.supplies.length}, withdraws: ${allTransactions.withdraws.length}, repays: ${allTransactions.repays.length}, TOTAL: ${totalTransactions} transactions`);
    }

    return allTransactions;

  } catch (error) {
    logger.error('Erreur lors de la récupération des transactions V3:', error);
    throw error;
  }
}

/**
 * Extrait le txHash depuis l'id TheGraph
 * Format: "32350433:4:0x4d1c2ad0bf1b47500ddbab4640230f8c05a920b5282816ea256d8bb315e1b9e6:14:14"
 * Le txHash est entre le 2ème et 3ème ":"
 */
function extractTxHashFromId(id: string | null | undefined): string | null {
  if (!id || typeof id !== 'string') return null;

  const parts = id.split(':');
  if (parts.length >= 3) {
    return parts[2];
  }

  return null;
}

interface FrontendTransaction {
  txHash: string;
  amount: string;
  timestamp: number;
  type: string;
  token: string;
  version: string;
}

interface FrontendTransactions {
  USDC: { debt: FrontendTransaction[]; supply: FrontendTransaction[] };
  WXDAI: { debt: FrontendTransaction[]; supply: FrontendTransaction[] };
}

/**
 * Transforme les transactions V3 en format compatible frontend
 */
function transformTransactionsV3ToFrontendFormat(
  transactions: any, 
  gnosisTransactions: Record<string, FrontendTransaction[]> | null = null
): FrontendTransactions {
  const frontendTransactions: FrontendTransactions = {
    USDC: { debt: [], supply: [] },
    WXDAI: { debt: [], supply: [] }
  };

  // Fonction helper pour déterminer le token
  function getTokenFromReserve(reserve: any): keyof FrontendTransactions {
    if (!reserve || !reserve.symbol) return 'WXDAI';
    return reserve.symbol === 'USDC' ? 'USDC' : 'WXDAI';
  }

  // Traiter les borrows (debt)
  transactions.borrows.forEach((tx: any) => {
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
  transactions.repays.forEach((tx: any) => {
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
  transactions.supplies.forEach((tx: any) => {
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
  transactions.withdraws.forEach((tx: any) => {
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

  logger.debug(`Transactions V3 transformées: ${frontendTransactions.USDC.debt.length + frontendTransactions.USDC.supply.length} USDC, ${frontendTransactions.WXDAI.debt.length + frontendTransactions.WXDAI.supply.length} WXDAI`);


  if (gnosisTransactions) {
    Object.keys(gnosisTransactions).forEach(tokenSymbol => {
      const gnosisTxs = gnosisTransactions[tokenSymbol] || [];

      if (gnosisTxs.length > 0 && (tokenSymbol === 'USDC' || tokenSymbol === 'WXDAI')) {
        frontendTransactions[tokenSymbol as keyof FrontendTransactions].supply.push(...gnosisTxs);

        logger.info(`${gnosisTxs.length} transactions GnosisScan ajoutées pour ${tokenSymbol}`);
      }
    });

    //Trier toutes les transactions supply par timestamp (plus vieux → plus récent)
    (Object.keys(frontendTransactions) as Array<keyof FrontendTransactions>).forEach(tokenSymbol => {
      frontendTransactions[tokenSymbol].supply.sort((a: any, b: any) => a.timestamp - b.timestamp);
    });
  }

  return frontendTransactions;
}

export { fetchAllTransactionsV3, transformTransactionsV3ToFrontendFormat, extractTxHashFromId };
