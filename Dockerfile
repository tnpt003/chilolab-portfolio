FROM node:24-alpine AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY astro.config.mjs tsconfig.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY worker ./worker
RUN npm run verify
ARG RELEASE_ID=local
ENV RELEASE_ID=${RELEASE_ID}
RUN node scripts/write-release.mjs

FROM nginx:stable-alpine AS runtime
ARG RELEASE_ID=local
LABEL org.opencontainers.image.title="ChiloLab portfolio lab" \
      org.opencontainers.image.revision="${RELEASE_ID}"
COPY infra/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
