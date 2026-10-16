# API + Telegram catalog bot for Railway / any Docker host
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts/fix-rxjs-tsconfig.mjs ./scripts/
# Need TypeScript (devDependency) to compile the API, then prune for runtime.
RUN npm ci

COPY tsconfig.api.json ./
COPY src/index.ts ./src/index.ts
COPY src/bot ./src/bot

RUN npm run build:api \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist-api/index.js"]
