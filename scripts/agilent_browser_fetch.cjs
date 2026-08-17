#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const fs = require("node:fs");

async function main() {
  const url = process.argv[2];
  if (!url || !/^https:\/\/(?:www\.)?(?:agilent\.com|investor\.agilent\.com)\//i.test(url)) {
    throw new Error("An allowed Agilent URL is required.");
  }

  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executablePath = process.env.AGILENT_CHROME_PATH || (fs.existsSync(systemChrome) ? systemChrome : undefined);
  const browser = await chromium.launch({
    headless: process.env.AGILENT_HEADED !== "1",
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage({
      extraHTTPHeaders: {
        "From": "https://www.waters.com/",
        "X-Crawler-Identity": "WatersCompetitiveIntelligenceEngine/0.2",
      },
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    const result = await page.evaluate(() => ({
      url: location.href,
      title: document.title || "",
      text: (document.querySelector("main")?.innerText || document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 12000),
      links: Array.from(document.querySelectorAll("a[href]")).slice(0, 1500).map((anchor) => ({
        url: anchor.href,
        title: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
      })),
    }));
    process.stdout.write(JSON.stringify({ ...result, httpStatus: response?.status() || 200 }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
