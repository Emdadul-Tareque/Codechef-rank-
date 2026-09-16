import { UniversityCluster } from './types';

// ---------------------------------------------------------------------------
// 1) Curated alias dictionary for common Bangladeshi universities.
//    Keys = canonical display name. Values = known ways students type it
//    (already lowercase; punctuation/spacing is normalized away before
//    matching, so "B.U.E.T", "buet", "Buet " all match the same alias "buet").
//    This list is intentionally focused on Bangladesh, since that is
//    Phitron's student base — extend it any time in one place.
// ---------------------------------------------------------------------------
const DICTIONARY: Record<string, string[]> = {
  'Bangladesh University of Engineering and Technology (BUET)': [
    'buet',
    'bangladeshuniversityofengineeringandtechnology',
    'bangladeshuniversityofengineeringtechnology',
  ],
  'University of Dhaka (DU)': [
    'du',
    'dhakauniversity',
    'universityofdhaka',
    'dhakauni',
  ],
  'Rajshahi University of Engineering & Technology (RUET)': [
    'ruet',
    'rajshahiuniversityofengineeringtechnology',
    'rajshahiuniversityofengineeringandtechnology',
  ],
  'Khulna University of Engineering & Technology (KUET)': [
    'kuet',
    'khulnauniversityofengineeringtechnology',
    'khulnauniversityofengineeringandtechnology',
  ],
  'Chittagong University of Engineering & Technology (CUET)': [
    'cuet',
    'chittagonguniversityofengineeringtechnology',
    'chittagonguniversityofengineeringandtechnology',
    'ctgengineeringuniversity',
  ],
  'Shahjalal University of Science and Technology (SUST)': [
    'sust',
    'shahjalaluniversityofscienceandtechnology',
    'shahjalaluniversity',
  ],
  'University of Rajshahi': ['ru', 'rajshahiuniversity', 'rajshahiuni'],
  'University of Chittagong (CU)': [
    'cu',
    'chittagonguniversity',
    'universityofchittagong',
    'ctguniversity',
  ],
  'Jahangirnagar University (JU)': [
    'ju',
    'jahangirnagaruniversity',
    'jahangirnagar',
  ],
  'Jagannath University (JnU)': [
    'jnu',
    'jagannathuniversity',
    'jagannath',
  ],
  'Islamic University, Kushtia': [
    'iu',
    'islamicuniversitykushtia',
    'islamicuniversitybangladesh',
  ],
  'Comilla University': ['comu', 'comillauniversity'],
  'Barisal University': ['bu', 'barisaluniversity'],
  'Khulna University': ['kuku', 'khulnauniversity'],
  'Begum Rokeya University, Rangpur (BRUR)': [
    'brur',
    'begumrokeyauniversity',
    'begumrokeyauniversityrangpur',
  ],
  'Pabna University of Science and Technology (PUST)': [
    'pust',
    'pabnauniversityofscienceandtechnology',
  ],
  'Noakhali Science and Technology University (NSTU)': [
    'nstu',
    'noakhaliscienceandtechnologyuniversity',
  ],
  'Jashore University of Science and Technology (JUST)': [
    'just',
    'jessoreuniversityofscienceandtechnology',
    'jashoreuniversityofscienceandtechnology',
  ],
  'Hajee Mohammad Danesh Science and Technology University (HSTU)': [
    'hstu',
    'hajeemohammaddaneshscienceandtechnologyuniversity',
  ],
  'Mawlana Bhashani Science and Technology University (MBSTU)': [
    'mbstu',
    'mawlanabhashanischeandtechnologyuniversity',
    'mawlanabhashaniscienceandtechnologyuniversity',
  ],
  'Bangabandhu Sheikh Mujibur Rahman Science and Technology University (BSMRSTU)':
    ['bsmrstu'],
  'Patuakhali Science and Technology University (PSTU)': [
    'pstu',
    'patuakhaliscienceandtechnologyuniversity',
  ],
  'Bangladesh Agricultural University (BAU)': [
    'bau',
    'bangladeshagriculturaluniversity',
  ],
  'Bangladesh University of Professionals (BUP)': [
    'bup',
    'bangladeshuniversityofprofessionals',
  ],
  'Military Institute of Science and Technology (MIST)': [
    'mist',
    'militaryinstituteofscienceandtechnology',
  ],
  'Dhaka University of Engineering & Technology, Gazipur (DUET)': [
    'duet',
    'dhakauniversityofengineeringtechnology',
  ],
  'Islamic University of Technology (IUT)': [
    'iut',
    'islamicuniversityoftechnology',
  ],
  'North South University (NSU)': [
    'nsu',
    'northsouthuniversity',
  ],
  'BRAC University': ['bracu', 'brac', 'bracuniversity'],
  'American International University-Bangladesh (AIUB)': [
    'aiub',
    'americaninternationaluniversitybangladesh',
  ],
  'Independent University, Bangladesh (IUB)': [
    'iub',
    'independentuniversitybangladesh',
  ],
  'East West University (EWU)': ['ewu', 'eastwestuniversity'],
  'United International University (UIU)': [
    'uiu',
    'unitedinternationaluniversity',
  ],
  'University of Asia Pacific (UAP)': [
    'uap',
    'universityofasiapacific',
  ],
  'Daffodil International University (DIU)': [
    'diu',
    'daffodilinternationaluniversity',
    'daffodil',
  ],
  'Ahsanullah University of Science and Technology (AUST)': [
    'aust',
    'ahsanullahuniversityofscienceandtechnology',
  ],
  'Bangladesh University of Business and Technology (BUBT)': [
    'bubt',
    'bangladeshuniversityofbusinessandtechnology',
  ],
  'World University of Bangladesh (WUB)': [
    'wub',
    'worlduniversityofbangladesh',
  ],
  'Green University of Bangladesh': [
    'green',
    'greenuniversity',
    'greenuniversityofbangladesh',
  ],
  'Southeast University': ['seu', 'southeastuniversity'],
  'City University': ['cityuniversity', 'cityuniversitybangladesh'],
  'Stamford University Bangladesh': [
    'stamford',
    'stamforduniversity',
    'stamforduniversitybangladesh',
  ],
  'Northern University Bangladesh': [
    'nub',
    'northernuniversity',
    'northernuniversitybangladesh',
  ],
  'Uttara University': ['uttarauniversity'],
  'Metropolitan University, Sylhet': [
    'metrouniversity',
    'metropolitanuniversity',
    'metropolitanuniversitysylhet',
  ],
  'Leading University, Sylhet': [
    'leadinguniversity',
    'leadinguniversitysylhet',
  ],
  'Presidency University': ['presidencyuniversity'],
  'Varendra University': ['varendrauniversity'],
  'National University, Bangladesh': [
    'nu',
    'nationaluniversity',
    'nationaluniversitybangladesh',
  ],
  'Bangladesh Open University': [
    'bou',
    'bangladeshopenuniversity',
  ],
};

