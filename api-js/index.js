// index.js
import express from "express";
import { chromium } from "playwright";

const app = express();
const port = process.env.PORT || 3000;

// 🧠 Endereço do teu Browserless (ajusta o IP se for remoto)
const BROWSERLESS_URL = "ws://194.163.155.26:3000"; // exemplo: ws://123.45.67.89:3000

app.use(express.json());

// Função principal de scraping
async function scrapeSheinProducts(url) {
  // Conecta ao Browserless remoto
  const browser = await chromium.connectOverCDP(BROWSERLESS_URL);
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  });

  const page = await context.newPage();

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
    await page.close();
    await context.close(); // libera a sessão no Browserless
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
  console.log(`🚀 API Shein Products conectada ao Browserless rodando em http://localhost:${port}`);
});
