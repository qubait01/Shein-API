# shein_api.py
import asyncio
import time
from fastapi import FastAPI, Query
from playwright.async_api import async_playwright
from typing import List, Dict, Any
import uvicorn

app = FastAPI(title="Shein Cart Scraper API")

# Estado global para o navegador
browser = None
context = None
last_activity = time.time()

INACTIVITY_TIMEOUT = 300  # 5 minutos

async def get_browser():
    global browser, context, last_activity
    last_activity = time.time()
    if browser is None:
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context()
    return context

async def close_browser_if_idle():
    global browser, context, last_activity
    while True:
        await asyncio.sleep(60)  # verifica a cada 1 minuto
        if browser and time.time() - last_activity > INACTIVITY_TIMEOUT:
            await context.close()
            await browser.close()
            browser = None
            context = None
            print("🛑 Navegador fechado por inatividade.")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(close_browser_if_idle())

@app.get("/cart")
async def scrape_cart(url: str = Query(..., description="URL do carrinho da Shein")) -> Dict[str, Any]:
    """
    Roda o scraping em um link de carrinho Shein e retorna os produtos.
    """
    context = await get_browser()
    page = await context.new_page()
    await page.goto(url, timeout=60000)

    # Aguarda o carregamento dos itens (ajustar seletor conforme HTML da Shein)
    await page.wait_for_selector(".cart-goods", timeout=60000)

    items = await page.query_selector_all(".cart-goods")

    results = []
    for item in items:
        name = await item.query_selector_eval(".goods-title a", "el => el.innerText") if await item.query_selector(".goods-title a") else "N/A"
        price = await item.query_selector_eval(".goods-price", "el => el.innerText") if await item.query_selector(".goods-price") else "N/A"
        img = await item.query_selector_eval("img", "el => el.src") if await item.query_selector("img") else None
        qty = await item.query_selector_eval(".goods-num input", "el => el.value") if await item.query_selector(".goods-num input") else "1"

        results.append({
            "name": name.strip(),
            "price": price.strip(),
            "image": img,
            "quantity": qty
        })

    await page.close()
    return {"count": len(results), "products": results}


if __name__ == "__main__":
    uvicorn.run("shein_api:app", host="0.0.0.0", port=8000, reload=True)
