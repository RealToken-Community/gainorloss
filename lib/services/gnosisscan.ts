import fetch from 'node-fetch';
import { TOKENS } from '../../utils/constants';

// Configuration Gnosisscan
const GNOSISSCAN_API_URL = 'https://api.etherscan.io/v2/api';
// Utilise NEXT_PUBLIC_GNOSISSCAN_API_KEY comme fallback pour compatibilité avec le .env partagé
const API_KEY = process.env.GNOSISSCAN_API_KEY || process.env.NEXT_PUBLIC_GNOSISSCAN_API_KEY || '';

/**
 * Récupère toutes les transactions de token avec pagination et respect des limites d'API
 * Simule l'appel curl: https://api.etherscan.io/v2/api?chainid=100&module=account&action=tokentx&...
 * 
 * @param {string} userAddress - Adresse de l'utilisateur
 * @param {string} tokenAddress - Adresse du token contract
 * @param {number} startBlock - Bloc de début (ex: 32074665 pour V3)
 * @param {number} endBlock - Bloc de fin (ex: 99999999)
 * @param {Object} req - Objet request pour le logging (optionnel)
 * @returns {Promise<Array>} - Tableau des transactions
 */
async function fetchAllTokenTransactions(
  userAddress: string, 
  tokenAddress: string, 
  startBlock: number = 32074665, 
  endBlock: number = 99999999, 
  req: any = null
): Promise<any[]> {

  try {

    const allTransactions: any[] = [];
    let currentPage = 1;
    let hasMoreData = true;
    let totalTransactions = 0;
    
    // RESPECTER LA LIMITE: 2 requêtes par seconde maximum
    const DELAY_BETWEEN_REQUESTS = 500; // 500ms = 2 req/s max
    
    while (hasMoreData) {

      const params = new URLSearchParams({
        chainid: '100', // Gnosis Chain
        module: 'account',
        action: 'tokentx',
        address: userAddress,
        contractaddress: tokenAddress,
        startblock: startBlock.toString(),
        endblock: endBlock.toString(),
        sort: 'asc',
        page: currentPage.toString(),
        offset: '1000' // Maximum par page
      });
      
      if (API_KEY) {
        params.append('apikey', API_KEY);
      }
      
      const url = `${GNOSISSCAN_API_URL}?${params}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        const transactions = data.result;
        const transactionCount = transactions.length;
        
        // Ajouter les transactions à la liste
        allTransactions.push(...transactions);
        totalTransactions += transactionCount;
        
        // VÉRIFIER SI IL Y A PLUS DE DONNÉES
        if (transactionCount < 1000) {
          hasMoreData = false;
        } else {
          console.log(`🔄 Plus de données disponibles, page suivante...`);
          currentPage++;
          
          // RESPECTER LA LIMITE D'API: attendre 500ms
          if (currentPage > 1) {
            console.log(`⏱️  Attente ${DELAY_BETWEEN_REQUESTS}ms pour respecter la limite d'API...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }
        }
      } else if (data.status === '0') {
        // Status '0' peut signifier "No transactions found" (cas normal) ou une vraie erreur
        const message = data.message || '';
        const isNoTransactions = message.toLowerCase().includes('no transactions found') || 
                                 message.toLowerCase().includes('no record found');
        
        if (isNoTransactions) {
          // Cas normal : l'utilisateur n'a simplement pas de transactions
          console.log(`ℹ️  Aucune transaction trouvée pour ${tokenAddress} (cas normal)`);
          hasMoreData = false; // Arrêter la boucle, retourner un tableau vide
        } else if (message.toLowerCase().includes('rate limit')) {
          // Vraie erreur : limite d'API atteinte
          console.error(`❌ Limite d'API GnosisScan atteinte: ${message}`);
          throw new Error(`Limite d'API GnosisScan atteinte: ${message}`);
        } else if (message) {
          // Autre erreur de l'API
          console.error(`❌ Erreur API GnosisScan: ${message}`);
          throw new Error(`Erreur API GnosisScan: ${message}`);
        } else {
          // Réponse invalide
          console.error(`❌ Réponse API GnosisScan invalide:`, data);
          throw new Error('Réponse API GnosisScan invalide');
        }
      } else {
        // Réponse inattendue
        console.error(`❌ Réponse API GnosisScan inattendue:`, data);
        throw new Error('Réponse API GnosisScan inattendue');
      }
    }
    
    if (totalTransactions > 0) {
      console.log(`✅ ${totalTransactions} transaction(s) récupérée(s) pour ${tokenAddress}`);
    }
    
    return allTransactions;
    
  } catch (error) { 
    console.error(`❌ Erreur lors de la récupération des transactions de token ${tokenAddress}:`, error);
    throw error;
  }
}

