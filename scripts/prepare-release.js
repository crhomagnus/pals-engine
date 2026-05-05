import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const version = pkg.version;

await run("node", ["scripts/build-browser-bundle.js"]);
await run("node", ["--check", "pals-engine.js"]);
await run("node", ["--check", "bin/pals.js"]);
await run("node", ["--check", "src/node/cdp-driver.js"]);
await run("node", ["--check", "src/report/playwright-export.js"]);
await run("node", ["--check", "scripts/smoke-public-demo.js"]);
await run("node", ["--check", "scripts/prepare-release.js"]);
await run("node", ["--check", "extension/content.js"]);
await run("node", ["--check", "extension/popup.js"]);
await run("node", ["--check", "extension/report.js"]);
await run("node", ["--check", "site/app.js"]);
await run("node", ["--check", "site/demo.js"]);
await run("node", ["--check", "site/vendor/pals-engine.js"]);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(resolve(root, "site"), resolve(dist, "site"), {
  recursive: true,
  filter: (source) => !source.includes("/.DS_Store"),
});
await cp(resolve(root, "extension"), resolve(dist, "chrome-extension"), {
  recursive: true,
  filter: (source) => !source.includes("/.DS_Store"),
});

await prepareChromeStoreAssets();

await writeFile(
  resolve(dist, "RELEASE-MANIFEST.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version,
      createdAt: new Date().toISOString(),
      artifacts: {
        site: "dist/site",
        chromeExtensionDirectory: "dist/chrome-extension",
        chromeExtensionZip: `dist/pals-chrome-extension-v${version}.zip`,
        siteArchive: `dist/pals-site-v${version}.tar.gz`,
        chromeStoreAssets: "dist/chrome-store-assets",
      },
      checks: [
        "browser bundle generated",
        "node syntax checks passed",
        "site copied",
        "chrome extension copied",
        "chrome store assets prepared when local tools are available",
      ],
    },
    null,
    2
  )
);

await run("zip", ["-qr", resolve(dist, `pals-chrome-extension-v${version}.zip`), "."], {
  cwd: resolve(dist, "chrome-extension"),
});
await run("tar", ["-czf", resolve(dist, `pals-site-v${version}.tar.gz`), "."], {
  cwd: resolve(dist, "site"),
});

console.log(`release prepared in ${dist}`);

async function prepareChromeStoreAssets() {
  const assets = resolve(dist, "chrome-store-assets");
  await mkdir(assets, { recursive: true });
  await cp(resolve(root, "extension/icons/icon-128.png"), resolve(assets, "store-icon-128.png"));

  const promoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <defs>
    <linearGradient id="field" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#050607"/>
      <stop offset="0.52" stop-color="#13201d"/>
      <stop offset="1" stop-color="#050607"/>
    </linearGradient>
  </defs>
  <rect width="440" height="280" fill="url(#field)"/>
  <g opacity="0.28" stroke="#f7f3e8" stroke-width="1">
    <path d="M40 56H400M40 112H400M40 168H400M40 224H400"/>
    <path d="M88 34V246M176 34V246M264 34V246M352 34V246"/>
  </g>
  <g opacity="0.8">
    <circle cx="92" cy="70" r="7" fill="#45d49a"/>
    <circle cx="176" cy="112" r="5" fill="#e2c044"/>
    <circle cx="268" cy="168" r="7" fill="#e4572e"/>
    <circle cx="354" cy="214" r="5" fill="#45d49a"/>
  </g>
  <path d="M192 70L314 144L255 159L286 219L254 236L225 176L181 218Z" fill="#fffaf0"/>
  <path d="M192 70L314 144L255 159L286 219L254 236L225 176L181 218Z" fill="none" stroke="#050607" stroke-width="8" stroke-linejoin="round"/>
  <path d="M192 70L314 144L255 159L286 219L254 236L225 176L181 218Z" fill="#fffaf0"/>
  <circle cx="314" cy="144" r="14" fill="none" stroke="#45d49a" stroke-width="4"/>
</svg>`;
  const promoSvgPath = resolve(assets, "promo-small.svg");
  await writeFile(promoSvgPath, promoSvg);

  if (await commandExists("convert")) {
    await run("convert", [promoSvgPath, resolve(assets, "promo-small-440x280.png")]);
  }

  const chromium = (await firstCommand(["chromium", "google-chrome", "chrome"])) || null;
  if (chromium) {
    const homeUrl = pathToFileURL(resolve(dist, "site/index.html")).href;
    const demoUrl = `${pathToFileURL(resolve(dist, "site/demo.html")).href}?autorun=1`;
    await capture(chromium, homeUrl, resolve(assets, "screenshot-home-1280x800.png"));
    await capture(chromium, demoUrl, resolve(assets, "screenshot-demo-1280x800.png"));
  }
}

async function capture(chromium, url, output) {
  await run(chromium, [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=1280,800",
    "--virtual-time-budget=16000",
    `--screenshot=${output}`,
    url,
  ]);
}

async function firstCommand(commands) {
  for (const command of commands) {
    if (await commandExists(command)) return command;
  }
  return null;
}

function commandExists(command) {
  return new Promise((resolveCheck) => {
    const child = spawn("which", [command], { stdio: "ignore" });
    child.on("error", () => resolveCheck(false));
    child.on("exit", (code) => resolveCheck(code === 0));
  });
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || root,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}
