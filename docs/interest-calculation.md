# Calcul des Intérêts RMM (Aave V3)

Cette documentation détaille la méthodologie utilisée pour calculer les intérêts de dépôt (Supply) et d'emprunt (Debt) au sein de l'application, en s'appuyant sur les données de l'historique des balances fournies par le sous-graphe RMM.

## Concepts Fondamentaux

L'implémentation repose sur le modèle de taux d'intérêt d'Aave V3, utilisé par RMM.

### 1. L'Index (Liquidity Index / Variable Debt Index)
L'index est une valeur cumulative qui représente la croissance de la valeur au fil du temps due aux intérêts. 
- Pour les déposants : **Liquidity Index**.
- Pour les emprunteurs : **Variable Debt Index**.

Il est exprimé en **RAY** ($10^{27}$).

### 2. Balance Scalée (Scaled Balance)
Pour optimiser les performances sur la blockchain, le solde des utilisateurs n'est pas mis à jour à chaque bloc. À la place, le protocole stocke une "balance scalée". 

$$Balance\ Réelle = \frac{Scaled\ Balance \times Index_{actuel}}{10^{27}}$$

La **Scaled Balance** ne change que lorsqu'un utilisateur effectue une action (dépôt, retrait, emprunt, remboursement). Les intérêts s'accumulent "automatiquement" via l'augmentation de l'index.

## Méthodologie de Calcul

Le service `thegraph-interest-calculator.ts` reconstruit l'historique des intérêts en itérant sur les points de données (snapshots) récupérés depuis TheGraph.

### Formule des Intérêts Périodiques

Pour calculer les intérêts générés entre deux snapshots (le snapshot précédent à $t-1$ et le snapshot actuel à $t$) :

$$Intérêts_{période} = \frac{Scaled\ Balance_{t-1} \times (Index_{t} - Index_{t-1})}{10^{27}}$$

> [!NOTE]
> On utilise la balance scalée **précédente** multipliée par la **croissance de l'index**. Cela garantit que nous calculons uniquement les intérêts générés par le capital qui était déjà présent avant le snapshot actuel.

### Identification des Mouvements de Capital

Lorsqu'un snapshot $t$ est enregistré avec une `Scaled Balance` différente de $t-1$, cela indique un mouvement de capital initié par l'utilisateur :

- **Si $Scaled\ Balance_{t} > Scaled\ Balance_{t-1}$** : L'utilisateur a ajouté du capital (Supply ou Borrow).
- **Si $Scaled\ Balance_{t} < Scaled\ Balance_{t-1}$** : L'utilisateur a retiré ou remboursé du capital (Withdraw ou Repay).

Le montant du mouvement en jeton sous-jacent est calculé ainsi :
$$Montant = \frac{|Scaled\ Balance_{t} - Scaled\ Balance_{t-1}| \times Index_{t}}{10^{27}}$$

## Détails d'Implémentation

### Traitement des données TheGraph

L'application récupère l'historique des balances via les schémas `atokenBalanceHistoryItems` et `vtokenBalanceHistoryItems`. Les champs clés utilisés sont :

- `timestamp` : Moment du snapshot.
- `scaledATokenBalance` / `scaledVariableDebt` : La balance "scalée".
- `currentATokenBalance` / `currentVariableDebt` : La balance réelle au moment du snapshot (utilisée pour vérification).
- `index` : L'index de réserve (Liquidity ou Variable Debt) au moment du snapshot.

### Fonctions Clés
- `calculateSupplyInterestFromBalances` : Traite les balances `atoken` pour calculer les intérêts de dépôt.
- `calculateDebtInterestFromBalances` : Traite les balances `vtoken` pour calculer les intérêts d'emprunt.

### Algorithme de Calcul
1. **Dédoublonnage journalier** : Le script groupe les snapshots par jour (`YYYYMMDD`) et ne conserve que le dernier snapshot de chaque journée pour construire une courbe quotidienne cohérente.
2. **Identification des mouvements** : Pour chaque jour, il compare le `scaledBalance` avec celui du jour précédent pour identifier les apports ou retraits de capital.
3. **Calcul des intérêts cumulés** : À chaque itération, les intérêts de la période sont calculés en appliquant la croissance de l'index sur la balance scalée du point précédent.
4. **Point "Aujourd'hui"** : Le script ajoute un point final basé sur le `balanceOf` actuel récupéré via RPC pour inclure les intérêts accumulés depuis le dernier snapshot TheGraph.

### Précision Mathématique
Tous les calculs utilisent le type `BigInt` de JavaScript pour manipuler les valeurs en Wei avec une précision absolue, en utilisant la constante `RAY` ($10^{27}$) pour les opérations d'index.

```typescript
const RAY = BigInt(10 ** 27);
const periodInterest = (previousScaledBalance * (currentIndex - previousIndex)) / RAY;
```
