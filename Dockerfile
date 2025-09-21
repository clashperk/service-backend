FROM node:20-alpine as build

WORKDIR /app

COPY --chown=node:node package*.json ./

RUN npm ci

COPY --chown=node:node . .

RUN npm run build

USER node

# ------ PRODUCTION BUILD ------
FROM node:20-alpine

WORKDIR /app

COPY --chown=node:node package*.json ./

COPY --chown=node:node --from=build /app/dist ./dist

RUN npm ci --omit=dev

ENV NODE_ENV=production

EXPOSE 8081
ENV PORT=8081

CMD [ "node", "dist/src/main.js" ]
