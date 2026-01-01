import type { NextApiRequest, NextApiResponse } from 'next';
import { isAddress, getAddress } from 'ethers';
import { retrieveInterestAndTransactionsForAllTokens } from '../../../../lib/services/thegraph-interest-calculator';

/**
 * @route GET /api/rmm/v3/:address1/:address2?/:address3?
 * @desc Endpoint principal qui utilise TheGraph pour récupérer les données
 * @access Public
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { addresses } = req.query;
    
    // Convertir addresses en tableau
    const addressArray = Array.isArray(addresses) ? addresses : [addresses].filter(Boolean);
    
    // Validation des adresses avec vérification du checksum EIP-55
    const normalizedAddresses: string[] = [];
    for (const address of addressArray) {
      if (typeof address !== 'string' || !isAddress(address)) {
        return res.status(400).json({
          error: 'Adresse invalide',
          message: 'Toutes les adresses doivent être des adresses Ethereum valides (0x...)',
          invalidAddress: address
        });
      }
      
      // Normaliser avec le bon checksum EIP-55
      // getAddress() valide et corrige automatiquement le checksum
      const normalized = getAddress(address);
      
      // Si l'adresse fournie n'avait pas le bon checksum, on la normalise
      // (getAddress() lève une erreur si l'adresse est invalide, donc on est sûr qu'elle est valide ici)
      if (address !== normalized && address.toLowerCase() !== normalized.toLowerCase()) {
        // L'adresse était valide mais avec un mauvais checksum - normalisée automatiquement
        // En production, on pourrait logger cela pour des raisons de sécurité
      }
      
      normalizedAddresses.push(normalized);
    }

    if (addressArray.length === 0) {
      return res.status(400).json({
        error: 'Aucune adresse fournie',
        message: 'Au moins une adresse doit être fournie'
      });
    }

    if (addressArray.length > 3) {
      return res.status(400).json({
        error: 'Trop d\'adresses',
        message: 'Maximum 3 adresses autorisées'
      });
    }

    const results: any[] = [];
    for (const address of normalizedAddresses) {
      try {
        // Initialiser les calculs d'intérêts pour cette adresse
        const interestCalculations: any = {};
        
        //Récupérer les résultats
        const interestanddataResults = await retrieveInterestAndTransactionsForAllTokens(address, req);

        // Déstructurer en excluant 'transactions'
        const { transactions, ...interestResults } = interestanddataResults as any;

        // Extraire les résultats par token (sans transactions)
        for (const [stablecoin, interestResult] of Object.entries(interestResults)) {
          interestCalculations[stablecoin] = interestResult;
        }
        results.push({ 
          address, 
          success: true, 
          data: {
            address,
            interests: interestCalculations,
            transactions: transactions
          }
        });
      } catch (error: any) {       
        console.error(`Erreur pour l'adresse ${address}:`, error);
        results.push({ 
          address, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successfulResults = results.filter((r: any) => r.success);
    const failedResults = results.filter((r: any) => !r.success);
    const response = {
      success: true,
      data: {
        addresses: normalizedAddresses,
        results: results,
        summary: {
          totalAddresses: normalizedAddresses.length,
          successful: successfulResults.length,
          failed: failedResults.length,
          stablecoins: ['USDC', 'WXDAI']
        }
      }
    };

    res.json(response);

  } catch (error: any) {  
    console.error('Erreur dans /api/rmm/v3:', error);
    res.status(500).json({
      error: 'Erreur lors du traitement des adresses',
      message: error.message
    });
  }
}

