import type { NextApiRequest, NextApiResponse } from 'next';
import { retrieveInterestAndTransactionsForAllTokensV2 } from '../../../../lib/services/thegraph-interest-calculator-v2';

/**
 * @route GET /api/rmm/v2/:address1/:address2?/:address3?
 * @desc Endpoint V2 qui utilise TheGraph pour récupérer les données (WXDAI uniquement)
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
    
    // Validation des adresses
    for (const address of addressArray) {
      if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          error: 'Adresse invalide',
          message: 'Toutes les adresses doivent être des adresses Ethereum valides (0x...)',
          invalidAddress: address
        });
      }
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
    for (const address of addressArray) {
      if (typeof address !== 'string') continue;
      try { 
        // Utiliser directement TheGraph V2 pour récupérer les intérêts
        const interestanddataResults = await retrieveInterestAndTransactionsForAllTokensV2(address, req);

        // Récupérer les transactions depuis les résultats
        const { transactions, ...interestResult } = interestanddataResults;

        // Convertir le format pour compatibilité frontend
        const frontendCompatibleData = {
          address,
          // Format V3 compatible
          interests: {
            WXDAI: {
              token: 'WXDAI',
              borrow: {
                totalInterest: interestResult.borrow.totalInterest,
                dailyDetails: interestResult.borrow.dailyDetails
              },
              supply: {
                totalInterest: interestResult.supply.totalInterest,
                dailyDetails: interestResult.supply.dailyDetails
              },
              summary: {
                totalBorrowInterest: interestResult.borrow.totalInterest,
                totalSupplyInterest: interestResult.supply.totalInterest,
                netInterest: (BigInt(interestResult.supply.totalInterest) - BigInt(interestResult.borrow.totalInterest)).toString()
              }
            }
          },
          transactions: transactions,
        };
        results.push({ 
          address, 
          success: true, 
          data: frontendCompatibleData
        });
      } catch (error: any) {     
        console.error(`Erreur pour l'adresse V2 ${address}:`, error);
        results.push({ 
          address, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successfulResults = results.filter((r: any) => r.success);
    const failedResults = results.filter((r: any) => !r.success);

    // Format de réponse compatible frontend (même structure que V3)
    const response = {
      success: true,
      data: {
        addresses: addressArray,
        results: results,
        summary: {
          totalAddresses: addressArray.length,
          successful: successfulResults.length,
          failed: failedResults.length,
          stablecoins: ['WXDAI'], // V2: seulement WXDAI
          version: 'v2'
        }
      }
    };

    res.json(response);

  } catch (error: any) {
    console.error('Erreur dans /api/rmm/v2:', error);
    res.status(500).json({
      error: 'Erreur lors du traitement des adresses V2',
      message: error.message
    });
  }
}

