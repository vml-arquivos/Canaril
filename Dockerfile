# ============================================================================
# Build Stage
# ============================================================================
FROM node:22.13.0-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm@10.4.1

# Copiar manifestos e patches antes do pnpm install.
# O pnpm-lock.yaml referencia patches/wouter@3.7.1.patch; sem esta pasta
# o deploy em Coolify quebra no --frozen-lockfile.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build da aplicação
RUN pnpm build

# ============================================================================
# Runtime Stage
# ============================================================================
FROM node:22.13.0-alpine

WORKDIR /app
ENV NODE_ENV=production

# Instalar pnpm
RUN npm install -g pnpm@10.4.1

# Instalar dumb-init para gerenciamento de processos e wget para healthcheck
RUN apk add --no-cache dumb-init wget

# Copiar manifestos e patches para instalar apenas dependências de produção
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod

# Copiar build da stage anterior
COPY --from=builder /app/dist ./dist

# Criar diretório para logs
RUN mkdir -p /app/logs

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Usar dumb-init para iniciar a aplicação
ENTRYPOINT ["dumb-init", "--"]

# Comando de inicialização
CMD ["node", "dist/index.js"]
