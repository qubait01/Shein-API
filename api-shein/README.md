# 🛒 Shein Scraper - Arquitetura Completa

Sistema completo de scraping para carrinhos Shein com arquitetura microserviços.

## 📋 Índice

- [Arquitetura](#-arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Uso](#-uso)
- [API Endpoints](#-api-endpoints)
- [Desenvolvimento](#-desenvolvimento)
- [Troubleshooting](#-troubleshooting)

## 🏗️ Arquitetura

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│   API Python        │ :8000
│   (FastAPI)         │
│   - Orquestração    │
│   - Cache (Redis)   │
│   - Validação       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Scraper Node.js    │ :3001
│  (Express)          │
│  - Scraping logic   │
│  - Playwright       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Browserless       │ :3000
│   (Chrome)          │
│   - Browser pool    │
│   - Headless Chrome │
└─────────────────────┘
```

### Componentes

1. **API Python (FastAPI)** - Porta 8000
   - Interface principal HTTP
   - Gerenciamento de cache com Redis
   - Validação de dados
   - Documentação automática (Swagger)

2. **Scraper Node.js** - Porta 3001
   - Execução do scraping
   - Playwright para automação
   - Extração de produtos

3. **Browserless** - Porta 3000
   - Pool de navegadores Chrome
   - Gerenciamento de sessões
   - Otimizado para performance

4. **Redis** - Porta 6379
   - Cache de resultados
   - TTL configurável (padrão: 1h)

## 📦 Pré-requisitos

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Make** (opcional, mas recomendado)
- **Git**

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd shein-scraper
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` conforme necessário:

```bash
BROWSERLESS_TOKEN=mysecrettoken123
CACHE_TTL=3600
LOG_LEVEL=info
```

### 3. Build e inicialização

#### Usando Make (recomendado):

```bash
# Ver comandos disponíveis
make help

# Buildar e subir tudo
make build
make up

# Ou em um comando
make rebuild
```

#### Usando Docker Compose diretamente:

```bash
# Buildar imagens
docker-compose build

# Subir containers
docker-compose up -d

# Ver logs
docker-compose logs -f
```

## 🎯 Uso

### Verificar se está funcionando

```bash
# Health check da API
curl http://localhost:8000/health

# Health check do Scraper
curl http://localhost:3001/health

# Ou usando Make
make test
```

### Fazer scraping

#### Via cURL:

```bash
# POST (recomendado)
curl -X POST http://localhost:8000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://m.shein.com/cart-share?..."}'

# GET (para testes rápidos)
curl "http://localhost:8000/api/scrape?url=https://m.shein.com/cart-share?..."
```

#### Via Python:

```python
import requests

response = requests.post(
    'http://localhost:8000/api/scrape',
    json={'url': 'https://m.shein.com/cart-share?...'}
)

data = response.json()
print(f"Status: {data['status']}")
print(f"Produtos encontrados: {data['count']}")
```

#### Via JavaScript:

```javascript
fetch('http://localhost:8000/api/scrape', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://m.shein.com/cart-share?...'
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## 📍 API Endpoints

### API Principal (Python) - `http://localhost:8000`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Informações do serviço |
| GET | `/health` | Health check completo |
| GET | `/docs` | Documentação Swagger |
| POST | `/api/scrape` | Fazer scraping (body JSON) |
| GET | `/api/scrape?url=...` | Fazer scraping (query param) |
| GET | `/api/stats` | Estatísticas do cache |
| DELETE | `/api/cache/{url}` | Limpar cache de URL específica |
| DELETE | `/api/cache` | Limpar todo o cache |

### Scraper (Node.js) - `http://localhost:3001`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |
| POST | `/scrape` | Scraping direto |
| GET | `/scrape?url=...` | Scraping direto (GET) |
| GET | `/test-connection` | Testar conexão Browserless |

## 🔧 Desenvolvimento

### Estrutura de pastas

```
shein-scraper/
├── api/                    # Serviço Python
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app.py
├── scraper/               # Serviço Node.js
│   ├── Dockerfile
│   ├── package.json
│   └── index.js
├── docker-compose.yml
├── .env
├── Makefile
└── README.md
```

### Logs

```bash
# Ver logs de todos os serviços
make logs

# Logs específicos
make logs-api
make logs-scraper
make logs-browserless

# Ou com docker-compose
docker-compose logs -f api
```

### Acessar containers

```bash
# Shell no container da API
make shell-api

# Shell no container do Scraper
make shell-scraper

# Ou com docker-compose
docker-compose exec api /bin/bash
docker-compose exec scraper /bin/sh
```

### Desenvolvimento local (sem Docker)

#### API Python:

```bash
cd api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

#### Scraper Node.js:

```bash
cd scraper
npm install
npm start
```

## 🧹 Manutenção

### Limpar cache

```bash
# Via API
curl -X DELETE http://localhost:8000/api/cache

# Via Make
make cache-clear
```

### Ver estatísticas

```bash
# Via API
curl http://localhost:8000/api/stats

# Via Make
make cache-stats
```

### Reiniciar serviços

```bash
# Reiniciar tudo
make restart

# Reiniciar apenas um serviço
docker-compose restart api
docker-compose restart scraper
```

### Limpar tudo e recomeçar

```bash
make clean
make build
make up
```

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs
docker-compose logs <nome-do-servico>

# Verificar status
docker-compose ps
```

### Erro de conexão com Browserless

```bash
# Verificar se Browserless está rodando
curl http://localhost:3000/pressure

# Testar conexão
curl http://localhost:3001/test-connection
```

### Cache não funciona

```bash
# Verificar Redis
docker-compose exec redis redis-cli ping

# Ver estatísticas
curl http://localhost:8000/api/stats
```

### Scraping falhando

```bash
# Ver logs do scraper
docker-compose logs -f scraper

# Screenshots de debug ficam em:
docker-compose exec scraper ls -la /app/logs
```

## 📊 Monitoramento

### Ver uso de recursos

```bash
make stats
```

### Health checks

```bash
# Todos os serviços
curl http://localhost:8000/health | jq

# Status detalhado
{
  "status": "healthy",
  "service": "Shein Scraper API",
  "version": "2.0.0",
  "services": {
    "scraper": "healthy",
    "redis": "healthy"
  }
}
```

## 🚀 Deploy em Produção

### Recomendações:

1. **Trocar senha do Browserless** no `.env`
2. **Configurar domínio** e SSL/TLS (nginx)
3. **Aumentar recursos** (memória do Redis, concurrency do Browserless)
4. **Adicionar rate limiting**
5. **Configurar monitoramento** (Prometheus + Grafana)
6. **Backup do Redis** periodicamente

### Exemplo nginx (futuro):

```nginx
server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📝 Licença

MIT

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças grandes, abra uma issue primeiro.

---

**Desenvolvido com ❤️ para scraping Shein**