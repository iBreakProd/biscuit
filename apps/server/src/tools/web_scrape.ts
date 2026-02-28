import puppeteer from "puppeteer";
import { WebScrapeInputSchema, WebScrapeInput } from "@repo/zod-schemas";

const MAX_CONTENT_CHARS = 10_000;

/**
 * web_scrape tool — Puppeteer-based webpage text extraction.
 * Extracts document.body.innerText and hard-truncates to 10,000 chars.
 * Uses lightweight headless config (--no-sandbox) for background processes.
 */
export async function webScrapeTool(args: WebScrapeInput): Promise<{
  title: string;
  content: string;
  meta: { url: string; truncated: boolean };
}> {
  const { url } = WebScrapeInputSchema.parse(args);

  console.log(`[web_scrape] Launching headless browser to scrape: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();

    // Timeout after 15s to avoid hanging
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });

    const title = await page.title();
    const rawText: string = await page.evaluate(() => document.body?.innerText ?? "");

    const truncated = rawText.length > MAX_CONTENT_CHARS;
    const content = truncated ? rawText.substring(0, MAX_CONTENT_CHARS) : rawText;

    console.log(
      `[web_scrape] Scraped "${title}" — ${rawText.length} chars extracted, truncated=${truncated}`
    );

    return {
      title,
      content,
      meta: { url, truncated },
    };
  } finally {
    await browser.close();
  }
}
