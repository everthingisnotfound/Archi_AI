FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the complete monorepo
COPY . .

# Install all workspace dependencies
RUN npm ci

# Generate Prisma client
RUN npm run db:generate

# Build packages required by the worker, then the worker itself
RUN npm run build:packages
RUN npm run build --workspace=@ai-archaeologist/worker

CMD ["npm", "run", "start", "--workspace=@ai-archaeologist/worker"]