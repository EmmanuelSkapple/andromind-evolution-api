FROM node:24-alpine AS builder

# 🧠 Dependencias necesarias para build + Chromium
RUN apk update && \
    apk add --no-cache git ffmpeg wget curl bash openssl \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont

LABEL version="2.3.1" description="API to control WhatsApp features through HTTP requests." 
LABEL maintainer="Davidson Gomes" git="https://github.com/DavidsonGomes"
LABEL contact="contato@evolution-api.com"

WORKDIR /evolution

COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY ./tsup.config.ts ./

# ⚙️ Instala dependencias sin descargar Chromium (lo provee el sistema)
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --silent

COPY ./src ./src
COPY ./public ./public
COPY ./prisma ./prisma
COPY ./manager ./manager
COPY ./.env.example ./.env
COPY ./runWithProvider.js ./
COPY ./Docker ./Docker

RUN chmod +x ./Docker/scripts/* && dos2unix ./Docker/scripts/*

RUN ./Docker/scripts/generate_database.sh
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# ================================
# 🔹 Etapa final
# ================================

FROM node:24-alpine AS final

RUN apk update && \
    apk add --no-cache tzdata ffmpeg bash openssl \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont

# 🧠 Variables para Puppeteer
ENV TZ=America/Sao_Paulo
ENV DOCKER_ENV=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROME_ARGS="--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu,--no-zygote,--disable-software-rasterizer"

WORKDIR /evolution

COPY --from=builder /evolution/package.json ./package.json
COPY --from=builder /evolution/package-lock.json ./package-lock.json
COPY --from=builder /evolution/node_modules ./node_modules
COPY --from=builder /evolution/dist ./dist
COPY --from=builder /evolution/prisma ./prisma
COPY --from=builder /evolution/manager ./manager
COPY --from=builder /evolution/public ./public
COPY --from=builder /evolution/.env ./.env
COPY --from=builder /evolution/Docker ./Docker
COPY --from=builder /evolution/runWithProvider.js ./runWithProvider.js
COPY --from=builder /evolution/tsup.config.ts ./tsup.config.ts

EXPOSE 8080

# 🚀 Lanza con Chromium disponible
ENTRYPOINT ["/bin/bash", "-c", ". ./Docker/scripts/deploy_database.sh && npm run start:prod" ]
