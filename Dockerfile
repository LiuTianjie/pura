# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY client ./client
COPY server ./server
COPY tsconfig.json vite.config.ts ./
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV ROLE=hub
ENV HOST=0.0.0.0
ENV PORT=8787

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY README.md LICENSE ./

EXPOSE 8787
CMD ["node", "server/dist/index.js"]
