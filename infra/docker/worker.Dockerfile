# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS base
RUN apk add --no-cache git
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN --mount=type=cache,target=/root/.npm npm ci
COPY packages packages
COPY apps/worker apps/worker
RUN npm run db:generate
RUN npm run build --workspace @ai-archaeologist/config
RUN npm run build --workspace @ai-archaeologist/shared
RUN npm run build --workspace @ai-archaeologist/database
RUN npm run build --workspace @ai-archaeologist/worker
COPY infra/docker/worker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 4100
ENTRYPOINT ["/entrypoint.sh"]
