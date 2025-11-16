#!/usr/bin/env node

require('dotenv').config();
const { fetchAllTransactionsV3, extractTxHashFromId } = require('../services/fetch-transactions');

/**
 * Script de test pour récupérer les transactions V3 depuis The Graph
 * Usage: node retrievedataformThegraph.js <adresse_evm> [hash_transaction]
 * 
 * Exemples:
 *   node retrievedataformThegraph.js 0x1234...
 *   node retrievedataformThegraph.js 0x1234... 0x463505221fb6d048057f5333c8f42455825e2c12383eed0c1cc5bea72ab1790a
 */
async function main() {
  // Récupérer l'adresse depuis les arguments de ligne de commande
  const userAddress = process.argv[2];
  const hashToCheck = process.argv[3]; // Hash optionnel à vérifier

  // Validation de l'adresse
  if (!userAddress) {
    console.error('❌ Erreur: Aucune adresse fournie');
    console.log('Usage: node retrievedataformThegraph.js <adresse_evm> [hash_transaction]');
    console.log('\nExemples:');
    console.log('  node retrievedataformThegraph.js 0x1234567890123456789012345678901234567890');
    console.log('  node retrievedataformThegraph.js 0x1234... 0x463505221fb6d048057f5333c8f42455825e2c12383eed0c1cc5bea72ab1790a');
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
    console.log(`🔍 Test de récupération des transactions V3`);
    console.log(`📍 Adresse: ${userAddress}`);
    if (hashToCheck) {
      console.log(`🔎 Hash à vérifier: ${hashToCheck}`);
    }
    console.log('='.repeat(60));
    console.log('');

    // Appeler la fonction avec debug activé
    const transactions = await fetchAllTransactionsV3(userAddress, true);

    // Afficher un résumé final formaté
    console.log('='.repeat(60));
    console.log('📋 RÉSUMÉ FINAL DES TRANSACTIONS');
    console.log('='.repeat(60));
    console.log(`borrows:   ${transactions.borrows.length}`);
    console.log(`supplies:  ${transactions.supplies.length}`);
    console.log(`withdraws: ${transactions.withdraws.length}`);
    console.log(`repays:    ${transactions.repays.length}`);
    console.log('='.repeat(60));

    // Si un hash est fourni, vérifier s'il est présent
    if (hashToCheck) {
      console.log('\n' + '='.repeat(60));
      console.log('🔍 VÉRIFICATION DU HASH');
      console.log('='.repeat(60));
      
      // Normaliser le hash en lowercase pour la comparaison
      const normalizedHash = hashToCheck.toLowerCase();
      
      // Extraire tous les txHash des transactions
      const allTxHashes = {
        borrows: [],
        supplies: [],
        withdraws: [],
        repays: []
      };
      
      // Extraire les hash depuis les IDs TheGraph
      transactions.borrows.forEach(tx => {
        const txHash = extractTxHashFromId(tx.id);
        if (txHash) {
          allTxHashes.borrows.push(txHash.toLowerCase());
        }
      });
      
      transactions.supplies.forEach(tx => {
        const txHash = extractTxHashFromId(tx.id);
        if (txHash) {
          allTxHashes.supplies.push(txHash.toLowerCase());
        }
      });
      
      transactions.withdraws.forEach(tx => {
        const txHash = extractTxHashFromId(tx.id);
        if (txHash) {
          allTxHashes.withdraws.push(txHash.toLowerCase());
        }
      });
      
      transactions.repays.forEach(tx => {
        const txHash = extractTxHashFromId(tx.id);
        if (txHash) {
          allTxHashes.repays.push(txHash.toLowerCase());
        }
      });
      
      // Chercher le hash dans tous les types
      const foundIn = [];
      if (allTxHashes.borrows.includes(normalizedHash)) {
        foundIn.push('borrows');
      }
      if (allTxHashes.supplies.includes(normalizedHash)) {
        foundIn.push('supplies');
      }
      if (allTxHashes.withdraws.includes(normalizedHash)) {
        foundIn.push('withdraws');
      }
      if (allTxHashes.repays.includes(normalizedHash)) {
        foundIn.push('repays');
      }
      
      if (foundIn.length > 0) {
        console.log(`✅ Transaction TROUVÉE dans TheGraph !`);
        console.log(`📦 Type(s): ${foundIn.join(', ')}`);
        console.log(`🔗 Hash: ${hashToCheck}`);
      } else {
        console.log(`❌ Transaction NON TROUVÉE dans TheGraph`);
        console.log(`🔗 Hash recherché: ${hashToCheck}`);
        console.log(`\n💡 Cette transaction est probablement manquante dans TheGraph`);
        console.log(`   Elle devrait être récupérée via GnosisScan API`);
      }
      console.log('='.repeat(60));
    }

    // Optionnel: Afficher quelques exemples de transactions
    if (transactions.borrows.length > 0) {
      console.log('\n📝 Exemple de transaction borrow:');
      console.log(JSON.stringify(transactions.borrows[0], null, 2));
    }

    if (transactions.supplies.length > 0) {
      console.log('\n📝 Exemple de transaction supply:');
      console.log(JSON.stringify(transactions.supplies[0], null, 2));
    }

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

