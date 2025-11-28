# =============================================
# 🐍 Dockerfile - API Python
# Base: Debian 12 (Bookworm)
# =============================================
FROM python:3.11-slim-bookworm

LABEL maintainer="Shein Scraper Team"
LABEL description="Python FastAPI Service for Shein Scraper"

# =============================================
# 📦 Argumentos e Variáveis
# =============================================
ARG DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# =============================================
# 🔧 Instalação de Dependências do Sistema
# =============================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# =============================================
# 👤 Criar usuário não-root
# =============================================
RUN groupadd -r apiuser && useradd -r -g apiuser apiuser \
    && mkdir -p /app /home/apiuser \
    && chown -R apiuser:apiuser /app /home/apiuser

# =============================================
# 📁 Definir diretório de trabalho
# =============================================
WORKDIR /app

# =============================================
# 📥 Copiar arquivos de dependências
# =============================================
COPY --chown=apiuser:apiuser requirements.txt .

# =============================================
# 🔨 Instalar dependências Python
# =============================================
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# =============================================
# 📂 Copiar código da aplicação
# =============================================
COPY --chown=apiuser:apiuser . .

# =============================================
# 📊 Criar diretório de logs
# =============================================
RUN mkdir -p /app/logs && chown -R apiuser:apiuser /app/logs

# =============================================
# 🔐 Trocar para usuário não-root
# =============================================
USER apiuser

# =============================================
# 🚪 Expor porta
# =============================================
EXPOSE 8000

# =============================================
# 💊 Health check
# =============================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# =============================================
# 🚀 Comando de inicialização
# =============================================
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]