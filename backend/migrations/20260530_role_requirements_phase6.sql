-- ============================================================
-- Phase 6 — Role Requirements (Technical / Certifications / Education /
--                              Functional / Tools / Domain Expertise)
-- Migration: 20260530_role_requirements_phase6.sql
-- Read-only against onto_*; namespaced rr_* (role-requirement).
-- Idempotent: CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING.
-- ============================================================

CREATE TABLE IF NOT EXISTS rr_technical_skills (
  id               BIGSERIAL PRIMARY KEY,
  role_id          TEXT     NOT NULL REFERENCES onto_roles(id) ON DELETE CASCADE,
  skill_name       TEXT     NOT NULL,
  category         TEXT     NOT NULL CHECK (category IN
                    ('language','framework','database','cloud','devops','data','security','api','testing','other')),
  required_level   TEXT     NOT NULL CHECK (required_level IN ('critical','required','preferred','nice_to_have')),
  weight           NUMERIC  NOT NULL DEFAULT 1.0,
  ei_impact        NUMERIC  NOT NULL DEFAULT 2.0,
  effort_hours     NUMERIC  NOT NULL DEFAULT 8.0,
  evidence_hint    TEXT,
  UNIQUE (role_id, skill_name)
);
CREATE INDEX IF NOT EXISTS idx_rr_tech_role ON rr_technical_skills(role_id);

CREATE TABLE IF NOT EXISTS rr_certifications (
  id            BIGSERIAL PRIMARY KEY,
  role_id       TEXT NOT NULL REFERENCES onto_roles(id) ON DELETE CASCADE,
  cert_name     TEXT NOT NULL,
  provider      TEXT NOT NULL,
  importance    TEXT NOT NULL CHECK (importance IN ('critical','preferred','nice_to_have')),
  ei_impact     NUMERIC NOT NULL DEFAULT 4.0,
  effort_hours  NUMERIC NOT NULL DEFAULT 40.0,
  validity_months INTEGER,
  UNIQUE (role_id, cert_name, provider)
);
CREATE INDEX IF NOT EXISTS idx_rr_cert_role ON rr_certifications(role_id);

CREATE TABLE IF NOT EXISTS rr_education (
  role_id           TEXT PRIMARY KEY REFERENCES onto_roles(id) ON DELETE CASCADE,
  min_degree        TEXT NOT NULL CHECK (min_degree IN ('none','diploma','bachelors','masters','phd')),
  preferred_fields  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  importance        TEXT NOT NULL CHECK (importance IN ('critical','preferred','nice_to_have')),
  ei_impact         NUMERIC NOT NULL DEFAULT 5.0
);

CREATE TABLE IF NOT EXISTS rr_functional_skills (
  id            BIGSERIAL PRIMARY KEY,
  role_id       TEXT NOT NULL REFERENCES onto_roles(id) ON DELETE CASCADE,
  functional_area TEXT NOT NULL,
  depth         TEXT NOT NULL CHECK (depth IN ('basic','proficient','expert')),
  weight        NUMERIC NOT NULL DEFAULT 1.0,
  ei_impact     NUMERIC NOT NULL DEFAULT 3.0,
  effort_hours  NUMERIC NOT NULL DEFAULT 12.0,
  evidence_hint TEXT,
  UNIQUE (role_id, functional_area)
);
CREATE INDEX IF NOT EXISTS idx_rr_func_role ON rr_functional_skills(role_id);

CREATE TABLE IF NOT EXISTS rr_tools (
  id            BIGSERIAL PRIMARY KEY,
  role_id       TEXT NOT NULL REFERENCES onto_roles(id) ON DELETE CASCADE,
  tool_name     TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN
                  ('ide','vcs','ci_cd','monitoring','collaboration','design','data','project','security','other')),
  importance    TEXT NOT NULL CHECK (importance IN ('critical','required','preferred','nice_to_have')),
  ei_impact     NUMERIC NOT NULL DEFAULT 1.5,
  effort_hours  NUMERIC NOT NULL DEFAULT 4.0,
  UNIQUE (role_id, tool_name)
);
CREATE INDEX IF NOT EXISTS idx_rr_tools_role ON rr_tools(role_id);

