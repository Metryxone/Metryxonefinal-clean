/**
 * OntologyMatrixPanel — CRUD for `adaptive_ontology_edges`.
 *
 * Backs the runtime OR-join in `pickQuestionsFromDB` (capadex-concern-intelligence.ts):
 * a user with primary concern_bucket = X also receives approved questions
 * tagged for any target_bucket where (source_bucket=X, weight>=0.60, status='approved').
 *
 * Manual POSTs through this panel always land as `status='draft'` (server-enforced);
 * admin must explicitly PATCH to `status='approved'` to surface the correlation
 * to the runtime picker.
 */
import { CrudTable, type ColDef, type FieldDef } from '@/components/admin/CrudTable';

const COLS: ColDef[] = [
  { key: 'id',            label: 'ID',     mono: true },
  { key: 'source_bucket', label: 'Source', mono: true },
  { key: 'target_bucket', label: 'Target', mono: true },
  { key: 'weight',        label: 'Weight', mono: true },
  { key: 'status',        label: 'Status' },
  { key: 'created_at',    label: 'Created' },
];

const FIELDS: FieldDef[] = [
  { key: 'source_bucket', label: 'Source Concern Bucket', type: 'text', required: true,
    placeholder: 'e.g. anxiety, focus, motivation' },
  { key: 'target_bucket', label: 'Correlated Target Bucket', type: 'text', required: true,
    placeholder: 'must differ from source' },
  { key: 'weight', label: 'Correlation Weight (0.00 – 1.00)', type: 'number', required: true,
    placeholder: '0.60' },
  { key: 'status', label: 'Status', type: 'select',
    options: [
      { value: 'draft',    label: 'Draft (not live)' },
      { value: 'approved', label: 'Approved (live in picker)' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'archived', label: 'Archived' },
    ],
  },
];

export default function OntologyMatrixPanel() {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Adaptive Ontology Matrix</h2>
        <p className="text-xs text-slate-500 mt-1">
          Concern-bucket correlation edges consumed by the CAPADEX question picker.
          Approved edges with <span className="font-mono">weight ≥ 0.60</span> expand the runtime
          query so users see questions from related buckets, not just their primary concern.
          New rows are saved as <span className="font-mono">draft</span> and require explicit promotion to <span className="font-mono">approved</span>.
        </p>
      </div>
      <CrudTable
        title="Ontology Edges"
        color="#344E86"
        apiPath="/api/admin/capadex/ontology"
        adminApiPath="/api/admin/capadex/ontology"
        cols={COLS}
        fields={FIELDS}
        defaultValues={{ weight: 0.6, status: 'draft' }}
        filterKeys={['source_bucket', 'status']}
      />
    </div>
  );
}
