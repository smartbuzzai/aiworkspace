FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
