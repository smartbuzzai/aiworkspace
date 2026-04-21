FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini curl
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1
