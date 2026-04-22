FROM node:20-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci && \
    rm -rf node_modules/@next/swc-linux-x64-gnu node_modules/@next/swc-linux-x64-musl && \
    npm install @next/swc-wasm-nodejs@14.2.5
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPID_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_VAPID_KEY=$NEXT_PUBLIC_VAPID_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN ls node_modules/@next/ && npx next build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
