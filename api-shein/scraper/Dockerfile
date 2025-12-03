# =============================================
# 🕷️ Dockerfile - Scraper Node.js
# Base: Debian 12 (Bookworm)
# =============================================
FROM node:20-bookworm-slim

LABEL maintainer="Shein Scraper Team"
LABEL description="Node.js Scraper Service with Playwright"

# =============================================
# 📦 Argumentos e Variáveis
# =============================================
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
ENV PORT=3001

# =============================================
# 🔧 Instalação de Dependências do Sistema
# =============================================
RUN apt-get update && apt-get install -y \
    # Ferramentas básicas
    curl \
    wget \
    ca-certificates \
    gnupg \
    # Dependências do Playwright
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # Limpeza
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# =============================================
# 👤 Criar usuário não-root
# =============================================
RUN groupadd -r scraper && useradd -r -g scraper -G audio,video scraper \
    && mkdir -p /app /home/scraper/Downloads \
    && chown -R scraper:scraper /app /home/scraper

# =============================================
# 📁 Definir diretório de trabalho
# =============================================
WORKDIR /app

# =============================================
# 📥 Copiar arquivos de dependências
# =============================================
COPY --chown=scraper:scraper package*.json ./

# =============================================
# 🔨 Instalar dependências Node.js
# =============================================
RUN (npm ci --only=production --no-audit --no-fund || npm install --only=production --no-audit --no-fund) \
    && npm cache clean --force

# =============================================
# 📋 Instalar Playwright e navegadores
# =============================================
RUN npx playwright install chromium --with-deps

# =============================================
# 📂 Copiar código da aplicação
# =============================================
COPY --chown=scraper:scraper . .

# =============================================
# 📊 Criar diretório de logs
# =============================================
RUN mkdir -p /app/logs && chown -R scraper:scraper /app/logs

# =============================================
# 🔐 Trocar para usuário não-root
# =============================================
USER scraper

# =============================================
# 🚪 Expor porta
# =============================================
EXPOSE 3001

# =============================================
# 💊 Health check
# =============================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# =============================================
# 🚀 Comando de inicialização
# =============================================
CMD ["node", "index.js"]