/**
 * Récupère les transactions de token avec des blocs spécifiques pour V2 et V3
 * @param {string} userAddress - Adresse de l'utilisateur
 * @param {string} tokenAddress - Adresse du token contract
 * @param {string} version - Version du protocole ('V2' ou 'V3')
 * @param {Object} req - Objet request pour le logging (optionnel)
 * @returns {Promise<Array>} - Tableau des transactions
 */
async function fetchTokenTransactionsByVersion(
  userAddress: string, 
  tokenAddress: string, 
  version: string = 'V3', 
  req: any = null
): Promise<any[]> {
  try {
    // BLOCS SPÉCIFIQUES PAR VERSION
    const blockRanges: Record<string, { startBlock: number; endBlock: number }> = {
      'V2': {
        startBlock: 20206607, // À ajuster selon le déploiement V2
        endBlock: 99999999    // Juste avant V3
      },
      'V3': {
        startBlock: 32074665, // Déploiement V3
        endBlock: 99999999    // Jusqu'à maintenant
      }
    };
    
    const range = blockRanges[version] || blockRanges['V3'];
    
    console.log(`🚀 Récupération des transactions ${version} pour ${tokenAddress}`);
    console.log(`📊 Blocs: ${range.startBlock} → ${range.endBlock}`);
    
    return await fetchAllTokenTransactions(
      userAddress, 
      tokenAddress, 
      range.startBlock, 
      range.endBlock, 
      req
    );
    
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des transactions ${version}:`, error);
    throw error;
  }
}

/**
 * Récupère les transactions de supply tokens depuis l'API GnosisScan
 * @param {string} userAddress - Adresse de l'utilisateur
 * @param {string} version - Version du protocole ('V2' ou 'V3')
 * @param {Object} req - Objet request pour le logging (optionnel)
 * @returns {Promise<Object>} - Transactions brutes par token
 */
async function fetchSupplyTokenTransactionsFromAPI(userAddress: string, version: string = 'V3', req: any = null): Promise<Record<string, any[]>> {
  // ADRESSES DES SUPPLY TOKENS SELON LA VERSION
  const supplyTokenAddresses: Record<string, Record<string, string>> = {
    'V3': {
      'USDC': TOKENS.USDC.supplyAddress, // armmUSDC
      'WXDAI': TOKENS.WXDAI.supplyAddress  // armmWXDAI
    },
    'V2': {
      'WXDAI': TOKENS.WXDAI.supplyV2Address  // rmmV2WXDAI
    }
  };
  
  const tokensToFetch = supplyTokenAddresses[version] || supplyTokenAddresses['V3'];
  const allRawTransactions: Record<string, any[]> = {};
  
  // RÉCUPÉRER LES TRANSACTIONS POUR CHAQUE TOKEN
  for (const [tokenSymbol, contractAddress] of Object.entries(tokensToFetch)) {
    try {
      const rawTransactions = await fetchAllTokenTransactions(
        userAddress,
        contractAddress,
        version === 'V2' ? 1 : 32074665, // V2: bloc 1, V3: bloc 32074665
        99999999,
        req
      );
      
      allRawTransactions[tokenSymbol] = rawTransactions;
      
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des transactions ${tokenSymbol}:`, error);
      allRawTransactions[tokenSymbol] = [];
    }
    
    // RESPECTER LA LIMITE D'API ENTRE LES TOKENS
    if (Object.keys(tokensToFetch).length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return allRawTransactions;
}

/**
 * Nettoie et filtre les transactions brutes
 * @param {Array} rawTransactions - Transactions brutes depuis l'API
 * @param {string} userAddress - Adresse de l'utilisateur
 * @param {Object} existingTransactions - Transactions déjà connues (pour éviter les doublons)
 * @param {string} hashToFilter - Hash optionnel pour filtrer une transaction spécifique (avant les autres filtres)
 * @returns {Array} - Transactions filtrées
 */
