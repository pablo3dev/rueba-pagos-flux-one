FROM node:24.22.0-alpine AS dev
RUN apk add --no-cache git \
  && git config --system --add safe.directory /app
WORKDIR /app

FROM node:24.22.0-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci --workspace=services/auth --include-workspace-root
RUN npm run build -w services/auth
RUN rm -rf node_modules && npm ci --omit=dev --workspace=services/auth --include-workspace-root=false

FROM node:24.22.0-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/services/auth/package.json ./services/auth/package.json
COPY --from=build /app/services/auth/dist ./services/auth/dist
COPY --from=build /app/services/auth/migrations ./services/auth/migrations
USER node
EXPOSE 3001
CMD ["node","services/auth/dist/main.js"]