CREATE TABLE IF NOT EXISTS rr_domain_expertise (
  id            BIGSERIAL PRIMARY KEY,
  role_id       TEXT NOT NULL REFERENCES onto_roles(id) ON DELETE CASCADE,
  domain        TEXT NOT NULL,
  years_typical NUMERIC NOT NULL DEFAULT 1.0,
  importance    TEXT NOT NULL CHECK (importance IN ('critical','preferred','nice_to_have')),
  ei_impact     NUMERIC NOT NULL DEFAULT 3.5,
  effort_hours  NUMERIC NOT NULL DEFAULT 80.0,
  UNIQUE (role_id, domain)
);
CREATE INDEX IF NOT EXISTS idx_rr_domain_role ON rr_domain_expertise(role_id);

-- ============================================================
-- SEED
-- ============================================================

-- ---------- role_be_eng :: Backend Engineer ----------
INSERT INTO rr_technical_skills (role_id, skill_name, category, required_level, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_be_eng','Python','language','critical',1.0,3.0,40,'Production service in Python'),
  ('role_be_eng','Java','language','required',0.8,2.5,60,'JVM service or library'),
  ('role_be_eng','Go','language','preferred',0.5,2.0,40,'Concurrency-heavy service'),
  ('role_be_eng','SQL','language','critical',1.0,3.0,20,'Joins, window functions, indexing'),
  ('role_be_eng','REST API design','api','critical',1.0,3.5,16,'Versioned REST contract'),
  ('role_be_eng','gRPC','api','preferred',0.6,2.0,16,'Service-to-service gRPC'),
  ('role_be_eng','PostgreSQL','database','critical',1.0,3.0,20,'Schema design + tuning'),
  ('role_be_eng','Redis','database','required',0.8,2.0,8,'Caching / queue use case'),
  ('role_be_eng','AWS','cloud','critical',1.0,3.5,40,'EC2/S3/RDS/Lambda hands-on'),
  ('role_be_eng','Docker','devops','critical',1.0,2.5,8,'Containerised app'),
  ('role_be_eng','Kubernetes','devops','preferred',0.6,2.5,40,'Pod / deployment manifests'),
  ('role_be_eng','CI/CD pipelines','devops','required',0.8,2.0,12,'Automated deploy pipeline'),
  ('role_be_eng','Unit testing','testing','critical',1.0,2.0,8,'>70% coverage on a service'),
  ('role_be_eng','OAuth / JWT auth','security','required',0.8,2.5,8,'Token-based auth flow'),
  ('role_be_eng','Observability (logs/metrics/traces)','devops','required',0.8,2.0,12,'Tracing across services')
ON CONFLICT (role_id, skill_name) DO NOTHING;

INSERT INTO rr_certifications (role_id, cert_name, provider, importance, ei_impact, effort_hours, validity_months) VALUES
  ('role_be_eng','AWS Certified Developer – Associate','AWS','preferred',5,80,36),
  ('role_be_eng','Certified Kubernetes Application Developer (CKAD)','CNCF','preferred',5,60,24),
  ('role_be_eng','HashiCorp Certified: Terraform Associate','HashiCorp','nice_to_have',3,40,24),
  ('role_be_eng','Oracle Certified Java Programmer','Oracle','nice_to_have',3,60,36),
  ('role_be_eng','PostgreSQL Certified Engineer','EDB','nice_to_have',3,50,36)
ON CONFLICT (role_id, cert_name, provider) DO NOTHING;

INSERT INTO rr_education (role_id, min_degree, preferred_fields, importance, ei_impact) VALUES
  ('role_be_eng','bachelors', ARRAY['Computer Science','Software Engineering','Information Technology','Electronics'],'preferred',5)
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO rr_functional_skills (role_id, functional_area, depth, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_be_eng','Distributed systems','proficient',1.0,3.5,40,'Designed a multi-service rollout'),
  ('role_be_eng','Performance tuning','proficient',0.9,2.5,16,'Profiled and optimised a hot path'),
  ('role_be_eng','Data modelling','proficient',0.9,2.5,12,'Normalised schema design'),
  ('role_be_eng','Incident response','basic',0.7,2.0,8,'Participated in on-call rotation')
ON CONFLICT (role_id, functional_area) DO NOTHING;

INSERT INTO rr_tools (role_id, tool_name, category, importance, ei_impact, effort_hours) VALUES
  ('role_be_eng','Git','vcs','critical',2,4),
  ('role_be_eng','GitHub Actions','ci_cd','required',1.5,4),
  ('role_be_eng','Datadog','monitoring','preferred',1.5,6),
  ('role_be_eng','Grafana','monitoring','preferred',1.5,6),
  ('role_be_eng','Jira','project','required',1,2),
  ('role_be_eng','Postman','other','required',1,2),
  ('role_be_eng','VS Code','ide','preferred',0.5,1),
  ('role_be_eng','PagerDuty','monitoring','preferred',1.5,2),
  ('role_be_eng','Snyk','security','nice_to_have',1.5,4),
  ('role_be_eng','LaunchDarkly','other','nice_to_have',1,2)
ON CONFLICT (role_id, tool_name) DO NOTHING;

INSERT INTO rr_domain_expertise (role_id, domain, years_typical, importance, ei_impact, effort_hours) VALUES
  ('role_be_eng','B2B SaaS',2,'preferred',3.5,80),
  ('role_be_eng','Fintech',2,'preferred',4.0,80),
  ('role_be_eng','High-volume transactional systems',2,'preferred',4.0,120)
ON CONFLICT (role_id, domain) DO NOTHING;

-- ---------- role_sr_be_eng :: Senior Backend Engineer ----------
INSERT INTO rr_technical_skills (role_id, skill_name, category, required_level, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_sr_be_eng','Python','language','critical',1.0,3.0,40,'Production service in Python'),
  ('role_sr_be_eng','Go','language','required',0.8,2.5,60,'Concurrent service'),
  ('role_sr_be_eng','SQL','language','critical',1.0,3.0,20,'Query optimisation'),
  ('role_sr_be_eng','System design','api','critical',1.2,4.0,40,'Owned a system design doc'),
  ('role_sr_be_eng','Event-driven architecture','api','required',1.0,3.0,24,'Kafka / SNS-SQS in production'),
  ('role_sr_be_eng','PostgreSQL','database','critical',1.0,3.0,20,'Replication, partitioning'),
  ('role_sr_be_eng','Kafka','data','required',0.9,3.0,24,'Streaming pipeline'),
  ('role_sr_be_eng','AWS','cloud','critical',1.0,3.5,40,'IAM, VPC, networking'),
  ('role_sr_be_eng','Terraform','devops','required',0.9,2.5,24,'IaC-managed prod stack'),
  ('role_sr_be_eng','Kubernetes','devops','required',0.9,3.0,40,'Production cluster ops'),
  ('role_sr_be_eng','Service mesh','devops','preferred',0.7,2.5,24,'Istio / Linkerd usage'),
  ('role_sr_be_eng','Distributed tracing','devops','required',0.9,2.5,12,'OpenTelemetry instrumentation'),
  ('role_sr_be_eng','Security best practices','security','required',1.0,3.0,16,'Threat modelling exercise'),
  ('role_sr_be_eng','Performance profiling','testing','required',0.9,2.5,12,'CPU/IO profiling on prod hot path'),
  ('role_sr_be_eng','Load testing','testing','preferred',0.7,2.0,8,'Load profile + capacity plan')
ON CONFLICT (role_id, skill_name) DO NOTHING;

INSERT INTO rr_certifications (role_id, cert_name, provider, importance, ei_impact, effort_hours, validity_months) VALUES
  ('role_sr_be_eng','AWS Certified Solutions Architect – Associate','AWS','preferred',5,100,36),
  ('role_sr_be_eng','Certified Kubernetes Administrator (CKA)','CNCF','preferred',5,80,24),
  ('role_sr_be_eng','HashiCorp Certified: Terraform Associate','HashiCorp','preferred',4,40,24),
  ('role_sr_be_eng','Google Cloud Professional Cloud Architect','Google','nice_to_have',3,80,24)
ON CONFLICT (role_id, cert_name, provider) DO NOTHING;

INSERT INTO rr_education (role_id, min_degree, preferred_fields, importance, ei_impact) VALUES
  ('role_sr_be_eng','bachelors', ARRAY['Computer Science','Software Engineering','Information Technology'],'preferred',5)
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO rr_functional_skills (role_id, functional_area, depth, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_sr_be_eng','System design','expert',1.2,4.0,40,'Authored a system design RFC'),
  ('role_sr_be_eng','Distributed systems','expert',1.1,3.5,40,'Scaled a service to >1000 RPS'),
  ('role_sr_be_eng','Mentorship','proficient',1.0,2.5,16,'Mentored 2+ engineers'),
  ('role_sr_be_eng','Capacity planning','proficient',0.9,2.5,16,'Forecasted load & infra spend'),
  ('role_sr_be_eng','Incident commander','proficient',0.9,3.0,12,'Led a Sev-1 incident')
ON CONFLICT (role_id, functional_area) DO NOTHING;

INSERT INTO rr_tools (role_id, tool_name, category, importance, ei_impact, effort_hours) VALUES
  ('role_sr_be_eng','Git','vcs','critical',2,4),
  ('role_sr_be_eng','GitHub Actions','ci_cd','required',1.5,4),
  ('role_sr_be_eng','Argo CD','ci_cd','preferred',1.5,8),
  ('role_sr_be_eng','Datadog','monitoring','required',2,6),
  ('role_sr_be_eng','PagerDuty','monitoring','required',1.5,2),
  ('role_sr_be_eng','Grafana + Prometheus','monitoring','required',1.5,8),
  ('role_sr_be_eng','Jira','project','required',1,2),
  ('role_sr_be_eng','Linear','project','nice_to_have',1,2),
  ('role_sr_be_eng','Sentry','monitoring','required',1.5,4),
  ('role_sr_be_eng','Vault','security','preferred',1.5,8)
ON CONFLICT (role_id, tool_name) DO NOTHING;

INSERT INTO rr_domain_expertise (role_id, domain, years_typical, importance, ei_impact, effort_hours) VALUES
  ('role_sr_be_eng','B2B SaaS',4,'preferred',3.5,120),
  ('role_sr_be_eng','Fintech / Payments',4,'preferred',4.5,160),
  ('role_sr_be_eng','High-availability systems',4,'critical',5.0,160),
  ('role_sr_be_eng','Multi-region architecture',3,'preferred',3.5,80)
ON CONFLICT (role_id, domain) DO NOTHING;

-- ---------- role_eng_manager :: Engineering Manager ----------
INSERT INTO rr_technical_skills (role_id, skill_name, category, required_level, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_eng_manager','System design','api','required',1.0,3.0,24,'Reviewed and signed off system design docs'),
  ('role_eng_manager','Cloud architecture','cloud','required',1.0,3.0,24,'Owned AWS account architecture'),
  ('role_eng_manager','SQL','language','preferred',0.7,2.0,12,'Analyse engineering KPIs from DB'),
  ('role_eng_manager','Python or one general-purpose language','language','required',0.8,2.5,20,'Maintain coding fluency for reviews'),
  ('role_eng_manager','CI/CD pipelines','devops','preferred',0.7,2.0,8,'Set up team release process'),
  ('role_eng_manager','Observability','devops','required',0.9,2.5,8,'Owns SLO/SLI definitions'),
  ('role_eng_manager','Security & compliance','security','required',0.9,2.5,12,'Owns SOC2/ISO controls for team'),
  ('role_eng_manager','Cost optimisation','cloud','preferred',0.7,2.0,8,'Reduced cloud spend')
ON CONFLICT (role_id, skill_name) DO NOTHING;

INSERT INTO rr_certifications (role_id, cert_name, provider, importance, ei_impact, effort_hours, validity_months) VALUES
  ('role_eng_manager','SAFe / Scrum Master','Scrum Alliance','preferred',4,40,24),
  ('role_eng_manager','AWS Certified Solutions Architect','AWS','preferred',4,80,36),
  ('role_eng_manager','PMI Agile Certified Practitioner (PMI-ACP)','PMI','nice_to_have',3,60,36)
ON CONFLICT (role_id, cert_name, provider) DO NOTHING;

INSERT INTO rr_education (role_id, min_degree, preferred_fields, importance, ei_impact) VALUES
  ('role_eng_manager','bachelors', ARRAY['Computer Science','Engineering','Business','MBA preferred'],'preferred',5)
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO rr_functional_skills (role_id, functional_area, depth, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_eng_manager','People management','expert',1.2,4.0,40,'Manage 5+ direct reports'),
  ('role_eng_manager','Hiring & interviewing','expert',1.1,3.5,24,'Closed 3+ senior hires'),
  ('role_eng_manager','Performance management','expert',1.1,3.5,16,'Ran 2+ review cycles'),
  ('role_eng_manager','Roadmap planning','proficient',1.0,3.0,16,'Quarterly roadmap delivered'),
  ('role_eng_manager','Cross-functional partnership','proficient',1.0,3.0,16,'Drove a tri-team initiative'),
  ('role_eng_manager','Budget & headcount planning','proficient',0.9,2.5,12,'Annual planning ownership')
ON CONFLICT (role_id, functional_area) DO NOTHING;

INSERT INTO rr_tools (role_id, tool_name, category, importance, ei_impact, effort_hours) VALUES
  ('role_eng_manager','Jira','project','critical',2,4),
  ('role_eng_manager','Confluence','collaboration','required',1.5,2),
  ('role_eng_manager','Lattice / Culture Amp','project','preferred',1.5,4),
  ('role_eng_manager','LinkedIn Recruiter','project','required',1.5,4),
  ('role_eng_manager','Greenhouse','project','required',1.5,4),
  ('role_eng_manager','Notion','collaboration','preferred',1,2),
  ('role_eng_manager','Slack','collaboration','required',1,1),
  ('role_eng_manager','Tableau / Looker','data','preferred',1.5,8)
ON CONFLICT (role_id, tool_name) DO NOTHING;

INSERT INTO rr_domain_expertise (role_id, domain, years_typical, importance, ei_impact, effort_hours) VALUES
  ('role_eng_manager','SaaS / Cloud',5,'preferred',3.5,160),
  ('role_eng_manager','Org design',3,'preferred',3.5,80),
  ('role_eng_manager','Engineering productivity',3,'preferred',3.0,80)
ON CONFLICT (role_id, domain) DO NOTHING;

-- ---------- role_pm :: Product Manager ----------
INSERT INTO rr_technical_skills (role_id, skill_name, category, required_level, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_pm','SQL','language','required',1.0,3.0,16,'Self-serve analytics queries'),
  ('role_pm','A/B testing methodology','data','required',1.0,3.0,12,'Designed a multi-arm test'),
  ('role_pm','Wireframing','other','required',0.9,2.0,8,'Low-fi wireframes for engineering brief'),
  ('role_pm','API literacy','api','preferred',0.7,2.0,8,'Read OpenAPI / Postman tests'),
  ('role_pm','Analytics instrumentation','data','required',0.9,2.5,8,'Event spec authoring')
ON CONFLICT (role_id, skill_name) DO NOTHING;

INSERT INTO rr_certifications (role_id, cert_name, provider, importance, ei_impact, effort_hours, validity_months) VALUES
  ('role_pm','Pragmatic Marketing PMC','Pragmatic Institute','preferred',5,40,NULL),
  ('role_pm','Certified Scrum Product Owner (CSPO)','Scrum Alliance','preferred',4,24,24),
  ('role_pm','SAFe POPM','Scaled Agile','nice_to_have',3,32,24),
  ('role_pm','Reforge Programs','Reforge','preferred',4,80,NULL),
  ('role_pm','Mind the Product Cert','Mind the Product','nice_to_have',3,24,NULL)
ON CONFLICT (role_id, cert_name, provider) DO NOTHING;

INSERT INTO rr_education (role_id, min_degree, preferred_fields, importance, ei_impact) VALUES
  ('role_pm','bachelors', ARRAY['Business','Engineering','Design','MBA preferred'],'preferred',5)
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO rr_functional_skills (role_id, functional_area, depth, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_pm','Customer discovery','expert',1.2,4.0,24,'Conducted 10+ discovery interviews'),
  ('role_pm','Roadmap prioritisation','expert',1.1,3.5,16,'RICE / ICE-based prioritisation'),
  ('role_pm','Product analytics','expert',1.1,3.5,16,'Funnel + cohort analyses'),
  ('role_pm','Pricing & packaging','proficient',1.0,3.0,16,'Owned a pricing experiment'),
  ('role_pm','Go-to-market','proficient',1.0,3.0,16,'Owned a launch plan'),
  ('role_pm','PRD / spec writing','expert',1.1,3.0,12,'PRDs read & shipped by engineering')
ON CONFLICT (role_id, functional_area) DO NOTHING;

INSERT INTO rr_tools (role_id, tool_name, category, importance, ei_impact, effort_hours) VALUES
  ('role_pm','Amplitude / Mixpanel','data','critical',2,8),
  ('role_pm','Figma','design','required',1.5,8),
  ('role_pm','Jira','project','critical',2,4),
  ('role_pm','Productboard','project','preferred',1.5,4),
  ('role_pm','Notion','collaboration','required',1,2),
  ('role_pm','Linear','project','preferred',1,2),
  ('role_pm','Confluence','collaboration','required',1.5,2),
  ('role_pm','Looker / Tableau','data','preferred',1.5,8),
  ('role_pm','Pendo','data','nice_to_have',1.5,4),
  ('role_pm','UserTesting.com','other','preferred',1.5,2)
ON CONFLICT (role_id, tool_name) DO NOTHING;

INSERT INTO rr_domain_expertise (role_id, domain, years_typical, importance, ei_impact, effort_hours) VALUES
  ('role_pm','B2B SaaS',3,'preferred',3.5,120),
  ('role_pm','Marketplace dynamics',2,'preferred',3.0,80),
  ('role_pm','Growth / PLG',2,'preferred',3.5,80)
ON CONFLICT (role_id, domain) DO NOTHING;

-- ---------- role_credit_analyst :: Credit Analyst ----------
INSERT INTO rr_technical_skills (role_id, skill_name, category, required_level, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_credit_analyst','Excel (advanced)','other','critical',1.0,3.0,16,'Financial models in Excel'),
  ('role_credit_analyst','SQL','language','required',0.9,2.5,16,'Pull counterparty exposure data'),
  ('role_credit_analyst','Python (pandas)','language','preferred',0.7,2.0,40,'Risk analytics notebooks'),
  ('role_credit_analyst','Financial modelling','data','critical',1.1,3.5,40,'Built a DCF / credit model'),
  ('role_credit_analyst','Statistical analysis','data','required',0.9,2.5,16,'Default rate / loss given default')
ON CONFLICT (role_id, skill_name) DO NOTHING;

INSERT INTO rr_certifications (role_id, cert_name, provider, importance, ei_impact, effort_hours, validity_months) VALUES
  ('role_credit_analyst','CFA Level I','CFA Institute','critical',6,300,NULL),
  ('role_credit_analyst','CFA Level II','CFA Institute','preferred',6,300,NULL),
  ('role_credit_analyst','FRM Part I','GARP','preferred',5,200,NULL),
  ('role_credit_analyst','Credit Risk Certification (CRC)','RMA','preferred',5,120,NULL),
  ('role_credit_analyst','Bloomberg Market Concepts','Bloomberg','nice_to_have',3,16,NULL)
ON CONFLICT (role_id, cert_name, provider) DO NOTHING;

INSERT INTO rr_education (role_id, min_degree, preferred_fields, importance, ei_impact) VALUES
  ('role_credit_analyst','bachelors', ARRAY['Finance','Economics','Accounting','Business','Statistics'],'critical',6)
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO rr_functional_skills (role_id, functional_area, depth, weight, ei_impact, effort_hours, evidence_hint) VALUES
  ('role_credit_analyst','Credit underwriting','expert',1.2,4.0,40,'Underwrote a corporate exposure'),
  ('role_credit_analyst','Financial statement analysis','expert',1.2,4.0,24,'Spread & analysed financials'),
  ('role_credit_analyst','Industry analysis','proficient',1.0,3.0,16,'Sector-level credit thesis'),
  ('role_credit_analyst','Covenant analysis','proficient',1.0,3.0,16,'Reviewed loan documentation'),
  ('role_credit_analyst','Regulatory reporting','proficient',0.9,2.5,16,'Basel/IFRS9 reporting exposure'),
  ('role_credit_analyst','Portfolio monitoring','proficient',0.9,3.0,16,'Owned watchlist reviews')
ON CONFLICT (role_id, functional_area) DO NOTHING;

INSERT INTO rr_tools (role_id, tool_name, category, importance, ei_impact, effort_hours) VALUES
  ('role_credit_analyst','Bloomberg Terminal','data','critical',2,8),
  ('role_credit_analyst','Capital IQ','data','required',2,8),
  ('role_credit_analyst','Moody''s Analytics','data','preferred',1.5,8),
  ('role_credit_analyst','S&P Global','data','preferred',1.5,8),
  ('role_credit_analyst','PowerPoint','other','required',1,2),
  ('role_credit_analyst','Tableau','data','preferred',1.5,8)
ON CONFLICT (role_id, tool_name) DO NOTHING;

INSERT INTO rr_domain_expertise (role_id, domain, years_typical, importance, ei_impact, effort_hours) VALUES
  ('role_credit_analyst','Corporate banking',3,'preferred',4.0,120),
  ('role_credit_analyst','Leveraged finance',2,'preferred',3.5,80),
  ('role_credit_analyst','Distressed debt',2,'nice_to_have',3.0,80)
ON CONFLICT (role_id, domain) DO NOTHING;