function cleanAndFilterTransactions(rawTransactions: any[], userAddress: string, existingTransactions: any = {}, hashToFilter: string | null = null): any[] {
  return rawTransactions.filter(tx => {
    // FILTRAGE PAR HASH (si spécifié) - AVANT les autres filtres
    if (hashToFilter) {
      if (tx.hash.toLowerCase() !== hashToFilter.toLowerCase()) {
        return false;
      }
    }
    
    // ❌ ÉLIMINER LES MINT/BURN (from ou to = 0x0000...)
    if ((tx.from === '0x0000000000000000000000000000000000000000' || 
        tx.to === '0x0000000000000000000000000000000000000000') 
        && (tx.functionName !== 'supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)' )) {
      return false;
    }
    
    // VÉRIFIER SI LA TRANSACTION EXISTE DÉJÀ DANS THEGRAPH
    const isAlreadyKnown = existingTransactions.supplies?.some((existingTx: any) => 
      existingTx.hash === tx.hash
    ) || existingTransactions.withdraws?.some((existingTx: any) => 
      existingTx.hash === tx.hash
    );
    
    if (isAlreadyKnown) {
      return false;
    }
    
    return true;
  });
}

/**
 * Détermine le type de transaction selon la direction
 * @param {Object} tx - Transaction brute
 * @param {string} userAddress - Adresse de l'utilisateur
 * @returns {string} - Type de transaction ('in_others', 'out_others', 'ronday', 'unknown')
 */
function determineTransactionType(tx: any, userAddress: string): string {
  if (tx.to.toLowerCase() === userAddress.toLowerCase()) {
    // VÉRIFIER SI C'EST UNE FONCTION DISPERSETOKEN
    if (tx.functionName && tx.functionName.includes('disperseToken(address token, address[] recipients, uint256[] values)')) {
      return 'ronday'; // L'utilisateur reçoit des tokens via Ronday
    } else {
      return 'in_others'; // L'utilisateur reçoit des tokens (cas par défaut)
    }
  } else if (tx.from.toLowerCase() === userAddress.toLowerCase()) {
    return 'out_others'; // L'utilisateur envoie des tokens
  } else {
    return 'unknown'; // Cas par défaut (ne devrait pas arriver après filtrage)
  }
}

/**
 * Formate les transactions filtrées en format final
 * @param {Array} filteredTransactions - Transactions filtrées
 * @param {string} tokenSymbol - Symbole du token
 * @param {string} version - Version du protocole
 * @param {string} userAddress - Adresse de l'utilisateur
 * @returns {Array} - Transactions formatées
 */
function formatTransactions(filteredTransactions: any[], tokenSymbol: string, version: string, userAddress: string): any[] {
  return filteredTransactions.map((tx: any) => {
    const type = determineTransactionType(tx, userAddress);
    
    return {
      txHash: tx.hash,
      amount: tx.value,
      timestamp: parseInt(tx.timeStamp),
      type: type,
      token: tokenSymbol,
      version: version
    };
  });
}

/**
 * Récupère et post-traite les transactions de supply tokens via GnosisScan
 * @param {string} userAddress - Adresse de l'utilisateur
 * @param {Object} existingTransactions - Transactions déjà connues (pour éviter les doublons)
 * @param {string} version - Version du protocole ('V2' ou 'V3')
 * @param {Object} req - Objet request pour le logging (optionnel)
 * @param {string} hashToFilter - Hash optionnel pour filtrer une transaction spécifique (avant les autres filtres)
 * @returns {Promise<Object>} - Transactions formatées par token
 */
async function fetchSupplyTokenTransactionsViaGnosisScan(
  userAddress: string, 
  existingTransactions: any = {}, 
  version: string = 'V3', 
  req: any = null,
  hashToFilter: string | null = null
): Promise<Record<string, any[]>> {
  
  try {
    // 1. Récupération des données depuis l'API GnosisScan
    const allRawTransactions = await fetchSupplyTokenTransactionsFromAPI(userAddress, version, req);
    
    // 2. Nettoyage, filtrage et formatage pour chaque token
    const allFormattedTransactions: Record<string, any[]> = {};
    
    for (const [tokenSymbol, rawTransactions] of Object.entries(allRawTransactions)) {
      // Nettoyage et filtrage
      const filteredTransactions = cleanAndFilterTransactions(
        rawTransactions,
        userAddress,
        existingTransactions,
        hashToFilter
      );
      
      // Formatage
      allFormattedTransactions[tokenSymbol] = formatTransactions(
        filteredTransactions,
        tokenSymbol,
        version,
        userAddress
      );
    }
    
    return allFormattedTransactions;
    
  } catch (error) {  
    console.error(`❌ Erreur lors de la récupération des transactions supply ${version}:`, error);
    throw error;
  }
}

export {
  fetchAllTokenTransactions,
  fetchTokenTransactionsByVersion,
  fetchSupplyTokenTransactionsViaGnosisScan
};

