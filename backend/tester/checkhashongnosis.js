#!/usr/bin/env node

require('dotenv').config();
const fetch = require('node-fetch');

// Configuration GnosisScan
const GNOSISSCAN_API_URL = 'https://api.etherscan.io/v2/api';
const API_KEY = process.env.GNOSISSCAN_API_KEY || process.env.NEXT_PUBLIC_GNOSISSCAN_API_KEY || '';

// Adresse du supply token USDC (armmUSDC)
const USDC_SUPPLY_ADDRESS = '0xed56f76e9cbc6a64b821e9c016eafbd3db5436d1';
const START_BLOCK = 32074665; // Déploiement V3
const END_BLOCK = 99999999;

/**
 * Script de test pour vérifier si un hash est présent dans les transactions USDC supply
 * Usage: node checkhashongnosis.js <adresse_evm> [hash_to_check]
 * 
 * Exemples:
 *   node checkhashongnosis.js 0x1234...
 *   node checkhashongnosis.js 0x1234... 0x0e50a9220bf8a89ab3a98d08ea1b10a8f49165d9dabc6f5e00c451e23d947c44
 */
async function main() {
  const userAddress = process.argv[2];
  const hashToCheck = process.argv[3]; // Hash optionnel à vérifier

  // Validation de l'adresse
  if (!userAddress) {
    console.error('❌ Erreur: Aucune adresse fournie');
    console.log('Usage: node checkhashongnosis.js <adresse_evm> [hash_to_check]');
    console.log('\nExemples:');
    console.log('  node checkhashongnosis.js 0x1234567890123456789012345678901234567890');
    console.log('  node checkhashongnosis.js 0x1234... 0x0e50a9220bf8a89ab3a98d08ea1b10a8f49165d9dabc6f5e00c451e23d947c44');
    process.exit(1);
  }

  // Validation du format de l'adresse
  if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
    console.error('❌ Erreur: Adresse EVM invalide');
    console.log('L\'adresse doit être au format: 0x suivi de 40 caractères hexadécimaux');
    process.exit(1);
  }

  // Validation du hash si fourni
  if (hashToCheck && !/^0x[a-fA-F0-9]{64}$/.test(hashToCheck)) {
    console.error('❌ Erreur: Hash de transaction invalide');
    console.log('Le hash doit être au format: 0x suivi de 64 caractères hexadécimaux');
    process.exit(1);
  }

  try {
    console.log('='.repeat(60));
    console.log('🔍 Vérification de hash dans les transactions USDC supply');
    console.log(`📍 Adresse: ${userAddress}`);
    console.log(`🪙 Token: USDC (armmUSDC)`);
    console.log(`📦 Contract: ${USDC_SUPPLY_ADDRESS}`);
    if (hashToCheck) {
      console.log(`🔎 Hash à vérifier: ${hashToCheck}`);
    }
    console.log('='.repeat(60));
    console.log('');

    const allTransactions = [];
    let currentPage = 1;
    let hasMoreData = true;
    const DELAY_BETWEEN_REQUESTS = 500; // 500ms = 2 req/s max
    const normalizedHashToCheck = hashToCheck ? hashToCheck.toLowerCase() : null;
    let hashFound = false;

    // Pagination pour récupérer toutes les transactions
    while (hasMoreData) {
      const params = new URLSearchParams({
        chainid: '100', // Gnosis Chain
        module: 'account',
        action: 'tokentx',
        address: userAddress,
        contractaddress: USDC_SUPPLY_ADDRESS,
        startblock: START_BLOCK,
        endblock: END_BLOCK,
        sort: 'asc',
        page: currentPage,
        offset: 1000 // Maximum par page
      });
      
      if (API_KEY) {
        params.append('apikey', API_KEY);
      }
      
      const url = `${GNOSISSCAN_API_URL}?${params}`;
      console.log(`📄 Page ${currentPage}: ${url.replace(API_KEY || '', '[API_KEY]')}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        const transactions = data.result;
        const transactionCount = transactions.length;
        
        // Parcourir toutes les transactions de cette page
        transactions.forEach(tx => {
          allTransactions.push(tx);
          
          // Si un hash est recherché, vérifier s'il est présent
          if (normalizedHashToCheck && tx.hash && tx.hash.toLowerCase() === normalizedHashToCheck) {
            hashFound = true;
            console.log(`\n✅ HASH TROUVÉ !`);
            console.log(`   Hash: ${tx.hash}`);
            console.log(`   From: ${tx.from}`);
            console.log(`   To (Interacted With): ${tx.to}`);
            console.log(`   Value: ${tx.value}`);
            console.log(`   Block: ${tx.blockNumber}`);
            console.log(`   Timestamp: ${new Date(parseInt(tx.timeStamp) * 1000).toISOString()}`);
            if (tx.functionName) {   
              console.log(`   Function: ${tx.functionName}`);
            }
            // Afficher tous les champs disponibles pour debug
            console.log(`\n   📋 Tous les champs disponibles:`);
            Object.keys(tx).forEach(key => {
              console.log(`      ${key}: ${tx[key]}`);
            });
          }
        });
        
        console.log(`   → ${transactionCount} transactions récupérées (total: ${allTransactions.length})`);
        
        // Vérifier s'il y a plus de données
        if (transactionCount < 1000) {
          hasMoreData = false;
        } else {
          currentPage++;
          
          // Respecter la limite d'API
          if (currentPage > 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }
        }
      } else {
        // Gérer les erreurs d'API
        if (data.message && data.message.includes('rate limit')) {
          console.error(`❌ Limite d'API atteinte: ${data.message}`);
          throw new Error(`Limite d'API GnosisScan atteinte: ${data.message}`);
        } else if (data.message && data.message.includes('Invalid API Key')) {
          console.error(`❌ Clé API invalide: ${data.message}`);
          console.log('💡 Vérifiez votre variable d\'environnement GNOSISSCAN_API_KEY ou NEXT_PUBLIC_GNOSISSCAN_API_KEY');
          throw new Error(`Clé API GnosisScan invalide: ${data.message}`);
        } else if (data.message) {
          console.error(`❌ Erreur API GnosisScan: ${data.message}`);
          throw new Error(`Erreur API GnosisScan: ${data.message}`);
        } else {
          console.error(`❌ Réponse API invalide:`, data);
          throw new Error('Réponse API GnosisScan invalide');
        }
      }
    }

    // Résumé final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`Total transactions récupérées: ${allTransactions.length}`);
    
    if (hashToCheck) {
      if (hashFound) {
        console.log(`✅ Hash ${hashToCheck} : TROUVÉ`);
      } else {
        console.log(`❌ Hash ${hashToCheck} : NON TROUVÉ`);
        console.log(`\n💡 Cette transaction n'est pas présente dans les résultats de l'API GnosisScan`);
        console.log(`   pour le token USDC supply (${USDC_SUPPLY_ADDRESS})`);
      }
    }
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Exécuter le script
main();

