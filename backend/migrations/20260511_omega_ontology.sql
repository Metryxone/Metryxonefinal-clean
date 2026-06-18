-- CAPADEX OMEGA-X Behavioural Ontology
-- Graph-based causation and intervention relationships

CREATE TABLE IF NOT EXISTS omega_ontology_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_key TEXT NOT NULL UNIQUE,
  node_type TEXT NOT NULL CHECK (node_type IN (
    'concern','domain','competency','signal','trigger','reinforcement',
    'vulnerability','protective_factor','behaviour','severity_marker',
    'stability_marker','intervention','recovery_indicator','relapse_marker'
  )),
  label TEXT NOT NULL,
  description TEXT,
  concern_category TEXT,
  severity_weight NUMERIC(4,3) DEFAULT 1.0,
  emotional_valence TEXT CHECK (emotional_valence IN ('positive','negative','neutral')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS omega_ontology_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_key TEXT NOT NULL REFERENCES omega_ontology_nodes(node_key) ON DELETE CASCADE,
  to_node_key TEXT NOT NULL REFERENCES omega_ontology_nodes(node_key) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN (
    'causes','reinforces','triggers','protects_against','enables_intervention',
    'predicts_relapse','indicates_recovery','worsens','ameliorates',
    'co_occurs_with','prerequisite_for'
  )),
  weight NUMERIC(4,3) DEFAULT 1.0,
  confidence NUMERIC(4,3) DEFAULT 0.8,
  evidence_base TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_node_key, to_node_key, edge_type)
);

CREATE TABLE IF NOT EXISTS omega_concern_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_category TEXT NOT NULL,
  concern_name_pattern TEXT NOT NULL,
  root_node_key TEXT NOT NULL REFERENCES omega_ontology_nodes(node_key),
  subgraph_node_keys JSONB DEFAULT '[]',
  priority_intervention_keys JSONB DEFAULT '[]',
  safety_flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS omega_session_ontology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  active_node_keys JSONB DEFAULT '[]',
  causal_chain JSONB DEFAULT '[]',
  trigger_nodes JSONB DEFAULT '[]',
  protective_nodes JSONB DEFAULT '[]',
  intervention_sequence JSONB DEFAULT '[]',
  confidence_map JSONB DEFAULT '{}',
  safety_status TEXT DEFAULT 'informational' CHECK (safety_status IN ('informational','supportive','referral')),
  safety_flags JSONB DEFAULT '[]',
  calibration JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_omega_nodes_type ON omega_ontology_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_omega_nodes_category ON omega_ontology_nodes(concern_category);
CREATE INDEX IF NOT EXISTS idx_omega_edges_from ON omega_ontology_edges(from_node_key);
CREATE INDEX IF NOT EXISTS idx_omega_edges_to ON omega_ontology_edges(to_node_key);
CREATE INDEX IF NOT EXISTS idx_omega_edges_type ON omega_ontology_edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_omega_session_ontology_session ON omega_session_ontology(session_id);
