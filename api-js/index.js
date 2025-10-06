// index.js
import express from "express";
import { chromium } from "playwright";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Configurações
const MAX_BROWSERS = 5;
const MAX_PAGES = 10;
const IDLE_TIMEOUT = 5 * 60 * 1000;

let browsers = [];

// Função para criar um novo browser com pool de páginas
async function createBrowser() {
  const browser = await chromium.launch({ headless: true });
  const pages = [];
  const createdAt = Date.now();

  return { browser, pages, createdAt };
}

// Pega uma página livre ou cria nova
async function getPage() {
  // 1. Tenta usar um navegador existente com menos de MAX_PAGES
  for (const b of browsers) {
    if (b.pages.length < MAX_PAGES) {
      const context = await b.browser.newContext({
        viewport: { width: 375, height: 812 },
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      });
      const page = await context.newPage();
      b.pages.push(page);

      // libera a aba quando fechar
      page.on("close", () => {
        b.pages = b.pages.filter(p => p !== page);
      });

      return page;
    }
  }

  // 2. Se não houver espaço, cria um novo navegador (até o limite)
  if (browsers.length < MAX_BROWSERS) {
    const newBrowser = await createBrowser();
    browsers.push(newBrowser);

    const context = await newBrowser.browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    newBrowser.pages.push(page);

    page.on("close", () => {
      newBrowser.pages = newBrowser.pages.filter(p => p !== page);
    });

    return page;
  }

  throw new Error("🚨 Todos os navegadores e abas estão ocupados. Tente novamente em alguns segundos.");
}

// Fecha browsers inativos automaticamente
setInterval(async () => {
  for (const b of [...browsers]) {
    if (b.pages.length === 0 && Date.now() - b.createdAt > IDLE_TIMEOUT) {
      await b.browser.close();
      browsers = browsers.filter(x => x !== b);
      console.log("🧹 Browser fechado por inatividade");
    }
  }
}, 60 * 1000);

// Função principal de scraping
async function scrapeSheinProducts(url) {
  const page = await getPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".bsc-cart-be-shared-goods-item_v1", { timeout: 20000 });

    const products = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".bsc-cart-be-shared-goods-item_v1")).map((item) => {
        const name =
          item.querySelector(".bsc-cart-item-goods-title__content")?.innerText.trim() || null;

        const image =
          item.querySelector("img")?.getAttribute("src") ||
          item.querySelector("img")?.getAttribute("data-src") ||
          null;

        const description =
          item.querySelector(".bsc-cart-item-goods-sale-attr__text")?.innerText.trim() || null;

        const price =
          item.querySelector(".bsc-cart-item-goods-price__sale-price")?.innerText.trim() ||
          item.querySelector(".bsc-cart-item-goods-price__main")?.innerText.trim() ||
          null;

        return { name, image, description, price };
      });
    });

    return { status: "success", url, products };
  } catch (err) {
    return { status: "failed", error: err.message };
  } finally {
    await page.close(); // ✅ fecha só a aba, mantém o navegador
  }
}

// Endpoint
app.post("/api/shein-products", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Faltando parâmetro: url" });

  try {
    const data = await scrapeSheinProducts(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro interno", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 API Shein Products escalável rodando em http://localhost:${port}`);
});
