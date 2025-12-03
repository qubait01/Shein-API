// =============================================
// 🕷️ Shein Scraper Service - Node.js
// =============================================
import express from 'express';
import { chromium } from 'playwright';
import morgan from 'morgan';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;
const BROWSERLESS_WS = process.env.BROWSERLESS_WS || 'ws://browserless:3000';
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || '';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// =============================================
// 📊 Logger Simples
// =============================================
const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${new Date().toISOString()} -`, msg, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${new Date().toISOString()} -`, msg, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${new Date().toISOString()} -`, msg, ...args),
  debug: (msg, ...args) => LOG_LEVEL === 'debug' && console.log(`[DEBUG] ${new Date().toISOString()} -`, msg, ...args),
};

// =============================================
// 🌐 Conexão com Browserless
// =============================================
async function connectBrowser() {
  try {
    logger.info('🌍 Conectando ao Browserless:', BROWSERLESS_WS);
    
    const wsEndpoint = BROWSERLESS_TOKEN 
      ? `${BROWSERLESS_WS}?token=${BROWSERLESS_TOKEN}`
      : BROWSERLESS_WS;
    
    const browser = await chromium.connectOverCDP(wsEndpoint);
    logger.info('✅ Conectado ao Browserless com sucesso');
    
    return browser;
  } catch (error) {
    logger.error('❌ Erro ao conectar no Browserless:', error.message);
    throw error;
  }
}

// =============================================
// 🕷️ Função de Scraping Principal
// =============================================
async function scrapeSheinCart(url) {
  let browser;
  let context;
  let page;
  
  const startTime = Date.now();

  try {
    // Conectar ao browser
    browser = await connectBrowser();
    
    // Criar contexto com configurações mobile
    context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 ' +
        'Mobile/15E148 Safari/604.1',
      locale: 'pt-AO',
      geolocation: { longitude: 13.2344, latitude: -8.8383 },
      permissions: ['geolocation'],
      extraHTTPHeaders: {
        'Accept-Language': 'pt-AO,pt;q=0.9,en;q=0.8',
        'Referer': 'https://m.shein.com/',
      },
    });

    page = await context.newPage();
    
    logger.info('🛒 Acessando URL:', url);
    await page.goto(url, { 
      waitUntil: 'commit', 
      timeout: 60000 
    });

    // Esperar pelo seletor dos produtos
    try {
      await page.waitForSelector('.bsc-cart-be-shared-goods-item_v1', {
        timeout: 20000,
      });
    } catch (err) {
      // Tentar versão Angola
      if (url.includes('localcountry=')) {
        const altUrl = url.replace(/localcountry=[^&]+/, 'localcountry=AO');
        logger.info('🔁 Tentando versão Angola:', altUrl);
        
        await page.goto(altUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        
        await page.waitForSelector('.bsc-cart-be-shared-goods-item_v1', {
          timeout: 20000,
        });
      } else {
        // Tirar screenshot para debug
        const screenshotPath = path.join('/app/logs', `error-${Date.now()}.png`);
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });
        logger.warn('📸 Screenshot salvo em:', screenshotPath);
        
        throw new Error('Seletor de produtos não encontrado');
      }
    }

    // Extrair dados dos produtos
    const products = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll('.bsc-cart-be-shared-goods-item_v1')
      ).map((item) => {
        const name = item.querySelector('.bsc-cart-item-goods-title__content')?.innerText.trim() || null;
        // Robust image extraction
        const imgEl = item.querySelector('img');
        let image = null;
        
        if (imgEl) {
          // Attributes to check in order of priority
          const attributes = ['data-src', 'data-lazy-src', 'data-url', 'data-img-src', 'src'];
          
          for (const attr of attributes) {
            const val = imgEl.getAttribute(attr);
            if (val && !val.includes('placeholder') && !val.includes('spacer') && !val.includes('data:image')) {
              image = val;
              break;
            }
          }
          
          // Fallback to src if nothing better found
          if (!image) image = imgEl.getAttribute('src');
          
          // Fix protocol-relative URLs
          if (image && image.startsWith('//')) {
            image = 'https:' + image;
          }
        }
        const description = item.querySelector('.bsc-cart-item-goods-sale-attr__text')?.innerText.trim() || null;
        const price = item.querySelector('.bsc-cart-item-goods-price__sale-price')?.innerText.trim() ||
                     item.querySelector('.bsc-cart-item-goods-price__main')?.innerText.trim() || null;
        const quantity = item.querySelector('.bsc-cart-item-goods-quantity')?.innerText.trim() || '1';

        return { name, image, description, price, quantity };
      });
    });

    const duration = Date.now() - startTime;
    logger.info(`✅ Scraping concluído: ${products.length} produtos em ${duration}ms`);

    return {
      status: 'success',
      url,
      count: products.length,
      products,
      metadata: {
        scraped_at: new Date().toISOString(),
        duration_ms: duration,
      },
    };

  } catch (error) {
    logger.error('⚠️ Erro no scraping:', error.message);
    
    // Tentar capturar HTML para debug
    if (page) {
      try {
        const html = await page.content();
        logger.debug('HTML da página:', html.slice(0, 500));
      } catch (e) {
        logger.warn('Não foi possível capturar HTML:', e.message);
      }
    }

    const duration = Date.now() - startTime;
    return {
      status: 'failed',
      url,
      error: error.message,
      metadata: {
        scraped_at: new Date().toISOString(),
        duration_ms: duration,
      },
    };

  } finally {
    // Cleanup
    if (page) {
      try {
        await page.close();
      } catch (e) {
        logger.warn('Erro ao fechar página:', e.message);
      }
    }
    
    if (context) {
      try {
        await context.close();
      } catch (e) {
        logger.warn('Erro ao fechar contexto:', e.message);
      }
    }
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        logger.warn('Erro ao fechar browser:', e.message);
      }
    }
  }
}

// =============================================
// 📍 ROTAS
// =============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Shein Scraper',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    browserless: BROWSERLESS_WS,
  });
});

// Rota principal de scraping (POST)
app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      status: 'error',
      message: 'Parâmetro "url" é obrigatório',
    });
  }

  // Validar URL
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({
      status: 'error',
      message: 'URL inválida',
    });
  }

  try {
    const result = await scrapeSheinCart(url);
    res.json(result);
  } catch (error) {
    logger.error('Erro interno:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor',
      details: error.message,
    });
  }
});

// Rota de scraping (GET - para testes rápidos)
app.get('/scrape', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      status: 'error',
      message: 'Parâmetro "url" é obrigatório',
    });
  }

  try {
    const result = await scrapeSheinCart(url);
    res.json(result);
  } catch (error) {
    logger.error('Erro interno:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor',
      details: error.message,
    });
  }
});

// Rota de teste de conexão
app.get('/test-connection', async (req, res) => {
  let browser;
  let page;
  
  try {
    browser = await connectBrowser();
    const context = await browser.newContext();
    page = await context.newPage();
    
    await page.goto('https://api.ipify.org?format=json', { timeout: 30000 });
    const content = await page.textContent('body');
    const ipData = JSON.parse(content);
    
    res.json({
      status: 'success',
      message: 'Conexão com Browserless funcionando',
      ip: ipData.ip,
      browserless: BROWSERLESS_WS,
    });
    
  } catch (error) {
    logger.error('Erro ao testar conexão:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  logger.error('Erro não tratado:', err);
  res.status(500).json({
    status: 'error',
    message: 'Erro interno do servidor',
  });
});

// =============================================
// 🚀 Inicialização
// =============================================
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Scraper Service rodando em http://0.0.0.0:${PORT}`);
  logger.info(`📍 Browserless: ${BROWSERLESS_WS}`);
  logger.info(`
Rotas disponíveis:
  GET  /health           - Health check
  POST /scrape           - Fazer scraping (body: {"url": "..."})
  GET  /scrape?url=...   - Fazer scraping (query param)
  GET  /test-connection  - Testar conexão com Browserless
  `);
});