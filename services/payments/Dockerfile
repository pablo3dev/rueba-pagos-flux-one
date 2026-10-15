FROM node:24.22.0-alpine AS dev
RUN apk add --no-cache git \
  && git config --system --add safe.directory /app
WORKDIR /app

FROM node:24.22.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.base.json tsconfig.build.json ./
COPY src ./src
RUN npm ci
RUN npm run build
RUN rm -rf node_modules && npm ci --omit=dev

FROM node:24.22.0-alpine
RUN apk add --no-cache wget
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
USER node
EXPOSE 3002
CMD ["node", "dist/main.js"]
