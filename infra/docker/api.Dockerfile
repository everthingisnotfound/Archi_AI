FROM node:24-alpine AS base
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN npm install
RUN npm run db:generate
RUN npm run build --workspace @ai-archaeologist/config
RUN npm run build --workspace @ai-archaeologist/shared
RUN npm run build --workspace @ai-archaeologist/database
RUN npm run build --workspace @ai-archaeologist/api
COPY infra/docker/api-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["/entrypoint.sh"]

