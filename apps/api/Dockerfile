# Build from repo root: docker build -f apps/api/Dockerfile .
FROM node:22.11-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages/adapters ./packages/adapters
COPY packages/contracts ./packages/contracts
COPY packages/config ./packages/config
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @hs/contracts build \
  && pnpm --filter @hs/adapters build \
  && pnpm --filter @hs/api build

FROM node:22.11-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S hs && adduser -S hs -G hs
USER hs
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./node_modules
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=25s \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
