const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

async function extractDataLayer(page, step) {
  try {
    const dataLayer = await page.evaluate(() => window.dataLayer);
    return { step, dataLayer };
  } catch (e) {
    return { step, error: 'dataLayer not found or inaccessible.' };
  }
}

async function runEcommerceFlow(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    results.push(await extractDataLayer(page, 'Homepage'));

    const categoryLink = await page.$('a:has-text("Shop"), a:has-text("Products"), a:has-text("Store")');
    if (categoryLink) {
      await categoryLink.click();
      await page.waitForLoadState('networkidle');
      results.push(await extractDataLayer(page, 'Category Page'));
    } else {
      throw new Error('Category link not found');
    }

    const productLink = await page.$('a:has-text("Add to Cart"), a[href*="product"]');
    if (productLink) {
      await productLink.click();
      await page.waitForLoadState('networkidle');
      results.push(await extractDataLayer(page, 'Product Page'));
    } else {
      throw new Error('Product link not found');
    }

    const addToCartButton = await page.$('button:has-text("Add to Cart"), button:has-text("Buy Now")');
    if (addToCartButton) {
      await addToCartButton.click();
      await page.waitForTimeout(2000);
      results.push(await extractDataLayer(page, 'After Add to Cart'));
    } else {
      throw new Error('Add to cart button not found');
    }

    const checkoutLink = await page.$('a:has-text("Checkout"), a:has-text("Cart")');
    if (checkoutLink) {
      await checkoutLink.click();
      await page.waitForLoadState('networkidle');
      results.push(await extractDataLayer(page, 'Checkout Page'));
    } else {
      throw new Error('Checkout link not found');
    }

  } catch (err) {
    results.push({ step: 'Error', message: err.message });
  } finally {
    await browser.close();
    return results;
  }
}

app.post('/run-checkout-path', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing URL in request body' });
  }

  try {
    const report = await runEcommerceFlow(url);
    res.json({ url, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
