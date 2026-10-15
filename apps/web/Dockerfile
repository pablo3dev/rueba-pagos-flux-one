FROM node:24.22.0-alpine AS dev
RUN apk add --no-cache git \
  && git config --system --add safe.directory /app
WORKDIR /app

FROM node:24.22.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.30.6-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV AUTH_UPSTREAM=host.docker.internal:3001 \
    PAYMENTS_UPSTREAM=host.docker.internal:3002 \
    AUDIT_UPSTREAM=host.docker.internal:3003
EXPOSE 80
