// Backend API to log full dataLayer during ecommerce guest checkout path using real DOM scraping

const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function captureDataLayerEvents(url) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const events = [];

  await page.evaluateOnNewDocument(() => {
    window.loggedPushes = [];
    const origPush = Array.isArray(window.dataLayer) && window.dataLayer.push;
    Object.defineProperty(window, 'dataLayer', {
      configurable: true,
      get: () => window._dataLayer,
      set: (val) => {
        window._dataLayer = val;
        if (Array.isArray(val)) {
          const orig = val.push;
          val.push = function () {
            window.loggedPushes.push(arguments[0]);
            return orig.apply(this, arguments);
          };
        }
      },
    });
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(5000);

    const pushes = await page.evaluate(() => window.loggedPushes || []);
    await browser.close();
    return { url, dataLayer: pushes };
  } catch (err) {
    await browser.close();
    return { url, error: err.message };
  }
}

async function getValidLinksFromHomepage(homepage) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(homepage, { waitUntil: 'networkidle2' });

  const links = await page.evaluate(() => {
    const anchors = [...document.querySelectorAll('a[href]')];
    return anchors.map((a) => a.href);
  });

  const category = links.find((href) => href.includes('/product-category/') && !href.includes('/feed/'));
  const product = links.find((href) => href.includes('/product/') && !href.includes('?'));
  const cart = links.find((href) => href.includes('/cart')) || homepage + '/cart/';
  const checkout = links.find((href) => href.includes('/checkout')) || homepage + '/checkout/';

  await browser.close();
  return { category, product, cart, checkout };
}

app.post('/run-checkout-path', async (req, res) => {
  const { homepage } = req.body;
  if (!homepage) return res.status(400).send({ error: 'Missing homepage URL' });

  const steps = [];
  steps.push(await captureDataLayerEvents(homepage));

  const
