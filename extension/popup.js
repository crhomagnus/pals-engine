let currentScan = null;

const elements = {
  dot: document.getElementById("state-dot"),
  statusTitle: document.getElementById("status-title"),
  statusDetail: document.getElementById("status-detail"),
  quickAudit: document.getElementById("quick-audit"),
  startLive: document.getElementById("start-live"),
  stopLive: document.getElementById("stop-live"),
  downloadMd: document.getElementById("download-md"),
  downloadJson: document.getElementById("download-json"),
  samples: document.getElementById("metric-samples"),
  findings: document.getElementById("metric-findings"),
  high: document.getElementById("metric-high"),
};

elements.quickAudit.addEventListener("click", async () => {
  setWorking("Running quick audit", "Sampling visible viewport grid.");
  const response = await sendToActiveTab({ type: "PALS_QUICK_AUDIT" });
  handleScanResponse(response);
});

elements.startLive.addEventListener("click", async () => {
  setWorking("Starting live capture", "Move through the page with the pointer.");
  const response = await sendToActiveTab({ type: "PALS_START_LIVE", options: { lens: true } });
  if (response.ok) setLive(response);
  else setError(response.error);
});

elements.stopLive.addEventListener("click", async () => {
  setWorking("Stopping live capture", "Preparing local audit files.");
  const response = await sendToActiveTab({ type: "PALS_STOP_LIVE" });
  handleScanResponse(response);
});

elements.downloadMd.addEventListener("click", () => {
  if (!currentScan) return;
  downloadText("pals-extension-audit.MD", generateMarkdownReport(currentScan), "text/markdown");
});

elements.downloadJson.addEventListener("click", () => {
  if (!currentScan) return;
  downloadText(
    "pals-extension-audit.json",
    JSON.stringify(currentScan, null, 2),
    "application/json"
  );
});

refreshStatus();

async function refreshStatus() {
  const response = await sendToActiveTab({ type: "PALS_STATUS" });
  if (response.ok) {
    if (response.live) setLive(response);
    else setReady(response);
  } else {
    setError(response.error);
  }
}

function handleScanResponse(response) {
  if (!response.ok) {
    setError(response.error);
    return;
  }

  currentScan = response.scan;
  setReady({
    samples: currentScan.aggregate.points,
    title: currentScan.title,
    url: currentScan.url,
  });
  updateMetrics(currentScan);
  elements.downloadMd.disabled = false;
  elements.downloadJson.disabled = false;
}

function setReady(response) {
  elements.dot.className = "ready";
  elements.statusTitle.textContent = "Ready";
  elements.statusDetail.textContent = response.title || response.url || "Page connected.";
  elements.stopLive.disabled = true;
}

function setLive(response) {
  elements.dot.className = "live";
  elements.statusTitle.textContent = "Live capture active";
  elements.statusDetail.textContent = `${response.samples || 0} pointer samples captured.`;
  elements.stopLive.disabled = false;
  elements.samples.textContent = response.samples || 0;
}

function setWorking(title, detail) {
  elements.dot.className = "";
  elements.statusTitle.textContent = title;
  elements.statusDetail.textContent = detail;
}

function setError(message) {
  elements.dot.className = "error";
  elements.statusTitle.textContent = "Unavailable";
  elements.statusDetail.textContent = message || "Could not reach this page.";
}

function updateMetrics(scan) {
  elements.samples.textContent = scan.aggregate.points;
  elements.findings.textContent = scan.findings.summary.total;
  elements.high.textContent = scan.findings.summary.high;
}

async function sendToActiveTab(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { ok: false, error: "No active tab." };
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    return {
      ok: false,
      error:
        "PALS content script is not available here. Reload the page or open a regular http/https tab.",
    };
  }
}

function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