// ---------------------------------------------------------------------------
// Text normalization helpers
// ---------------------------------------------------------------------------

/** Aggressively strip everything except letters/digits, for alias-key matching. */
function looseKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9]/g, '');
}

/** A softer normalization used for display + fuzzy clustering (keeps word boundaries). */
function softNormalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[.,'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Reverse-index: looseAlias -> canonical, built once.
const ALIAS_INDEX: Map<string, string> = new Map();
for (const [canonical, aliases] of Object.entries(DICTIONARY)) {
  ALIAS_INDEX.set(looseKey(canonical), canonical);
  for (const alias of aliases) {
    ALIAS_INDEX.set(looseKey(alias), canonical);
  }
}

// ---------------------------------------------------------------------------
// 2) Generic fuzzy fallback for anything not in the dictionary
//    (typos, unlisted colleges, foreign universities, etc.)
//    Uses bigram (Dice) similarity — simple, dependency-free, good enough
//    for catching near-duplicate spellings without a heavy NLP library.
// ---------------------------------------------------------------------------

function bigrams(s: string): Set<string> {
  const clean = softNormalize(s).replace(/\s/g, '');
  const grams = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) {
    grams.add(clean.slice(i, i + 2));
  }
  return grams;
}

function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.size === 0 || gb.size === 0) return a === b ? 1 : 0;
  let overlap = 0;
  for (const g of ga) if (gb.has(g)) overlap++;
  return (2 * overlap) / (ga.size + gb.size);
}

const FUZZY_THRESHOLD = 0.72;

export interface UniversityMappingResult {
  clusters: UniversityCluster[];
  applyMap: Record<string, string>; // raw (trimmed) university string -> canonical
}

