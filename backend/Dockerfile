FROM node:24-alpine AS build
RUN npm install --global pnpm@10.28.0
ENV npm_config_store_dir=/pnpm-store
WORKDIR /repo
COPY . .
ARG SERVICE
RUN test -n "$SERVICE"
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --filter "${SERVICE}..."
RUN pnpm --filter "${SERVICE}..." build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm --filter "${SERVICE}" deploy --legacy --prod /out

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
