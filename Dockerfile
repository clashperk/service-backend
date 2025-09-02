FROM node:22-alpine AS nodejs

WORKDIR /app

FROM nodejs AS installer

RUN npm install -g pnpm

FROM installer AS builder

COPY --chown=node:node package*.json ./

RUN pnpm i

COPY --chown=node:node . .

RUN pnpm run build

USER node

FROM installer AS pruner

COPY --chown=node:node package*.json ./

RUN pnpm i --prod

FROM nodejs

COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=pruner /app/node_modules ./node_modules
COPY --chown=node:node --from=pruner /app/package*.json ./

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/src/main.js"]
