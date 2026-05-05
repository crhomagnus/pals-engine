const salesEmail = "sales@example.com";
const canvas = document.getElementById("scan-canvas");
const context = canvas.getContext("2d");
const reveals = Array.from(document.querySelectorAll("[data-reveal]"));
const leadForm = document.getElementById("lead-form");
const leadPlan = document.getElementById("lead-plan");
const formStatus = document.getElementById("form-status");

let width = 0;
let height = 0;
let deviceScale = 1;
let frame = 0;
const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
const cells = [];

resizeCanvas();
seedCells();
requestAnimationFrame(draw);

window.addEventListener("resize", () => {
  resizeCanvas();
  seedCells();
});

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    }
  },
  { threshold: 0.16 }
);

for (const element of reveals) observer.observe(element);
revealInitialViewport();

document.querySelectorAll(".plan-button").forEach((button) => {
  button.addEventListener("click", () => {
    const plan = button.closest(".price-card");
    if (!plan) return;
    const optionText = `${plan.dataset.plan} - ${priceLabel(plan.dataset.price)}`;
    const existing = Array.from(leadPlan.options).find((option) => option.text === optionText);
    if (existing) leadPlan.value = optionText;
    document.getElementById("checkout").scrollIntoView({ behavior: "smooth" });
    document.getElementById("lead-email").focus({ preventScroll: true });
  });
});

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const request = {
    email: document.getElementById("lead-email").value.trim(),
    company: document.getElementById("lead-company").value.trim(),
    plan: leadPlan.value,
    scope: document.getElementById("lead-scope").value.trim(),
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem("pals:lastLeadRequest", JSON.stringify(request));
  formStatus.textContent = "Lead request saved locally. Opening email draft.";

  const subject = encodeURIComponent(`PALS pilot request - ${request.plan}`);
  const body = encodeURIComponent(
    [
      "PALS pilot request",
      "",
      `Email: ${request.email}`,
      `Company: ${request.company}`,
      `Plan: ${request.plan}`,
      `Authorized URL scope: ${request.scope}`,
      "",
      "I confirm this request is for pages we own, control, or are authorized to test.",
    ].join("\n")
  );
  window.location.href = `mailto:${salesEmail}?subject=${subject}&body=${body}`;
});

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  deviceScale = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, Math.floor(rect.width));
  height = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(width * deviceScale);
  canvas.height = Math.floor(height * deviceScale);
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  pointer.x = width * 0.64;
  pointer.y = height * 0.38;
  pointer.targetX = pointer.x;
  pointer.targetY = pointer.y;
}

function seedCells() {
  cells.length = 0;
  const spacing = width < 760 ? 74 : 96;
  const columns = Math.ceil(width / spacing) + 2;
  const rows = Math.ceil(height / spacing) + 2;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const jitter = deterministicNoise(x, y);
      cells.push({
        x: x * spacing - spacing * 0.5 + jitter * 18,
        y: y * spacing - spacing * 0.5 + deterministicNoise(y, x) * 18,
        width: 36 + deterministicNoise(x + 9, y + 3) * 92,
        height: 18 + deterministicNoise(x + 2, y + 11) * 58,
        tone: deterministicNoise(x + 7, y + 13),
        phase: deterministicNoise(x + 1, y + 1) * Math.PI * 2,
      });
    }
  }
}

function draw() {
  frame += 1;
  context.clearRect(0, 0, width, height);
  paintBase();
  movePointer();
  paintCells();
  paintScanLine();
  paintPointer();
  requestAnimationFrame(draw);
}

function paintBase() {
  context.fillStyle = "#050607";
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.08;
  context.strokeStyle = "#f7f3e8";
  context.lineWidth = 1;
  const grid = 48;
  for (let x = -grid; x < width + grid; x += grid) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + height * 0.18, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += grid) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y - width * 0.18);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function movePointer() {
  const t = frame / 72;
  pointer.targetX = width * (0.58 + Math.sin(t * 0.74) * 0.24);
  pointer.targetY = height * (0.34 + Math.cos(t * 0.92) * 0.22);
  pointer.x += (pointer.targetX - pointer.x) * 0.04;
  pointer.y += (pointer.targetY - pointer.y) * 0.04;
}

function paintCells() {
  for (const cell of cells) {
    const distance = Math.hypot(pointer.x - cell.x, pointer.y - cell.y);
    const active = Math.max(0, 1 - distance / 210);
    const pulse = 0.45 + Math.sin(frame / 26 + cell.phase) * 0.25;

    context.lineWidth = 1;
    context.strokeStyle = active > 0.12 ? `rgba(69, 212, 154, ${0.18 + active * 0.62})` : "rgba(247, 243, 232, 0.14)";
    context.fillStyle =
      active > 0.2
        ? `rgba(69, 212, 154, ${0.05 + active * 0.12})`
        : `rgba(247, 243, 232, ${0.02 + cell.tone * 0.03})`;

    context.beginPath();
    roundedRect(context, cell.x, cell.y, cell.width, cell.height, 4);
    context.fill();
    context.stroke();

    if (active > 0.22) {
      context.fillStyle = `rgba(228, 87, 46, ${active * pulse})`;
      context.fillRect(cell.x + 7, cell.y + cell.height - 5, Math.max(8, cell.width * active), 2);
    }
  }
}

function paintScanLine() {
  const x = pointer.x;
  const gradient = context.createLinearGradient(x - 120, 0, x + 140, 0);
  gradient.addColorStop(0, "rgba(228, 87, 46, 0)");
  gradient.addColorStop(0.5, "rgba(228, 87, 46, 0.28)");
  gradient.addColorStop(1, "rgba(228, 87, 46, 0)");
  context.fillStyle = gradient;
  context.fillRect(x - 120, 0, 260, height);
}

function paintPointer() {
  const x = pointer.x;
  const y = pointer.y;

  context.strokeStyle = "rgba(247, 243, 232, 0.86)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + 22, y + 54);
  context.lineTo(x + 35, y + 38);
  context.lineTo(x + 58, y + 36);
  context.closePath();
  context.fillStyle = "#f7f3e8";
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(x, y, 72 + Math.sin(frame / 18) * 8, 0, Math.PI * 2);
  context.strokeStyle = "rgba(69, 212, 154, 0.24)";
  context.stroke();
}

function roundedRect(ctx, x, y, rectWidth, rectHeight, radius) {
  const r = Math.min(radius, rectWidth / 2, rectHeight / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + rectWidth, y, x + rectWidth, y + rectHeight, r);
  ctx.arcTo(x + rectWidth, y + rectHeight, x, y + rectHeight, r);
  ctx.arcTo(x, y + rectHeight, x, y, r);
  ctx.arcTo(x, y, x + rectWidth, y, r);
}

function deterministicNoise(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function priceLabel(price) {
  if (price === "99") return "US$99/mo";
  if (price === "499") return "US$499+";
  return `US$${price}`;
}

function revealInitialViewport() {
  for (const element of reveals) {
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      element.classList.add("is-visible");
    }
  }
}
