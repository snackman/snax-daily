// Content exclusions — stories matching these are dropped before ranking.
// This is the cheap, deterministic layer (works even without the LLM); the
// ranking prompt in rank.ts adds smarter, context-aware filtering on top.
//
// Add categories/terms here as your taste evolves.

/** Automotive / car news — not of interest. */
const AUTOMOTIVE_TERMS = [
  // generic vehicle vocabulary (matched as whole words)
  "car",
  "cars",
  "suv",
  "suvs",
  "sedan",
  "sedans",
  "truck",
  "pickup",
  "coupe",
  "hatchback",
  "minivan",
  "crossover",
  "4x4",
  "horsepower",
  // brands / models that are unambiguously automotive
  "toyota",
  "honda",
  "chevrolet",
  "chevy",
  "bmw",
  "mercedes",
  "audi",
  "porsche",
  "nissan",
  "mitsubishi",
  "hyundai",
  "volkswagen",
  "subaru",
  "lexus",
  "rivian",
  "jeep",
  "pajero",
];

/** Multi-word / hyphenated exclusion phrases (matched as substrings). */
const EXCLUDE_PHRASES = [
  "electric vehicle",
  "electric car",
  "test drive",
  "0-60",
  "f-150",
  "ford motor",
];

export const ALL_EXCLUDE_SINGLE_WORDS = AUTOMOTIVE_TERMS;

/**
 * Terms that keep a story even if it tripped an exclusion above — e.g. an
 * autonomous / self-driving story is robotics + AI (of interest), not "car
 * news", so a car keyword shouldn't drop it.
 */
const KEEP_OVERRIDE_TERMS = [
  "robot",
  "robots",
  "robotic",
  "robotics",
  "humanoid",
  "autonomous",
  "self-driving",
  "driverless",
  "neural interface",
  "brain-computer",
  "brain computer",
  "bci",
  "neuralink",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const wordRe = new RegExp(
  `\\b(${ALL_EXCLUDE_SINGLE_WORDS.map(escapeRegExp).join("|")})\\b`,
  "i",
);
const overrideRe = new RegExp(
  `\\b(${KEEP_OVERRIDE_TERMS.map(escapeRegExp).join("|")})\\b`,
  "i",
);

/**
 * True if the given text (title + snippet) matches an excluded category and is
 * not rescued by a keep-override term. Whole-word matching avoids false
 * positives like "card" or "Carbon".
 */
export function isExcluded(text: string): boolean {
  if (!text) return false;
  if (overrideRe.test(text)) return false;
  if (wordRe.test(text)) return true;
  const lower = text.toLowerCase();
  return EXCLUDE_PHRASES.some((p) => lower.includes(p));
}
