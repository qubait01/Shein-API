# =============================================
# 🐍 Shein Scraper API - Python FastAPI
# =============================================
import os
import logging
from datetime import datetime
from typing import Optional, List
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl, validator

# =============================================
# 🔧 CONFIGURAÇÕES
# =============================================
SCRAPER_URL = os.getenv('SCRAPER_URL', 'http://scraper:3001')
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
CACHE_TTL = int(os.getenv('CACHE_TTL', 3600))  # 1 hora
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# =============================================
# 📊 CONFIGURAÇÃO DE LOGGING
# =============================================
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================
# 💾 REDIS CLIENT
# =============================================
redis_client: Optional[redis.Redis] = None

async def get_redis():
    """Retorna cliente Redis"""
    global redis_client
    if redis_client is None:
        try:
            redis_client = await redis.from_url(
                REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await redis_client.ping()
            logger.info("✅ Conectado ao Redis")
        except Exception as e:
            logger.warning(f"⚠️ Redis não disponível: {e}")
            redis_client = None
    return redis_client

# =============================================
# 📊 MODELOS DE DADOS
# =============================================
class ProductItem(BaseModel):
    name: Optional[str]
    image: Optional[str]
    description: Optional[str]
    price: Optional[str]
    quantity: Optional[str] = "1"

class ScrapeRequest(BaseModel):
    url: HttpUrl
    use_cache: bool = True
    
    @validator('url')
    def validate_shein_url(cls, v):
        url_str = str(v).lower()
        if 'shein' not in url_str:
            raise ValueError('URL deve ser da Shein')
        return v

class ScrapeResponse(BaseModel):
    status: str
    url: str
    count: int
    products: List[ProductItem]
    metadata: dict
    from_cache: bool = False

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    services: dict

# =============================================
# 🔄 LIFECYCLE
# =============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação"""
    # Startup
    logger.info("🚀 Iniciando API Shein Scraper...")
    await get_redis()
    
    yield
    
    # Shutdown
    logger.info("🛑 Encerrando API...")
    if redis_client:
        await redis_client.close()

# =============================================
# 📱 APLICAÇÃO FASTAPI
# =============================================
app = FastAPI(
    title="Shein Scraper API",
    description="API principal para orquestração de scraping Shein",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================
# 🔧 FUNÇÕES AUXILIARES
# =============================================
async def call_scraper(url: str) -> dict:
    """Chama o serviço de scraping Node.js"""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            logger.info(f"📞 Chamando scraper: {SCRAPER_URL}/scrape")
            response = await client.post(
                f"{SCRAPER_URL}/scrape",
                json={"url": url}
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error(f"❌ Erro ao chamar scraper: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao comunicar com serviço de scraping: {str(e)}"
        )

async def get_cached_result(url: str) -> Optional[dict]:
    """Busca resultado em cache"""
    r = await get_redis()
    if not r:
        return None
    
    try:
        cache_key = f"scrape:{url}"
        cached = await r.get(cache_key)
        if cached:
            logger.info(f"✅ Cache hit para: {url}")
            import json
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"⚠️ Erro ao buscar cache: {e}")
    
    return None

async def set_cached_result(url: str, data: dict):
    """Salva resultado em cache"""
    r = await get_redis()
    if not r:
        return
    
    try:
        cache_key = f"scrape:{url}"
        import json
        await r.setex(cache_key, CACHE_TTL, json.dumps(data))
        logger.info(f"💾 Resultado cacheado para: {url}")
    except Exception as e:
        logger.warning(f"⚠️ Erro ao salvar cache: {e}")

# =============================================
# 📍 ROTAS
# =============================================
@app.get("/", response_model=dict)
async def root():
    """Rota raiz"""
    return {
        "service": "Shein Scraper API",
        "version": "2.0.0",
        "status": "online",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check completo"""
    # Verificar scraper
    scraper_status = "unknown"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{SCRAPER_URL}/health")
            scraper_status = "healthy" if resp.status_code == 200 else "unhealthy"
    except:
        scraper_status = "unreachable"
    
    # Verificar Redis
    redis_status = "unknown"
    r = await get_redis()
    if r:
        try:
            await r.ping()
            redis_status = "healthy"
        except:
            redis_status = "unhealthy"
    else:
        redis_status = "unavailable"
    
    return HealthResponse(
        status="healthy",
        service="Shein Scraper API",
        version="2.0.0",
        timestamp=datetime.now().isoformat(),
        services={
            "scraper": scraper_status,
            "redis": redis_status
        }
    )

@app.post("/api/scrape", response_model=ScrapeResponse)
async def scrape_endpoint(request: ScrapeRequest = Body(...)):
    """
    Endpoint principal para scraping
    
    **Parâmetros:**
    - `url`: URL do carrinho Shein
    - `use_cache`: Se deve usar cache (padrão: true)
    
    **Exemplo:**
    ```json
    {
        "url": "https://m.shein.com/cart-share?...",
        "use_cache": true
    }
    ```
    """
    url = str(request.url)
    
    # Tentar buscar do cache
    if request.use_cache:
        cached = await get_cached_result(url)
        if cached:
            cached['from_cache'] = True
            return ScrapeResponse(**cached)
    
    # Chamar serviço de scraping
    result = await call_scraper(url)
    
    if result.get('status') == 'success':
        # Salvar em cache
        await set_cached_result(url, result)
        result['from_cache'] = False
        return ScrapeResponse(**result)
    else:
        raise HTTPException(
            status_code=500,
            detail=result.get('error', 'Erro desconhecido no scraping')
        )

@app.get("/api/scrape")
async def scrape_endpoint_get(
    url: str = Query(..., description="URL do carrinho Shein"),
    use_cache: bool = Query(True, description="Usar cache")
):
    """Endpoint GET para scraping (testes rápidos)"""
    request = ScrapeRequest(url=url, use_cache=use_cache)
    return await scrape_endpoint(request)

@app.delete("/api/cache/{url:path}")
async def clear_cache(url: str):
    """Limpa o cache de uma URL específica"""
    r = await get_redis()
    if not r:
        raise HTTPException(status_code=503, detail="Redis não disponível")
    
    try:
        cache_key = f"scrape:{url}"
        deleted = await r.delete(cache_key)
        return {
            "status": "success",
            "message": f"Cache limpo para: {url}",
            "deleted": bool(deleted)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/cache")
async def clear_all_cache():
    """Limpa todo o cache de scraping"""
    r = await get_redis()
    if not r:
        raise HTTPException(status_code=503, detail="Redis não disponível")
    
    try:
        keys = await r.keys("scrape:*")
        if keys:
            deleted = await r.delete(*keys)
            return {
                "status": "success",
                "message": f"Cache limpo: {deleted} entradas",
                "deleted": deleted
            }
        return {
            "status": "success",
            "message": "Nenhum cache encontrado",
            "deleted": 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats():
    """Estatísticas do cache"""
    r = await get_redis()
    if not r:
        raise HTTPException(status_code=503, detail="Redis não disponível")
    
    try:
        keys = await r.keys("scrape:*")
        info = await r.info('memory')
        
        return {
            "cache_entries": len(keys),
            "memory_used": info.get('used_memory_human', 'N/A'),
            "cache_ttl": CACHE_TTL,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================
# 🚀 INICIALIZAÇÃO
# =============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level=LOG_LEVEL.lower()
    )