# --- Base Build Stage ---
FROM node:22-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production

# Copy root config and all package manifests
COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY apps/database/package.json ./apps/database/
COPY apps/api/package.json ./apps/api/
COPY apps/bot/package.json ./apps/bot/
COPY apps/dash/package.json ./apps/dash/
COPY .env ./

# Install all dependencies
RUN npm install --include=dev
RUN npm install -g @sern/cli
RUN npm install -D prisma

# Copy source code
COPY packages/ ./packages/
COPY apps/database/ ./apps/database/
COPY apps/api/ ./apps/api/
COPY apps/bot/ ./apps/bot/
COPY apps/dash/ ./apps/dash/

# Build shared packages
RUN npm run config:build
RUN npm run types:build

# Generate Prisma Client (Done ONCE here)
RUN npm run database:generate
RUN npm run database:db-push

# Build apps
RUN npm run api:build
RUN npm run bot:build
RUN npm run dash:build

# --- API Production Stage ---
FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 8989
CMD ["npm", "run", "api:start"]

# --- Bot Production Stage ---
FROM node:22-alpine AS bot
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
CMD ["npm", "run", "bot:start"]

# --- Dashboard Production Stage ---
FROM node:22-alpine AS dash
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 8990
CMD ["npm", "run", "dash:preview"]
