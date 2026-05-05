import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
      },
      checks: [
        "browser bundle generated",
        "node syntax checks passed",
        "site copied",
        "chrome extension copied",
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
