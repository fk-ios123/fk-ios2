FROM docker.io/library/node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --fetch-timeout=300000 --fetch-retries=3 --maxsockets=2
COPY server.js migrate-json.js ./
ENV NODE_ENV=production PORT=80
EXPOSE 80
CMD ["node", "server.js"]
