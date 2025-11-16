#!/usr/bin/env node

require('dotenv').config();
const { fetchSupplyTokenTransactionsViaGnosisScan } = require('../services/gnosisscan');

/**
 * Script de test pour récupérer les transactions supply depuis GnosisScan API
 * Usage: node retrievedatafromGnosisAPI.js <adresse_evm> [version] [hash_transaction]
 * 
 * Exemples:
 *   node retrievedatafromGnosisAPI.js 0x1234... V3
 *   node retrievedatafromGnosisAPI.js 0x1234... V2
 *   node retrievedatafromGnosisAPI.js 0x1234... V3 0x0e50a9220bf8a89ab3a98d08ea1b10a8f49165d9dabc6f5e00c451e23d947c44
 */
async function main() {
  // Récupérer les arguments
  const userAddress = process.argv[2];
  const version = process.argv[3] || 'V3'; // V2 ou V3, par défaut V3
  const hashToCheck = process.argv[4]; // Hash optionnel à vérifier

  // Validation de l'adresse
  if (!userAddress) {
    console.error('❌ Erreur: Aucune adresse fournie');
    console.log('Usage: node retrievedatafromGnosisAPI.js <adresse_evm> [version] [hash_transaction]');
    console.log('  version: V2 ou V3 (défaut: V3)');
    console.log('  hash_transaction: Hash de transaction à vérifier (optionnel)');
    console.log('\nExemples:');
    console.log('  node retrievedatafromGnosisAPI.js 0x1234567890123456789012345678901234567890 V3');
    console.log('  node retrievedatafromGnosisAPI.js 0x1234... V3 0x0e50a9220bf8a89ab3a98d08ea1b10a8f49165d9dabc6f5e00c451e23d947c44');
    process.exit(1);
  }

  // Validation du format de l'adresse
  if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
    console.error('❌ Erreur: Adresse EVM invalide');
    console.log('L\'adresse doit être au format: 0x suivi de 40 caractères hexadécimaux');
    process.exit(1);
  }

  // Validation de la version
  if (version !== 'V2' && version !== 'V3') {
    console.error('❌ Erreur: Version invalide');
    console.log('La version doit être V2 ou V3');
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
    console.log(`🔍 Test de récupération des transactions supply via GnosisScan API`);
    console.log(`📍 Adresse: ${userAddress}`);
    console.log(`📦 Version: ${version}`);
    if (hashToCheck) {
      console.log(`🔎 Hash à vérifier: ${hashToCheck}`);
    }
    console.log('='.repeat(60));
    console.log('');

    // Appeler la fonction fetchSupplyTokenTransactionsViaGnosisScan
    // Passer un objet vide pour existingTransactions (pas de déduplication avec TheGraph)
    // Si hashToCheck est fourni, il sera filtré AVANT les autres filtres (mint/burn, etc.)
    const transactions = await fetchSupplyTokenTransactionsViaGnosisScan(
      userAddress,
      { supplies: [], withdraws: [] }, // Pas de transactions existantes
      version,
      null, // req
      hashToCheck || null // hashToFilter (optionnel)
    );

    // Afficher un résumé final formaté
    console.log('='.repeat(60));
    console.log('📋 RÉSUMÉ FINAL DES TRANSACTIONS PAR TOKEN');
    console.log('='.repeat(60));
    
    let totalTransactions = 0;
    for (const [tokenSymbol, txs] of Object.entries(transactions)) {
      console.log(`\n${tokenSymbol}:`);
      console.log(`  Total: ${txs.length} transactions`);
      
      // Compter par type
      const byType = txs.reduce((acc, tx) => {
        acc[tx.type] = (acc[tx.type] || 0) + 1;
        return acc;
      }, {});
      
      if (Object.keys(byType).length > 0) {
        console.log(`  Par type:`);
        Object.entries(byType).forEach(([type, count]) => {
          console.log(`    ${type}: ${count}`);
        });
      }
      
      totalTransactions += txs.length;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`TOTAL: ${totalTransactions} transactions`);
    console.log('='.repeat(60));

    // Si un hash est fourni, vérifier s'il est présent
    if (hashToCheck) {
      console.log('\n' + '='.repeat(60));
      console.log('🔍 VÉRIFICATION DU HASH');
      console.log('='.repeat(60));
      
      // Normaliser le hash en lowercase pour la comparaison
      const normalizedHash = hashToCheck.toLowerCase();
      
      // Chercher le hash dans tous les tokens
      const foundIn = [];
      for (const [tokenSymbol, txs] of Object.entries(transactions)) {
        const foundTx = txs.find(tx => tx.txHash.toLowerCase() === normalizedHash);
        if (foundTx) {
          foundIn.push({
            token: tokenSymbol,
            type: foundTx.type,
            tx: foundTx
          });
        }
      }
      
      if (foundIn.length > 0) {
        console.log(`✅ Transaction TROUVÉE dans GnosisScan !`);
        foundIn.forEach(({ token, type, tx }) => {
          console.log(`📦 Token: ${token}`);
          console.log(`   Type: ${type}`);
          console.log(`   Hash: ${tx.txHash}`);
          console.log(`   Amount: ${tx.amount}`);
          console.log(`   Timestamp: ${new Date(tx.timestamp * 1000).toISOString()}`);
        });
        console.log(`\n💡 Cette transaction est bien récupérée via GnosisScan API`);
      } else {
        console.log(`❌ Transaction NON TROUVÉE dans GnosisScan`);
        console.log(`🔗 Hash recherché: ${hashToCheck}`);
        console.log(`\n💡 Cette transaction n'est pas présente dans les résultats GnosisScan`);
        console.log(`   Vérifiez que:`);
        console.log(`   - La transaction concerne bien un supply token (armmUSDC, armmWXDAI)`);
        console.log(`   - La transaction n'est pas un mint/burn (from/to = 0x0000...)`);
        console.log(`   - La transaction est dans la bonne plage de blocs pour ${version}`);
      }
      console.log('='.repeat(60));
    }

    // Afficher quelques exemples de transactions
    for (const [tokenSymbol, txs] of Object.entries(transactions)) {
      if (txs.length > 0) {
        console.log(`\n📝 Exemple de transaction ${tokenSymbol}:`);
        console.log(JSON.stringify(txs[0], null, 2));
        break; // Un seul exemple
      }
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

