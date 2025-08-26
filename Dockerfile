FROM node:22-alpine AS installer

RUN npm install -g pnpm

FROM installer AS build

WORKDIR /app

COPY --chown=node:node package*.json ./

RUN pnpm i

COPY --chown=node:node . .

RUN pnpm run build

USER node

FROM installer AS production

WORKDIR /app

COPY --chown=node:node package*.json ./

COPY --chown=node:node --from=build /app/dist ./dist

RUN pnpm i --prod

ENV NODE_ENV=production

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/src/main.js"]
