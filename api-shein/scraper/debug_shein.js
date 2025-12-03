
import { chromium } from 'playwright';
import fs from 'fs/promises';

const BROWSERLESS_WS = 'ws://browserless:3000';
const BROWSERLESS_TOKEN = 'mysecrettoken123';

async function run() {
  console.log('Connecting to Browserless...');
  const browser = await chromium.connectOverCDP(`${BROWSERLESS_WS}?token=${BROWSERLESS_TOKEN}`);
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    locale: 'pt-AO',
    geolocation: { longitude: 13.2344, latitude: -8.8383 },
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'pt-AO,pt;q=0.9,en;q=0.8',
      'Referer': 'https://m.shein.com/',
    },
  });

  const page = await context.newPage();
  const url = 'https://m.shein.com/ao/pdsearch/vestido/?ici=s1`EditSearch`vestido`fb0`d0`PageHome&scici=Search~~EditSearch~~1~~vestido~~~~0';
  
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
  
  try {
    console.log('Waiting for product selector...');
    await page.waitForSelector('.bsc-cart-be-shared-goods-item_v1, .product-list-item, .S-product-item', { timeout: 30000 });
  } catch (e) {
    console.log('Selector not found, dumping HTML anyway...');
  }

  const html = await page.content();
  await fs.writeFile('/tmp/shein_dump.html', html);
  console.log('HTML saved to /tmp/shein_dump.html');

  await browser.close();
}

run().catch(console.error);
