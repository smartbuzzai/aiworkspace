FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPID_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_VAPID_KEY=$NEXT_PUBLIC_VAPID_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
