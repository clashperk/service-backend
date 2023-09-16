FROM node:18-alpine As build

WORKDIR /app

COPY --chown=node:node package*.json ./

RUN npm ci

COPY --chown=node:node . .

ARG SERVICE_NAME
ENV SERVICE_NAME=$SERVICE_NAME

RUN npm run build $SERVICE_NAME

USER node

# ------ PRODUCTION BUILD ------
FROM node:18-alpine

WORKDIR /app

COPY --chown=node:node package*.json ./

ARG SERVICE_NAME
ENV SERVICE_NAME=$SERVICE_NAME

COPY --chown=node:node --from=build /app/dist/apps/$SERVICE_NAME ./dist

RUN npm ci --omit=dev

ENV NODE_ENV production

EXPOSE 8080
ENV PORT 8080

CMD [ "node", "dist/main.js" ]
