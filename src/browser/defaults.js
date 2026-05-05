export const PALS_VERSION = "0.1.0";

export const PALS_LENS_ATTRIBUTE = "data-pals-engine";

export const DEFAULT_SCAN_OPTIONS = {
  document: null,
  text: true,
  openShadowRoots: true,
  sameOriginIframes: true,
  pseudoElements: true,
  zeroAreaBoxes: false,
  elementsWithoutBoxes: false,
  pseudoTargets: ["::before", "::after", "::marker", "::placeholder"],
};
