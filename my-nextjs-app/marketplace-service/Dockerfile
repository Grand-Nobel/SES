# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Copy root package.json and pnpm-lock.yaml to leverage Docker cache for dependencies
# Adjust path if your pnpm-workspace.yaml is at a different location or not used
COPY ../package.json ./
COPY ../pnpm-lock.yaml ./
# If you have a pnpm-workspace.yaml at the root of my-nextjs-app, copy it too
# COPY ../pnpm-workspace.yaml ./

# Copy marketplace-service specific package.json
COPY ./package.json ./marketplace-service/package.json

# Install dependencies for the marketplace-service only
# This assumes marketplace-service is a workspace defined in the root pnpm-workspace.yaml or package.json
RUN pnpm install --filter marketplace-service --prod --frozen-lockfile

# Copy the rest of the marketplace-service source code
COPY . ./marketplace-service/

# Copy shared tsconfig if applicable, or rely on the service's own tsconfig
# COPY ../tsconfig.base.json ./

# Build the marketplace-service
# Ensure your tsconfig.json paths are correct for the build context
RUN pnpm --filter marketplace-service exec tsc --build ./marketplace-service/tsconfig.json

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