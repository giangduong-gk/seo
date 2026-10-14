/* ───────── Rule engine: phát hiện cannibalization bằng code (không tốn token) ───────── */

const STOP = new Set(["và", "của", "cho", "là", "có", "the", "a", "an", "of", "to", "in", "for", "với", "bao", "nhiêu", "gì", "nào"]);

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export type OverlapWarning = { a: string; b: string; similarity: number; sameIntent: boolean };

/** Cặp từ khoá cùng ý định và trùng ≥ 60% token → nguy cơ hai URL cạnh tranh nhau. */
export function detectKeywordOverlap(items: { term: string; intent?: string | null }[], threshold = 0.6): OverlapWarning[] {
  const out: OverlapWarning[] = [];
  const toks = items.map((i) => tokens(i.term));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = jaccard(toks[i], toks[j]);
      const sameIntent = !!items[i].intent && items[i].intent === items[j].intent;
      if (sim >= threshold && sameIntent) out.push({ a: items[i].term, b: items[j].term, similarity: sim, sameIntent });
    }
  }
  return out.sort((x, y) => y.similarity - x.similarity);
}
