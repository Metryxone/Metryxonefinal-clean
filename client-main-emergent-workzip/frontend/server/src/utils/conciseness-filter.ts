// ─── Concise Mode Post-Processing ─────────────────────────────────────────────
// Extracts the most meaningful part of a response when responseStyle is 'concise'.
// For bullet/numbered lists: returns the framing intro (if any) + first bullet.
// For plain paragraphs: returns the first non-header block (or its first sentence
// when the first block is just a short header). Single-block text is trimmed to
// two sentences.
export function applyConcisenessFilter(text: string): string {
  const lines = text.split('\n');
  const bulletPattern = /^\s*([-*•]|\d+[.)]) /;
  const hasBullets = lines.some(l => bulletPattern.test(l));

  if (hasBullets) {
    // Find where the first bullet appears
    const firstBulletIdx = lines.findIndex(l => bulletPattern.test(l));
    const introText = lines.slice(0, firstBulletIdx).join('\n').trim();
    const firstBullet = lines[firstBulletIdx]?.trim() ?? '';

    // Summarise the intro: keep as-is when it's a short header, otherwise
    // extract its first sentence so the framing stays tight.
    const introIsHeader = !introText || introText.endsWith(':') || introText.length < 80;
    const introSummary = introIsHeader
      ? introText
      : ((introText.match(/[^.!?]+[.!?]+/g) ?? [])[0]?.trim() ?? introText.trim());

    // Always pair the framing with the first concrete bullet — that is the
    // actionable content the user actually needs in concise mode.
    const parts: string[] = [];
    if (introSummary) parts.push(introSummary);
    if (firstBullet) parts.push(firstBullet);
    return parts.join('\n').trim();
  }

  // No bullets — paragraph-based approach
  const blocks = text.split(/\n\n+/);
  if (blocks.length <= 1) {
    // Single block — keep first 2 sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
    if (sentences.length <= 2) return text;
    return sentences.slice(0, 2).join(' ').trim();
  }

  const first = (blocks.find(b => b.trim().length > 0) ?? blocks[0]).trim();

  // If first block is just a header (ends with ':' or very short), reach into the next block
  if ((first.endsWith(':') || first.length < 60) && blocks.length > 1) {
    const second = blocks.slice(1).find(b => b.trim().length > 0);
    if (second) {
      const secondSentences = second.match(/[^.!?]+[.!?]+/g) ?? [];
      const secondPart = secondSentences.length > 0 ? secondSentences[0]!.trim() : second.trim();
      return `${first}\n${secondPart}`;
    }
  }

  return first;
}
