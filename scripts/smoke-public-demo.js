import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createCdpBrowser } from "../src/node/cdp-driver.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = createServer(handleRequest);

server.listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/site/demo.html?autorun=1`;
  let browser;

  try {
    browser = await createCdpBrowser({ headless: true, width: 1280, height: 980 });
    const page = await browser.newPage({ width: 1280, height: 980 });
    await page.goto(url, 30000);

    const result = await waitForDemo(page);
    assert(result.hasPals, "PALS was not installed on demo page");
    assert(result.status === "Completed", "demo scan did not complete");
    assert(result.points >= 10, "demo scanned too few points");
    assert(result.elements >= 3, "demo discovered too few elements");
    assert(result.hover >= 1, "demo did not detect hover regions");
    assert(result.findings >= 2, "demo did not produce expected findings");
    assert(
      result.scrollWidth <= result.clientWidth,
      "demo has horizontal overflow in desktop smoke viewport"
    );

    console.log(JSON.stringify(result, null, 2));
    console.log("public demo smoke passed");
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});

async function waitForDemo(page) {
  const startedAt = Date.now();
  let result = null;

  while (Date.now() - startedAt < 20000) {
    await page.wait(300);
    result = await page.evaluate(`({
      status: document.getElementById("scan-status")?.textContent || "",
      points: Number(document.getElementById("metric-points")?.textContent || 0),
      elements: Number(document.getElementById("metric-elements")?.textContent || 0),
      hover: Number(document.getElementById("metric-hover")?.textContent || 0),
      findings: Number(document.getElementById("metric-findings")?.textContent || 0),
      hasPals: Boolean(window.PALS),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    })`);

    if (result.status === "Completed") return result;
  }

  return result || {};
}

async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    const file = safeLocalPath(url.pathname);
    const info = await stat(file);

    if (!info.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": contentType(file) });
    response.end(await readFile(file));
  } catch (_error) {
    response.writeHead(404);
    response.end("Not found");
  }
}

function safeLocalPath(pathname) {
  const normalized = normalize(decodeURIComponent(pathname))
    .replace(/^[/\\]+/, "")
    .replace(/^(\.\.[/\\])+/, "");
  const file = resolve(root, normalized || "site/index.html");
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    throw new Error("Path escapes root");
  }
  return file;
}

function contentType(file) {
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8",
  };

  return types[extname(file)] || "application/octet-stream";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
