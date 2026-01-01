/**
 * Système de logging personnalisé avec niveaux pour application web
 * Empêche la surcharge du navigateur et la fuite de données sensibles
 * 
 * Niveaux :
 * - error : Erreurs critiques uniquement
 * - warn : Avertissements et erreurs
 * - info : Informations importantes (limité en production)
 * - debug : Tous les logs (développement uniquement)
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// En production, limiter les logs pour ne pas surcharger le navigateur
// En développement, permettre tous les logs
const isProduction = process.env.NODE_ENV === 'production';
const isClient = typeof window !== 'undefined';

// Niveau de log selon l'environnement
// Client (navigateur) : limiter en production pour ne pas surcharger
// Serveur (API routes) : plus permissif mais toujours sécurisé
const currentLogLevel: LogLevel = isProduction 
  ? (isClient ? 'error' : 'warn')  // Client: seulement erreurs, Serveur: warnings+
  : 'debug';                        // Dev: tous les logs

/**
 * Masque les données sensibles dans les logs
 */
function sanitizeData(data: any): any {
  if (typeof data === 'string') {
    // Masquer les clés API (patterns communs)
    return data
      .replace(/(api[_-]?key|apikey|secret|token|password|passwd)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{10,})['"]?/gi, '$1=***MASKED***')
      .replace(/['"]?[a-fA-F0-9]{32,}['"]?/g, (match) => {
        // Masquer les tokens longs (probablement des clés)
        if (match.length > 40) return '***MASKED***';
        return match;
      });
  }
  
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(sanitizeData);
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      // Masquer les champs sensibles
      if (lowerKey.includes('key') || lowerKey.includes('secret') || 
          lowerKey.includes('token') || lowerKey.includes('password') ||
          lowerKey.includes('api')) {
        sanitized[key] = '***MASKED***';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Formate les arguments pour le logging
 */
function formatArgs(...args: any[]): any[] {
  if (isProduction) {
    return args.map(sanitizeData);
  }
  return args;
}

/**
 * Logger personnalisé avec niveaux adaptés pour application web
 * Réduit la charge sur le navigateur en production
 */
export const logger = {
  error: (...args: any[]) => {
    if (LOG_LEVELS[currentLogLevel] >= LOG_LEVELS.error) {
      console.error('[ERROR]', ...formatArgs(...args));
    }
  },
  
  warn: (...args: any[]) => {
    if (LOG_LEVELS[currentLogLevel] >= LOG_LEVELS.warn) {
      console.warn('[WARN]', ...formatArgs(...args));
    }
  },
  
  info: (...args: any[]) => {
    if (LOG_LEVELS[currentLogLevel] >= LOG_LEVELS.info) {
      console.log('[INFO]', ...formatArgs(...args));
    }
  },
  
  debug: (...args: any[]) => {
    if (LOG_LEVELS[currentLogLevel] >= LOG_LEVELS.debug) {
      console.log('[DEBUG]', ...formatArgs(...args));
    }
  },
};

export default logger;

