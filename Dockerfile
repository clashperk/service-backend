FROM node:22-alpine AS nodejs

WORKDIR /app

FROM nodejs AS installer

RUN npm install -g pnpm@10.26.2

FROM installer AS builder

# Which monorepo app to build: "api" or "worker".
ARG APP=api

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm i

COPY --chown=node:node . .

# Generate barrel indexes (the `prebuild` script), then build only the requested app.
RUN pnpm run prebuild
RUN pnpm exec nest build ${APP}

USER node

FROM installer AS pruner

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm i --prod

FROM nodejs

ARG APP=api
ARG GIT_SHA
ENV APP=${APP}
ENV GIT_SHA=${GIT_SHA}
ENV NODE_ENV=production
ENV NODE_OPTIONS="--trace-warnings --enable-source-maps"

# The builder only built ${APP}, so dist holds just that app + dist/libs.
# Rename the app folder to the constant "app" so the runtime path has no api/worker
# name and no build variable. Depth is preserved (apps/app/src), so main.js's
# baked-in require("../../../libs") and the .js.map source maps still resolve.
COPY --chown=node:node --from=builder /app/dist/libs ./dist/libs
COPY --chown=node:node --from=builder /app/dist/apps/${APP} ./dist/apps/app
COPY --chown=node:node --from=pruner /app/node_modules ./node_modules
COPY --chown=node:node --from=pruner /app/package*.json ./

EXPOSE 8080 8090

# Static entry path (no api/worker name, no build var). exec form -> node is PID 1.
CMD ["node", "dist/apps/app/src/main.js"]
