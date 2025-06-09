# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY server/src ./src
COPY server/tsconfig.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown -R appuser:nodejs logs

# Switch to non-root user
USER appuser

# Memory optimization environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1536 --optimize-for-size --expose-gc"
ENV LOG_LEVEL=warn

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Use dumb-init to handle signals properly and start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
