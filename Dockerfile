# syntax=docker/dockerfile:1

# Prisma needs openssl in every stage that touches the engine.
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# --- deps: install node_modules and generate the Prisma client ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --legacy-peer-deps --ignore-scripts
RUN npx prisma generate

# --- build: compile the Next.js app ---
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# --- runner: production image ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
EXPOSE 3000
# Apply any pending migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
