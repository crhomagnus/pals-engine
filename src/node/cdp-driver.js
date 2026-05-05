import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

export async function createCdpBrowser(options = {}) {
  const executable = await findChromiumExecutable();
  const userDataDir = await mkdtemp(join(tmpdir(), "pals-chromium-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];

  if (options.headless === false) {
    args.shift();
  }

  const processHandle = spawn(executable, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const webSocketUrl = await waitForDevToolsUrl(processHandle);
  const client = await CdpClient.connect(webSocketUrl);

  async function close() {
    try {
      await client.send("Browser.close");
    } catch (_error) {
      processHandle.kill("SIGTERM");
    }

    await waitForProcessExit(processHandle, 2000);
    await rm(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 120,
    });
  }

  async function newPage(pageOptions = {}) {
    const target = await client.send("Target.createTarget", { url: "about:blank" });
    const attached = await client.send("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: true,
    });
    const sessionId = attached.sessionId;

    await client.send("Page.enable", {}, sessionId);
    await client.send("Runtime.enable", {}, sessionId);
    await client.send("DOM.enable", {}, sessionId);
    await client.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: pageOptions.width || 1280,
        height: pageOptions.height || 720,
        deviceScaleFactor: 1,
        mobile: false,
      },
      sessionId
    );

    return createCdpPage(client, sessionId);
  }

  return {
    close,
    newPage,
  };
}

function createCdpPage(client, sessionId) {
  async function goto(url, timeout = 30000) {
    await client.send("Page.navigate", { url }, sessionId);
    await waitForEvent(client, "Page.loadEventFired", sessionId, timeout);
  }

  async function evaluate(expression, timeout = 30000) {
    const result = await client.send(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
        timeout,
      },
      sessionId
    );

    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text ||
          "Runtime.evaluate failed"
      );
    }

    return result.result?.value;
  }

  async function addScript(content) {
    await evaluate(content);
  }

  async function mouseMove(x, y) {
    await client.send(
      "Input.dispatchMouseEvent",
      {
        type: "mouseMoved",
        x,
        y,
        button: "none",
      },
      sessionId
    );
  }

  async function wait(milliseconds) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  return {
    goto,
    evaluate,
    addScript,
    mouseMove,
    wait,
  };
}

class CdpClient {
  static async connect(url) {
    const socket = new WebSocket(url);
    const client = new CdpClient(socket);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return client;
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result || {});
        }
        return;
      }

      if (message.method) {
        const key = eventKey(message.method, message.sessionId);
        const callbacks = this.listeners.get(key) || [];
        for (const callback of callbacks) callback(message.params || {});
      }
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId;
    this.nextId += 1;

    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  once(method, sessionId, timeout) {
    return new Promise((resolve, reject) => {
      const key = eventKey(method, sessionId);
      const callbacks = this.listeners.get(key) || [];
      const timer = setTimeout(() => {
        this.listeners.set(
          key,
          (this.listeners.get(key) || []).filter((callback) => callback !== done)
        );
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeout);

      function done(params) {
        clearTimeout(timer);
        resolve(params);
      }

      callbacks.push(done);
      this.listeners.set(key, callbacks);
    });
  }
}

async function waitForEvent(client, method, sessionId, timeout) {
  try {
    await client.once(method, sessionId, timeout);
  } catch (_error) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function waitForProcessExit(processHandle, timeout) {
  if (processHandle.exitCode !== null || processHandle.signalCode !== null) return;

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      processHandle.kill("SIGTERM");
      resolve();
    }, timeout);

    processHandle.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function eventKey(method, sessionId) {
  return `${sessionId || "browser"}:${method}`;
}

async function waitForDevToolsUrl(processHandle) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for Chromium DevTools endpoint"));
    }, 10000);

    function inspect(data) {
      const text = data.toString();
      const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    }

    processHandle.stderr.on("data", inspect);
    processHandle.stdout.on("data", inspect);
    processHandle.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chromium exited before DevTools endpoint was ready: ${code}`));
    });
  });
}

async function findChromiumExecutable() {
  const candidates = [
    process.env.PALS_CHROMIUM_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (_error) {
      // Continue.
    }
  }

  throw new Error(
    "No Chromium executable found. Set PALS_CHROMIUM_PATH or install Chromium/Chrome."
  );
}