/**
 * Builds a canonical-university mapping for a list of raw university strings
 * pulled straight from the uploaded sheet (may contain blanks/duplicates).
 *
 * Strategy:
 *  1. Exact/alias match against the curated Bangladeshi-university dictionary.
 *  2. Anything left over is greedily clustered by spelling similarity so that
 *     "North South Uni", "North South University", "NSU" (if not already in
 *     the dictionary) collapse into one bucket.
 *  3. The result is meant for human review (see UniversityMappingReview.tsx)
 *     before being applied — auto-merging low-confidence matches on a
 *     leadership dashboard is worse than asking for ten seconds of eyeballing.
 */
export function buildUniversityMapping(rawList: string[]): UniversityMappingResult {
  const trimmedCounts = new Map<string, number>();
  for (const raw of rawList) {
    const t = (raw || '').trim();
    if (!t) continue;
    trimmedCounts.set(t, (trimmedCounts.get(t) || 0) + 1);
  }

  const applyMap: Record<string, string> = {};
  const clusterMap = new Map<string, UniversityCluster>(); // canonical -> cluster

  const unmatched: Array<{ raw: string; count: number }> = [];

  for (const [raw, count] of trimmedCounts.entries()) {
    const key = looseKey(raw);
    const dictHit = ALIAS_INDEX.get(key);
    if (dictHit) {
      applyMap[raw] = dictHit;
      const existing = clusterMap.get(dictHit);
      if (existing) {
        existing.variants.push(raw);
        existing.count += count;
      } else {
        clusterMap.set(dictHit, { canonical: dictHit, variants: [raw], count });
      }
    } else {
      unmatched.push({ raw, count });
    }
  }

  // Sort unmatched by frequency (most common spelling becomes the canonical
  // label for its cluster — usually the "correct" one on a real roster).
  unmatched.sort((a, b) => b.count - a.count);

  const fuzzyClusters: UniversityCluster[] = [];
  for (const { raw, count } of unmatched) {
    let bestCluster: UniversityCluster | null = null;
    let bestScore = 0;
    for (const cluster of fuzzyClusters) {
      const score = diceSimilarity(raw, cluster.canonical);
      if (score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }
    if (bestCluster && bestScore >= FUZZY_THRESHOLD) {
      bestCluster.variants.push(raw);
      bestCluster.count += count;
      applyMap[raw] = bestCluster.canonical;
    } else {
      const cluster: UniversityCluster = { canonical: raw, variants: [raw], count };
      fuzzyClusters.push(cluster);
      applyMap[raw] = raw;
    }
  }

  const allClusters = [...clusterMap.values(), ...fuzzyClusters].sort(
    (a, b) => b.count - a.count
  );

  return { clusters: allClusters, applyMap };
}

/** Rename a cluster's canonical label after human review (e.g. fix a typo). */
export function renameCluster(
  result: UniversityMappingResult,
  oldCanonical: string,
  newCanonical: string
): UniversityMappingResult {
  const clusters = result.clusters.map((c) =>
    c.canonical === oldCanonical ? { ...c, canonical: newCanonical } : c
  );
  const applyMap: Record<string, string> = {};
  for (const [raw, canon] of Object.entries(result.applyMap)) {
    applyMap[raw] = canon === oldCanonical ? newCanonical : canon;
  }
  return { clusters, applyMap };
}

/** Merge one cluster into another (human decides two auto-detected buckets are the same). */
export function mergeClusters(
  result: UniversityMappingResult,
  fromCanonical: string,
  intoCanonical: string
): UniversityMappingResult {
  if (fromCanonical === intoCanonical) return result;
  const from = result.clusters.find((c) => c.canonical === fromCanonical);
  const into = result.clusters.find((c) => c.canonical === intoCanonical);
  if (!from || !into) return result;

  const mergedInto: UniversityCluster = {
    canonical: into.canonical,
    variants: [...into.variants, ...from.variants],
    count: into.count + from.count,
  };
  const clusters = result.clusters
    .filter((c) => c.canonical !== fromCanonical && c.canonical !== intoCanonical)
    .concat(mergedInto);

  const applyMap: Record<string, string> = {};
  for (const [raw, canon] of Object.entries(result.applyMap)) {
    applyMap[raw] = canon === fromCanonical ? intoCanonical : canon;
  }

  return { clusters, applyMap };
}
