// index.js
import express from "express";
import { chromium } from "playwright";

const app = express();
const port = 3000;

// ================================
// 🔧 CONFIGURAÇÕES DO BROWSERLESS
// ================================
const BROWSERLESS_BASE = "ws://127.0.0.1:3000"; // como está rodando na mesma VPS

app.use(express.json());

// =============================================
// Função que conecta ao Browserless
// =============================================
async function connectBrowserless() {
  console.log("🌍 Conectando ao Browserless local...");
  return await chromium.connectOverCDP(BROWSERLESS_BASE);
}

// =============================================
// Função de scraping dos produtos da Shein
// =============================================
async function scrapeSheinProducts(url) {
  const browser = await connectBrowserless();

  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 " +
      "Mobile/15E148 Safari/604.1",
    locale: "pt-AO",
    geolocation: { longitude: 13.2344, latitude: -8.8383 }, // Luanda 🇦🇴
    permissions: ["geolocation"],
    extraHTTPHeaders: {
      "Accept-Language": "pt-AO,pt;q=0.9,en;q=0.8",
      "Referer": "https://m.shein.com/",
    },
  });

  const page = await context.newPage();

  try {
    console.log("🛒 Acessando URL:", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    try {
      await page.waitForSelector(".bsc-cart-be-shared-goods-item_v1", {
        timeout: 20000,
      });
    } catch (err) {
      if (url.includes("localcountry=")) {
        const altUrl = url.replace(/localcountry=[^&]+/, "localcountry=AO");
        console.log("🔁 Tentando versão Angola:", altUrl);
        await page.goto(altUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await page.waitForSelector(".bsc-cart-be-shared-goods-item_v1", {
          timeout: 20000,
        });
      } else {
        await page.screenshot({ path: "debug-no-selector.png", fullPage: true });
        throw err;
      }
    }

    const products = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".bsc-cart-be-shared-goods-item_v1")
      ).map((item) => {
        const name =
          item
            .querySelector(".bsc-cart-item-goods-title__content")
            ?.innerText.trim() || null;
        const image =
          item.querySelector("img")?.getAttribute("src") ||
          item.querySelector("img")?.getAttribute("data-src") ||
          null;
        const description =
          item
            .querySelector(".bsc-cart-item-goods-sale-attr__text")
            ?.innerText.trim() || null;
        const price =
          item
            .querySelector(".bsc-cart-item-goods-price__sale-price")
            ?.innerText.trim() ||
          item
            .querySelector(".bsc-cart-item-goods-price__main")
            ?.innerText.trim() ||
          null;
        return { name, image, description, price };
      });
    });

    return { status: "success", url, products };
  } catch (err) {
    console.error("⚠️ Erro no scraping:", err.message);
    try {
      const html = await page.content();
      console.log("HTML inicial:", html.slice(0, 600));
    } catch (e) {
      console.log("Não consegui pegar HTML:", e.message);
    }
    return { status: "failed", error: err.message };
  } finally {
    await page.close();
    await context.close();
    try {
      await browser.close();
    } catch (e) {}
  }
}

// =============================================
// Rota principal para scraping
// =============================================
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

// =============================================
// Rota de teste para confirmar conexão
// =============================================
app.get("/api/check-ip", async (req, res) => {
  const browser = await connectBrowserless();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("https://api.ipify.org?format=json", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const txt = await page.textContent("body");
    res.json({ ip: JSON.parse(txt).ip });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await page.close();
    await context.close();
    try {
      await browser.close();
    } catch (e) {}
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 API Shein Products rodando em http://0.0.0.0:${port}`);
});
