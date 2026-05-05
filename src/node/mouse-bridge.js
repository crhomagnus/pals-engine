import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const DEFAULT_PORT = 17381;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SWEEP_POINTS = 420;

export async function startMouseBridge(options = {}) {
  const bridge = new MouseBridge(options);
  await bridge.listen();
  return bridge;
}

export class MouseBridge {
  constructor(options = {}) {
    this.host = options.host || "127.0.0.1";
    this.port = options.port || DEFAULT_PORT;
    this.token = options.token || randomBytes(18).toString("hex");
    this.dryRun = Boolean(options.dryRun);
    this.tool = options.tool || "xdotool";
    this.server = createServer((request, response) => {
      this.handle(request, response).catch((error) => {
        this.send(response, 500, { ok: false, error: error.message });
      });
    });
  }

  listen() {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, this.host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });
  }

  close() {
    return new Promise((resolve) => this.server.close(resolve));
  }

  async handle(request, response) {
    this.setCors(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || "/", `http://${this.host}:${this.port}`);

    if (request.method === "GET" && url.pathname === "/health") {
      this.send(response, 200, {
        ok: true,
        service: "pals-mouse-bridge",
        dryRun: this.dryRun,
        tool: this.tool,
      });
      return;
    }

    if (!this.authorized(request)) {
      this.send(response, 401, { ok: false, error: "Missing or invalid PALS bridge token." });
      return;
    }

    if (request.method !== "POST") {
      this.send(response, 405, { ok: false, error: "Method not allowed." });
      return;
    }

    const body = await readJson(request);

    if (url.pathname === "/move") {
      const result = await this.move(body);
      this.send(response, 200, { ok: true, result });
      return;
    }

    if (url.pathname === "/click") {
      const result = await this.click(body);
      this.send(response, 200, { ok: true, result });
      return;
    }

    if (url.pathname === "/type") {
      const result = await this.typeText(body);
      this.send(response, 200, { ok: true, result });
      return;
    }

    if (url.pathname === "/sweep") {
      const result = await this.sweep(body);
      this.send(response, 200, { ok: true, result });
      return;
    }

    if (url.pathname === "/execute") {
      const result = await this.execute(body);
      this.send(response, 200, { ok: true, result });
      return;
    }

    this.send(response, 404, { ok: false, error: "Unknown PALS bridge endpoint." });
  }

  authorized(request) {
    return request.headers["x-pals-token"] === this.token;
  }

  async execute(command) {
    if (!command || typeof command !== "object") {
      throw new Error("Command body is required.");
    }

    if (command.type === "move") return this.move(command);
    if (command.type === "click") return this.click(command);
    if (command.type === "type") return this.typeText(command);
    if (command.type === "sweep") return this.sweep(command);
    throw new Error(`Unsupported command type: ${command.type}`);
  }

  async move(body) {
    const point = validatePoint(body);
    const durationMs = clampNumber(body.durationMs || 0, 0, 10000);

    if (this.dryRun || durationMs <= 0) {
      return this.run(["mousemove", String(point.x), String(point.y)], { point });
    }

    const current = await this.position();
    const steps = Math.max(2, Math.min(80, Math.ceil(durationMs / 24)));
    for (let index = 1; index <= steps; index += 1) {
      const ratio = index / steps;
      const x = Math.round(current.x + (point.x - current.x) * ratio);
      const y = Math.round(current.y + (point.y - current.y) * ratio);
      await this.run(["mousemove", String(x), String(y)], { point: { x, y } });
      await delay(durationMs / steps);
    }

    return { action: "move", point, durationMs, steps };
  }

  async click(body = {}) {
    const button = clampNumber(body.button || 1, 1, 5);
    return this.run(["click", String(button)], { action: "click", button });
  }

  async typeText(body = {}) {
    const text = String(body.text || "").slice(0, 1000);
    if (!text) throw new Error("Text is required.");
    return this.run(["type", "--clearmodifiers", text], {
      action: "type",
      chars: text.length,
    });
  }

  async sweep(body = {}) {
    const points = Array.isArray(body.points) ? body.points.map(validatePoint) : [];
    if (!points.length) throw new Error("Sweep needs at least one point.");
    if (points.length > MAX_SWEEP_POINTS) {
      throw new Error(`Sweep is limited to ${MAX_SWEEP_POINTS} points.`);
    }

    const durationMs = clampNumber(body.durationMs || points.length * 32, 0, 30000);
    const waitMs = Math.max(8, Math.floor(durationMs / Math.max(1, points.length)));

    for (const point of points) {
      await this.run(["mousemove", String(point.x), String(point.y)], { point });
      await delay(waitMs);
    }

    return { action: "sweep", points: points.length, durationMs };
  }

  async position() {
    if (this.dryRun) return { x: 0, y: 0 };
    const output = await runProcess(this.tool, ["getmouselocation", "--shell"]);
    const x = Number(output.match(/^X=(\d+)/m)?.[1]);
    const y = Number(output.match(/^Y=(\d+)/m)?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("Could not read current mouse position.");
    }
    return { x, y };
  }

  async run(args, metadata) {
    if (this.dryRun) {
      return {
        dryRun: true,
        tool: this.tool,
        args,
        ...metadata,
      };
    }

    await runProcess(this.tool, args);
    return {
      dryRun: false,
      tool: this.tool,
      args,
      ...metadata,
    };
  }

  setCors(response) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "content-type,x-pals-token");
    response.setHeader("Access-Control-Max-Age", "86400");
  }

  send(response, status, body) {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(body));
  }
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (_error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString("utf8"));
      } else {
        reject(new Error(Buffer.concat(stderr).toString("utf8").trim() || `${command} failed`));
      }
    });
  });
}

function validatePoint(body = {}) {
  const x = Number(body.x);
  const y = Number(body.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("Mouse command needs numeric x and y.");
  }
  if (x < 0 || y < 0 || x > 20000 || y > 20000) {
    throw new Error("Mouse coordinates are outside the accepted screen range.");
  }
  return { x: Math.round(x), y: Math.round(y) };
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
