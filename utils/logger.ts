/**
 * Système de logging personnalisé avec niveaux pour application web
 * Les logs apparaissent dans le terminal (serveur) et la console navigateur (client)
 * Contrôlable via LOG_LEVEL dans .env (debug, info, warn, error)
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Détecter si on est côté serveur (Node.js) ou client (navigateur)
const isServer = typeof window === 'undefined';

// Lire le niveau de log depuis les variables d'environnement
// LOG_LEVEL peut être défini dans .env (debug, info, warn, error)
// Par défaut: debug en dev, warn en production
const envLogLevel = (process.env.LOG_LEVEL || process.env.NEXT_PUBLIC_LOG_LEVEL || '').toLowerCase() as LogLevel;
const isProduction = process.env.NODE_ENV === 'production';

// Déterminer le niveau de log actuel
let currentLogLevel: LogLevel;
if (envLogLevel && LOG_LEVELS[envLogLevel] !== undefined) {
  // Si LOG_LEVEL est défini dans .env, l'utiliser
  currentLogLevel = envLogLevel;
} else {
  // Sinon, utiliser les valeurs par défaut
  currentLogLevel = isProduction ? 'warn' : 'debug';
}

/**
 * Masque les données sensibles dans les logs (uniquement en production)
 */
function sanitizeData(data: any): any {
  if (!isProduction) return data; // En dev, ne pas masquer pour faciliter le debug
  
  if (typeof data === 'string') {
    return data
      .replace(/(api[_-]?key|apikey|secret|token|password|passwd)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{10,})['"]?/gi, '$1=***MASKED***')
      .replace(/['"]?[a-fA-F0-9]{32,}['"]?/g, (match) => {
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
  return args.map(sanitizeData);
}

/**
 * Log dans le terminal (serveur) ET la console navigateur (client)
 */
function logToTerminal(level: string, ...args: any[]): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  
  if (isServer) {
    // Côté serveur : log dans le terminal
    const formatted = formatArgs(...args);
    if (level === 'ERROR') {
      console.error(prefix, ...formatted);
    } else if (level === 'WARN') {
      console.warn(prefix, ...formatted);
    } else {
      console.log(prefix, ...formatted);
    }
  } else {
    // Côté client : log dans la console navigateur
    const formatted = formatArgs(...args);
    if (level === 'ERROR') {
      console.error(`[${level}]`, ...formatted);
    } else if (level === 'WARN') {
      console.warn(`[${level}]`, ...formatted);
    } else {
      console.log(`[${level}]`, ...formatted);
    }
  }
}

/**
 * Logger personnalisé avec niveaux contrôlables via LOG_LEVEL dans .env
 */
export const logger = {
  error: (...args: any[]) => {
    if (LOG_LEVELS[currentLogLevel] >= LOG_LEVELS.error) {
      logToTerminal('ERROR', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (LOG_LEVELS[currentLogLevel] >= LOG_LEVELS.warn) {
      logToTerminal('WARN', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (LOG_LEVELS[currentLogLevel] >= LOG_LEVELS.info) {
      logToTerminal('INFO', ...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (LOG_LEVELS[currentLogLevel] >= LOG_LEVELS.debug) {
      logToTerminal('DEBUG', ...args);
    }
  },
};

export default logger;
