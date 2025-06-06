# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json for all relevant workspaces to leverage Docker cache
COPY connector-service/package.json ./connector-service/
COPY marketplace-service/package.json ./marketplace-service/
COPY packages/connector-cli/package.json ./packages/connector-cli/
# Note: packages/connector-sdk/package.json and packages/ui/package.json were found not to exist

# Install all dependencies for the entire workspace
RUN pnpm install

# Copy the rest of the source code for connector-service
COPY connector-service ./connector-service/

# Transpile TypeScript to JavaScript for connector-service
WORKDIR /usr/src/app/connector-service
ENV PATH="/usr/src/app/node_modules/.bin:$PATH"
RUN tsc -p tsconfig.json # Or use pnpm run build if defined in connector-service/package.json

# Prune dev dependencies (optional, but good for smaller final image if not multi-stage)
# If this is the final stage for dev dependencies, this might be removed or adjusted.
# For a multi-stage build, this prune happens in the builder stage.
# RUN pnpm prune --prod # This would prune based on /usr/src/app/connector-service/package.json
# A workspace-aware prune would be `pnpm -r prune --prod` from the root, but that's complex here.
# For now, let's assume the final stage will copy only necessary production node_modules.
# So, we might not need to prune here if Stage 2 handles it.
# Let's keep it simple and assume Stage 2 copies from a clean prod install or specific artifacts.
# The `COPY --from=builder /usr/src/app/node_modules ./node_modules` in Stage 2
# should ideally be from a pruned set of node_modules.

# For now, let's remove the prune here as it might conflict with how Stage 2 copies node_modules.
# The build script should produce artifacts in `connector-service/dist`.

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /usr/src/app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy built application from the builder stage (specific to connector-service)
COPY --from=builder /usr/src/app/connector-service/dist ./dist
# Copy the connector-service's package.json for running the app
COPY --from=builder /usr/src/app/connector-service/package.json ./package.json
# Copy production node_modules (this needs to be handled carefully for workspaces)
# Ideally, pnpm creates a deployable package or we copy a pruned node_modules.
# For now, copying the entire root node_modules from builder.
COPY --from=builder /usr/src/app/node_modules ./node_modules
# If connector-service had its own isolated prod node_modules, we'd copy that:
# COPY --from=builder /usr/src/app/connector-service/node_modules ./node_modules

# Expose the application port
EXPOSE 3001

# Command to run the application
CMD ["node", "dist/server.js"]

# HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
#  CMD wget --quiet --tries=1 --spider http://localhost:3001/api/v1/health || exit 1
