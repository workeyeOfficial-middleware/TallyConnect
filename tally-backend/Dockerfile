# syntax=docker/dockerfile:1

FROM node:20-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

FROM node:20-slim AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app .

RUN addgroup --system app && adduser --system --group app
USER app

EXPOSE 4000

CMD ["node", "server.js"]

