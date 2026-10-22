FROM node:24-alpine AS build
RUN npm install --global pnpm@10.28.0
ENV npm_config_store_dir=/pnpm-store
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --filter "webapp..."
RUN pnpm --filter webapp build

FROM node:24-alpine
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/webapp/.next/standalone ./
COPY --from=build --chown=node:node /repo/webapp/.next/static ./webapp/.next/static
COPY --from=build --chown=node:node /repo/webapp/public ./webapp/public
USER node
EXPOSE 3000
CMD ["node", "webapp/server.js"]
