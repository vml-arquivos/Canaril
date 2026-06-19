# ============================================================================
# Build Stage
# ============================================================================
FROM node:22.13.0-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm@10.4.1

# Copiar manifestos e patches antes de instalar dependências
# O pnpm-lock.yaml referencia patches/wouter@3.7.1.patch; sem esta pasta o
# comando `pnpm install --frozen-lockfile` falhará em ambientes como o Coolify.
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

# Instalar pnpm
RUN npm install -g pnpm@10.4.1

# Instalar dumb-init para gerenciamento de processos
RUN apk add --no-cache dumb-init

# Copiar manifestos e patches para instalar apenas dependências de produção
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod

# Copiar build da stage anterior
COPY --from=builder /app/dist ./dist

# Copiar as migrations SQL para a imagem de produção. O runner de migrations
# (server/_core/migrate.ts) lê esses arquivos em runtime a partir de
# process.cwd() + drizzle/migrations — sem esta linha, o container sobe mas
# nunca aplica nenhuma migration (era a causa raiz do login quebrado).
COPY drizzle/migrations ./drizzle/migrations

# Criar diretório para logs
RUN mkdir -p /app/logs

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Usar dumb-init para iniciar a aplicação
ENTRYPOINT ["dumb-init", "--"]

# Comando de inicialização
CMD ["node", "dist/index.js"]
