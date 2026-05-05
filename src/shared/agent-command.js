const STOP_WORDS = new Set([
  "a",
  "aba",
  "abra",
  "agora",
  "ao",
  "botao",
  "button",
  "campo",
  "clique",
  "click",
  "cursor",
  "de",
  "do",
  "em",
  "execute",
  "ir",
  "mova",
  "mover",
  "mouse",
  "no",
  "o",
  "para",
  "ponteiro",
  "por",
  "the",
  "to",
  "va",
]);

export function parseAgentInstruction(input) {
  const raw = String(input || "").trim();
  const normalized = normalizeInstruction(raw);

  if (!normalized) {
    return unknown("Empty instruction.");
  }

  const coordinate = parseCoordinates(normalized);
  const typeText = parseTypeText(raw);
  const targetPoints = parsePointCount(normalized);

  if (
    /\b(denso|dense|alta precisao|high density|10k|ultrarapido|ultra rapido|malha densa)\b/.test(
      normalized
    ) ||
    targetPoints >= 10000
  ) {
    return {
      type: "dense-scan",
      targetPoints: targetPoints || 10000,
      label: `Run high-density scan with ${targetPoints || 10000} points`,
      raw,
    };
  }

  if (/\b(varra|varrer|sweep|scan\s+mouse|escaneie\s+com\s+mouse)\b/.test(normalized)) {
    return {
      type: "sweep",
      label: "Sweep current viewport with the real pointer",
      step: 160,
      raw,
    };
  }

  if (/\b(scan|escaneie|auditoria|audite|analisar|analise)\b/.test(normalized)) {
    return {
      type: "scan",
      label: "Run local PALS scan",
      raw,
    };
  }

  if (typeText) {
    return {
      type: "type",
      text: typeText,
      label: `Type ${typeText.length} characters`,
      raw,
    };
  }

  if (/\b(clique|click|pressione|apertar|aperte)\b/.test(normalized)) {
    if (coordinate) {
      return {
        type: "click-coordinates",
        point: coordinate,
        label: `Click viewport coordinate ${coordinate.x}, ${coordinate.y}`,
        raw,
      };
    }

    const query = extractTargetQuery(normalized);
    return query
      ? {
          type: "click-target",
          query,
          label: `Click target matching "${query}"`,
          raw,
        }
      : unknown("Click instruction needs coordinates or a target name.", raw);
  }

  if (/\b(mova|mover|move|va|ir|ponteiro|cursor|mouse)\b/.test(normalized)) {
    if (coordinate) {
      return {
        type: "move-coordinates",
        point: coordinate,
        label: `Move pointer to viewport coordinate ${coordinate.x}, ${coordinate.y}`,
        raw,
      };
    }

    const query = extractTargetQuery(normalized);
    return query
      ? {
          type: "move-target",
          query,
          label: `Move pointer to target matching "${query}"`,
          raw,
        }
      : unknown("Move instruction needs coordinates or a target name.", raw);
  }

  return unknown("Instruction not recognized by the local PALS agent.", raw);
}

export function parseAgentPlan(input) {
  const raw = String(input || "").trim();
  if (!raw) return [];

  const parts = raw
    .split(/\n+|;|\s+(?:e\s+)?depois\s+|\s+then\s+|\s+em\s+seguida\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return [parseAgentInstruction(raw)];
  }

  return parts.map((part) => parseAgentInstruction(part));
}

export function normalizeInstruction(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s=,.'"#:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTargetQuery(normalizedInput) {
  const withoutCoordinates = normalizedInput
    .replace(/\bx\s*=?\s*\d{1,5}\b/g, " ")
    .replace(/\by\s*=?\s*\d{1,5}\b/g, " ")
    .replace(/\b\d{1,5}\s*[, ]\s*\d{1,5}\b/g, " ");
  const quoted = withoutCoordinates.match(/["']([^"']{2,80})["']/);
  const source = quoted ? quoted[1] : withoutCoordinates;
  const tokens = source
    .split(/\s+/)
    .map((token) => token.replace(/^#+/, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  return [...new Set(tokens)].slice(0, 6).join(" ");
}

export function parseCoordinates(normalizedInput) {
  const xy = normalizedInput.match(/\bx\s*=?\s*(\d{1,5})\D{0,12}\by\s*=?\s*(\d{1,5})\b/);
  if (xy) return point(Number(xy[1]), Number(xy[2]));

  const yx = normalizedInput.match(/\by\s*=?\s*(\d{1,5})\D{0,12}\bx\s*=?\s*(\d{1,5})\b/);
  if (yx) return point(Number(yx[2]), Number(yx[1]));

  const pair = normalizedInput.match(/\b(\d{1,5})\s*[,;]\s*(\d{1,5})\b/);
  if (pair) return point(Number(pair[1]), Number(pair[2]));

  const loose = normalizedInput.match(/\b(\d{1,5})\s+(\d{1,5})\b/);
  if (loose) return point(Number(loose[1]), Number(loose[2]));

  return null;
}

function parseTypeText(rawInput) {
  const normalized = normalizeInstruction(rawInput);
  if (!/\b(digite|type|escreva|preencha)\b/.test(normalized)) return null;

  const quoted = String(rawInput || "").match(/["']([^"']{1,240})["']/);
  if (quoted) return quoted[1];

  return normalized
    .replace(/\b(digite|type|escreva|preencha|texto|com|o|a)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function parsePointCount(normalizedInput) {
  if (/\b10\s*mil\b/.test(normalizedInput)) return 10000;
  if (/\bdez\s+mil\b/.test(normalizedInput)) return 10000;
  const match = normalizedInput.match(/\b(\d{4,6})\s*(pontos|points|pts)?\b/);
  if (!match) return 0;
  return Number(match[1]);
}

function point(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.round(x), y: Math.round(y) };
}

function unknown(reason, raw = "") {
  return {
    type: "unknown",
    label: "Unknown instruction",
    reason,
    raw,
  };
}
