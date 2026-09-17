# --- Base Build Stage ---
FROM node:22-alpine AS builder
ARG NODE_ENV=production
ARG BASE_URL
ARG API_BASE_URL
ARG DISCORD_REDIRECT_URI
WORKDIR /app
ENV NODE_ENV=${NODE_ENV}
ENV BASE_URL=${BASE_URL}
ENV API_BASE_URL=${API_BASE_URL}
ENV DISCORD_REDIRECT_URI=${DISCORD_REDIRECT_URI}
ENV VITE_API_BASE_URL=${API_BASE_URL}

# Copy root config and all package manifests
COPY . .

# Install all dependencies
RUN npm install --include=dev
RUN npm install -g serve @sern/cli

RUN npm run database:generate
RUN npm run database:db-push
RUN npm run build

# --- API Production Stage ---
FROM node:22-alpine AS api
WORKDIR /app
COPY --from=builder /app /app
CMD ["npm", "run", "api:start"]

# --- Bot Production Stage ---
FROM node:22-alpine AS bot
WORKDIR /app
COPY --from=builder /app /app
CMD ["npm", "run", "bot:start"]

# --- Dashboard Production Stage ---
FROM node:22-alpine AS dash
WORKDIR /app
COPY --from=builder /app/apps/dash/dist /app/dist
RUN npm install -g serve
CMD ["serve", "-s", "/app/dist", "-l", "8990"]
