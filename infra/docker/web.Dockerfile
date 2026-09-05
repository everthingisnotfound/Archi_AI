FROM node:24-alpine AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web
RUN npm install
RUN npm run build --workspace @ai-archaeologist/config
RUN npm run build --workspace @ai-archaeologist/shared
RUN npm run build --workspace @ai-archaeologist/ui
RUN npm run build --workspace @ai-archaeologist/web

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/web.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
