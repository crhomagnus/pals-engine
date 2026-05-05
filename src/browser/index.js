import { PALS_VERSION } from "./defaults.js";
import { createScanner } from "./scanner.js";
import { createLens } from "./lens.js";
import {
  bodiesUnderPointer,
  compactSummary,
  measuredRelations,
  nearestBodies,
  relationsBySelector,
} from "./reporter.js";
import { createHoverDelta } from "./hover-sensor.js";
import { pageSignature } from "./page-signature.js";
import { semanticMap } from "./semantic-map.js";

export function createPalsEngine(root = globalThis) {
  const scanner = createScanner(root);
  const lens = createLens(root, scanner);

  return {
    name: "Pointer-Adaptive Layout Scanner Engine",
    shortName: "PALS Engine",
    version: PALS_VERSION,
    observe: scanner.observe,
    stopObserving: scanner.stopObserving,
    scanPoint: scanner.scanPoint,
    scanEvent: scanner.scanEvent,
    scanViewport: scanner.scanViewport,
    captureNextClick: scanner.captureNextClick,
    activateLens: lens.activateLens,
    deactivateLens: lens.deactivateLens,
    tools: {
      measuredRelations,
      bodiesUnderPointer,
      nearestBodies,
      relationsBySelector,
      compactSummary,
      createHoverDelta,
      pageSignature: () => pageSignature(root),
      semanticMap: () => semanticMap(root),
    },
  };
}

export function createLegacyAdapter(engine) {
  return {
    observar: engine.observe,
    desligarTudo: engine.stopObserving,
    mapear: engine.scanPoint,
    mapearEvento: engine.scanEvent,
    ativarLente: engine.activateLens,
    desativarLente: engine.deactivateLens,
    capturarProximoClique: engine.captureNextClick,
    ferramentas: {
      corposSobPonteiro: engine.tools.bodiesUnderPointer,
      corposMaisProximos: engine.tools.nearestBodies,
      relacoesPorSeletor: engine.tools.relationsBySelector,
      resumoCurto: engine.tools.compactSummary,
    },
  };
}
