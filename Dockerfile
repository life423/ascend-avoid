# Stage 1: Install dependencies and build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools that some npm packages might need
RUN apk add --no-cache python3 make g++ && \
    ln -sf python3 /usr/bin/python

# Copy all package.json files to install dependencies
# We do this first to leverage Docker's layer caching
COPY package*.json ./
COPY server/package*.json ./server/

# Install the two independent lockfiles; this project is not an npm workspace.
RUN npm ci && npm ci --prefix server

# Copy the entire project
COPY . .

# Build the client (Vite) and server (TypeScript)
RUN npm run build

# Keep build tools in this stage; only production server dependencies ship below.
RUN npm prune --omit=dev --prefix server && npm cache clean --force

# Stage 2: Create the production image
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# The browser bundle is self-contained. Node resolves the server's runtime
# dependencies from server/node_modules; client/build dependencies stay behind.
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/server/package*.json ./server/
COPY --from=builder --chown=nodejs:nodejs /app/server/node_modules ./server/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/server/dist ./server/dist

# Switch to non-root user
USER nodejs

# Expose the correct production port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Use dumb-init to properly handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start the production server
CMD ["node", "server/dist/index.js"]
