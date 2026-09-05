FROM node:24-alpine AS base
RUN apk add --no-cache git
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages packages
COPY apps/worker apps/worker
RUN npm install
RUN npm run db:generate
RUN npm run build --workspace @ai-archaeologist/config
RUN npm run build --workspace @ai-archaeologist/shared
RUN npm run build --workspace @ai-archaeologist/database
RUN npm run build --workspace @ai-archaeologist/worker
COPY infra/docker/worker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 4100
ENTRYPOINT ["/entrypoint.sh"]

