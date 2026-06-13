import { launch } from "puppeteer";

async function run() {
  const browser = await launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));

  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 2000));
  
  const body = await page.evaluate(() => document.body.innerHTML);
  if (body.includes('style="position:fixed')) {
      console.log("HTML CONTAINS ERROR:", body.substring(0, 1500));
  } else {
      console.log("HTML:", body.substring(0, 500));
  }
  
  await browser.close();
}

run();
