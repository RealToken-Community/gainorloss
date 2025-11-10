# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy dependencies and application code
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs backend/ .
# Copy utils directory from root to /utils (needed by backend services)
# The path ../../utils/constants from backend/services/ points to /utils/constants
COPY --chown=nodejs:nodejs utils/ /utils/

USER nodejs

EXPOSE 3001

ENV PORT 3001

CMD ["node", "server.js"]

