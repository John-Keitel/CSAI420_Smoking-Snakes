# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.18.0

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts

FROM dependencies AS builder
COPY . .
RUN APP_ENV=production \
    APP_LOG_LEVEL=info \
    STEDI_API_BASE_URL=https://dev.stedi.me \
    DATABASE_URL='postgresql://stedi:stedipassword@postgres:5432/postgres?schema=public' \
    DATABASE_DIRECT_URL='postgresql://stedi:stedipassword@postgres:5432/postgres?schema=public' \
    DATABASE_DEBUG=false \
    AUTH_SECRET=container-build-placeholder \
    NEXTAUTH_URL=http://localhost:3000 \
    AUTH_DEBUG=false \
    AUTH_TRUST_HOST=true \
    MAILER_FROM_EMAIL=team@stedi.com \
    MAILER_SMTP_HOST=mailpit \
    MAILER_SMTP_PORT=1025 \
    MAILER_SMTP_USERNAME=unused \
    MAILER_SMTP_PASSWORD=unused \
    MAILER_SMTP_ENCRYPTION=tls \
    npm run build

FROM dependencies AS migrate
CMD ["npm", "run", "db:sync"]

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --spider --quiet http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]
