FROM node:20-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Contabo VPS SIGBUS workaround: native SWC binary crashes on QEMU EPYC
# Remove native binary and install WASM fallback
RUN rm -rf node_modules/@next/swc-linux-x64-gnu node_modules/@next/swc-linux-x64-musl 2>/dev/null; \
    npm install --save-dev @next/swc-wasm-nodejs@14.2.5
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPID_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_VAPID_KEY=$NEXT_PUBLIC_VAPID_KEY
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
ENTRYPOINT ["tini", "--"]
CMD ["node", "server.mjs"]
