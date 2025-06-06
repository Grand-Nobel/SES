# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Copy root package.json and pnpm-lock.yaml to leverage Docker cache for dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package.json files for all workspaces
COPY connector-service/package.json ./connector-service/
COPY marketplace-service/package.json ./marketplace-service/
COPY packages/connector-cli/package.json ./packages/connector-cli/
COPY packages/connector-sdk/package.json ./packages/connector-sdk/

# Install all dependencies for the entire workspace
RUN pnpm install

# Copy the rest of the source code for marketplace-service
COPY marketplace-service ./marketplace-service/

# Copy shared tsconfig if applicable, or rely on the service's own tsconfig
# COPY ../tsconfig.base.json ./

# Build the marketplace-service
# Ensure your tsconfig.json paths are correct for the build context
WORKDIR /usr/src/app/marketplace-service
ENV PATH="/usr/src/app/node_modules/.bin:$PATH"
RUN tsc --build tsconfig.json

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /usr/src/app

# Copy only necessary files from the builder stage
COPY --from=builder /usr/src/app/marketplace-service/dist ./dist
COPY --from=builder /usr/src/app/marketplace-service/package.json ./package.json
COPY --from=builder /usr/src/app/node_modules ./node_modules
# If marketplace-service has its own node_modules from the filtered install, copy that instead
# COPY --from=builder /usr/src/app/marketplace-service/node_modules ./node_modules


# Expose the port the app runs on
EXPOSE 3005

# Set environment variables (can be overridden by docker-compose)
ENV NODE_ENV=production
ENV PORT=3005

# Command to run the application
CMD ["node", "dist/server.js"]
