FROM node:24.22.0-alpine AS dev
RUN apk add --no-cache git \
  && git config --system --add safe.directory /app \
  && git config --system --add safe.directory /repo
WORKDIR /app

FROM node:24.22.0-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
RUN rm -rf node_modules && npm ci --omit=dev

FROM node:24.22.0-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
