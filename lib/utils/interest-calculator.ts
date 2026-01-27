/**
 * Utilitaire pour calculer les intérêts sur une période avec interpolation
 *
 * Le totalInterest est cumulatif depuis le début.
 * Pour obtenir les intérêts d'une période:
 *   intérêts = totalInterest(fin) - totalInterest(début)
 *
 * Si les dates de début/fin ne correspondent pas à des points existants,
 * on interpole linéairement entre les points adjacents.
 */

interface DailyDetail {
  date: string;           // Format YYYYMMDD
  timestamp: number;
  debt?: string;
  supply?: string;
  periodInterest: string;
  totalInterest: string;
  transactionAmount?: string;
  transactionType?: string;
}

interface InterpolatedPoint {
  timestamp: number;
  balance: number;
  totalInterest: number;
  isInterpolated: boolean;
}

/**
 * Convertit une date YYYYMMDD ou YYYY-MM-DD en timestamp (début de journée)
 */
export function dateToTimestamp(date: string): number {
  // Normaliser le format
  const normalized = date.replace(/-/g, '');
  const year = parseInt(normalized.substring(0, 4));
  const month = parseInt(normalized.substring(4, 6)) - 1;
  const day = parseInt(normalized.substring(6, 8));

  const d = new Date(year, month, day, 0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Convertit un timestamp en date YYYYMMDD
 */
export function timestampToDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Trouve le point précédent et suivant pour une date donnée
 */
function findSurroundingPoints(
  dailyDetails: DailyDetail[],
  targetTimestamp: number,
  balanceKey: 'debt' | 'supply'
): { before: DailyDetail | null; after: DailyDetail | null; exact: DailyDetail | null } {
  if (dailyDetails.length === 0) {
    return { before: null, after: null, exact: null };
  }

  // Trier par timestamp
  const sorted = [...dailyDetails].sort((a, b) => a.timestamp - b.timestamp);

  let before: DailyDetail | null = null;
  let after: DailyDetail | null = null;
  let exact: DailyDetail | null = null;

  for (const point of sorted) {
    const pointDate = timestampToDate(point.timestamp);
    const targetDate = timestampToDate(targetTimestamp);

    if (pointDate === targetDate) {
      exact = point;
      break;
    } else if (point.timestamp < targetTimestamp) {
      before = point;
    } else if (point.timestamp > targetTimestamp && !after) {
      after = point;
      break;
    }
  }

  return { before, after, exact };
}

/**
 * Interpole linéairement un point entre deux points existants
 */
function interpolatePoint(
  before: DailyDetail,
  after: DailyDetail,
  targetTimestamp: number,
  balanceKey: 'debt' | 'supply'
): InterpolatedPoint {
  const timeDiff = after.timestamp - before.timestamp;
  const targetDiff = targetTimestamp - before.timestamp;
  const ratio = timeDiff > 0 ? targetDiff / timeDiff : 0;

  const beforeBalance = parseFloat(before[balanceKey] || '0');
  const afterBalance = parseFloat(after[balanceKey] || '0');
  const beforeTotalInterest = parseFloat(before.totalInterest || '0');
  const afterTotalInterest = parseFloat(after.totalInterest || '0');

  return {
    timestamp: targetTimestamp,
    balance: beforeBalance + (afterBalance - beforeBalance) * ratio,
    totalInterest: beforeTotalInterest + (afterTotalInterest - beforeTotalInterest) * ratio,
    isInterpolated: true
  };
}

/**
 * Obtient un point (réel ou interpolé) pour une date donnée
 */
export function getPointAtDate(
  dailyDetails: DailyDetail[],
  targetDate: string,
  balanceKey: 'debt' | 'supply'
): InterpolatedPoint | null {
  if (dailyDetails.length === 0) return null;

  const targetTimestamp = dateToTimestamp(targetDate);
  const { before, after, exact } = findSurroundingPoints(dailyDetails, targetTimestamp, balanceKey);

  // Cas 1: Point exact trouvé
  if (exact) {
    return {
      timestamp: exact.timestamp,
      balance: parseFloat(exact[balanceKey] || '0'),
      totalInterest: parseFloat(exact.totalInterest || '0'),
      isInterpolated: false
    };
  }

  // Cas 2: Date avant le premier point -> utiliser le premier point (balance = 0 avant)
  if (!before && after) {
    return {
      timestamp: targetTimestamp,
      balance: 0,
      totalInterest: 0,
      isInterpolated: true
    };
  }

  // Cas 3: Date après le dernier point -> utiliser le dernier point
  if (before && !after) {
    return {
      timestamp: targetTimestamp,
      balance: parseFloat(before[balanceKey] || '0'),
      totalInterest: parseFloat(before.totalInterest || '0'),
      isInterpolated: true
    };
  }

  // Cas 4: Date entre deux points -> interpoler
  if (before && after) {
    return interpolatePoint(before, after, targetTimestamp, balanceKey);
  }

  return null;
}

/**
 * Calcule les intérêts pour une période donnée
 *
 * @param dailyDetails - Les détails journaliers avec totalInterest cumulatif
 * @param startDate - Date de début (format YYYY-MM-DD ou YYYYMMDD)
 * @param endDate - Date de fin (format YYYY-MM-DD ou YYYYMMDD)
 * @param balanceKey - 'debt' ou 'supply'
 * @returns Les intérêts de la période (en wei/unité brute)
 */
export function calculatePeriodInterest(
  dailyDetails: DailyDetail[],
  startDate: string,
  endDate: string,
  balanceKey: 'debt' | 'supply'
): { interest: number; startPoint: InterpolatedPoint | null; endPoint: InterpolatedPoint | null } {
  if (dailyDetails.length === 0) {
    return { interest: 0, startPoint: null, endPoint: null };
  }

  const startPoint = getPointAtDate(dailyDetails, startDate, balanceKey);
  const endPoint = getPointAtDate(dailyDetails, endDate, balanceKey);

  if (!startPoint || !endPoint) {
    return { interest: 0, startPoint, endPoint };
  }

  // Intérêts = totalInterest(fin) - totalInterest(début)
  const interest = endPoint.totalInterest - startPoint.totalInterest;

  return {
    interest: Math.max(0, interest), // Les intérêts ne peuvent pas être négatifs
    startPoint,
    endPoint
  };
}

/**
 * Calcule la balance de départ pour une période
 * Utilisé pour créer le point synthétique sur les graphiques
 */
export function calculateStartBalance(
  dailyDetails: DailyDetail[],
  startDate: string,
  balanceKey: 'debt' | 'supply'
): { balance: number; isInterpolated: boolean } | null {
  const point = getPointAtDate(dailyDetails, startDate, balanceKey);
  if (!point) return null;

  return {
    balance: point.balance,
    isInterpolated: point.isInterpolated
  };
}
