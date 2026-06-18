/**
 * Custom Entries — localStorage-backed store for user-added roles and
 * industries that don't exist in the canonical catalog
 * (`industryRoles.ts` + `/api/ontology/*`).
 *
 * Used by the Competency Assessment landing in `CareerBuilderPage.tsx`
 * to let candidates add their own role/target-role/industry when the
 * predictive list doesn't surface what they need (e.g. "Founder",
 * "Chief of Staff", "DevRel Lead", emerging titles, niche industries).
 *
 * Each entry is normalised on save (trim + collapsed whitespace +
 * title-case display) and deduped case-insensitively. Custom entries are
 * tagged visibly in the UI ("Custom") and are accepted by the strict
 * canonical-membership validator (the validator unions catalog + custom).
 *
 * Custom entries intentionally carry no industry/department/sub-dept
 * metadata, so peer benchmarks and adjacency moves fall back to baseline
 * behaviour until / unless we map them later.
 */
const KEY_ROLES = 'mx-custom-roles';
const KEY_INDUSTRIES = 'mx-custom-industries';

export interface CustomEntry {
  /** Display label as the user typed it (title-cased + trimmed). */
  label: string;
  /** Lowercased canonical key used for dedupe + validation lookups. */
  key: string;
  /** Unix ms when first added — drives sort order (most recent first). */
  addedAt: number;
}

function titleCase(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function readList(key: string): CustomEntry[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is CustomEntry =>
        e && typeof e.label === 'string' && typeof e.key === 'string' && typeof e.addedAt === 'number',
    );
  } catch {
    return [];
  }
}

function writeList(key: string, list: CustomEntry[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* quota / private-mode — silently no-op */
  }
}

function addEntry(key: string, label: string): CustomEntry[] {
  const cleaned = titleCase(label);
  if (!cleaned || cleaned.length < 2) return readList(key);
  const lower = cleaned.toLowerCase();
  const list = readList(key);
  if (list.some(e => e.key === lower)) return list;
  const next: CustomEntry[] = [{ label: cleaned, key: lower, addedAt: Date.now() }, ...list]
    .slice(0, 50); // cap so localStorage stays small
  writeList(key, next);
  return next;
}

function removeEntry(key: string, entryKey: string): CustomEntry[] {
  const next = readList(key).filter(e => e.key !== entryKey.toLowerCase());
  writeList(key, next);
  return next;
}

// ── Roles (used for both Current Role + Target Role fields) ──────────────
export const listCustomRoles = (): CustomEntry[] => readList(KEY_ROLES);
export const addCustomRole = (label: string): CustomEntry[] => addEntry(KEY_ROLES, label);
export const removeCustomRole = (key: string): CustomEntry[] => removeEntry(KEY_ROLES, key);

// ── Industries ───────────────────────────────────────────────────────────
export const listCustomIndustries = (): CustomEntry[] => readList(KEY_INDUSTRIES);
export const addCustomIndustry = (label: string): CustomEntry[] => addEntry(KEY_INDUSTRIES, label);
export const removeCustomIndustry = (key: string): CustomEntry[] =>
  removeEntry(KEY_INDUSTRIES, key);

/** True if the value is a user-added custom entry (case-insensitive). */
export const isCustomRole = (value: string): boolean =>
  !!value && listCustomRoles().some(e => e.key === value.trim().toLowerCase());
export const isCustomIndustry = (value: string): boolean =>
  !!value && listCustomIndustries().some(e => e.key === value.trim().toLowerCase());
