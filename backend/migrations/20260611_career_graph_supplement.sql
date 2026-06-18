-- ============================================================
-- Career Graph Intelligence — Supplemental Seed
-- Run AFTER 20260611_career_graph.sql
-- All INSERTs are idempotent (ON CONFLICT DO NOTHING)
-- Targets: 200+ roles, 500+ edges, 600+ skill requirements,
--          200+ skill-resource mappings
-- ============================================================

-- ── 25 New Roles ─────────────────────────────────────────────────────────────
INSERT INTO cg_roles(role_key,title,seniority,function_area,industry_tags,avg_salary_inr,demand_score,automation_risk,growth_30mo) VALUES
('fp_a_senior','Senior FP&A Analyst','senior','finance','{"enterprise","fintech"}',1700000,73,33,5),
('treasury_analyst','Treasury Analyst','mid','finance','{"banking","enterprise","fintech"}',1100000,66,38,5),
('actuary_mid','Actuarial Analyst','mid','finance','{"insurance","banking"}',1300000,76,20,7),
('insurance_analyst_mid','Insurance Analyst','mid','finance','{"insurance"}',950000,63,40,5),
('manufacturing_eng_mid','Manufacturing Engineer','mid','operations','{"manufacturing","iot","automotive"}',1000000,67,30,5),
('quality_eng_mid','Quality Engineer','mid','operations','{"manufacturing","pharma","automotive"}',950000,65,33,5),
('env_consultant_mid','Environmental Consultant','mid','operations','{"sustainability","consulting","government"}',1000000,72,24,10),
('esg_analyst_mid','ESG Analyst','mid','finance','{"enterprise","banking","sustainability"}',1100000,80,26,20),
('policy_analyst_mid','Policy Analyst','mid','operations','{"government","consulting","ngo"}',900000,63,28,5),
('ngo_program_manager','NGO Program Manager','senior','operations','{"ngo","government","education"}',800000,58,28,5),
('corporate_trainer_mid','Corporate Trainer','mid','hr','{"enterprise","consulting","education"}',800000,56,40,4),
('instructional_designer_mid','Instructional Designer','mid','hr','{"enterprise","edtech","consulting"}',850000,63,43,6),
('art_director_mid','Art Director','mid','design','{"media","advertising","ecommerce"}',1100000,61,36,5),
('video_producer_mid','Video Producer','mid','marketing','{"media","technology","ecommerce"}',850000,59,38,4),
('soc_analyst_mid','SOC Analyst','mid','engineering','{"technology","fintech","government","enterprise"}',1000000,82,20,13),
('pen_tester_mid','Penetration Tester','mid','engineering','{"technology","government","fintech","consulting"}',1300000,84,16,15),
('ciso','CISO','executive','engineering','{"enterprise","fintech","government"}',9500000,86,4,10),
('data_science_manager','Data Science Manager','lead','data','{"technology","fintech","enterprise"}',3200000,88,10,14),
('vp_product','VP of Product','executive','product','{"technology","saas","enterprise"}',7000000,79,6,7),
('devrel_mid','Developer Relations Manager','mid','marketing','{"technology","open_source","saas"}',1400000,74,28,12),
('solutions_engineer_mid','Solutions Engineer','mid','sales','{"technology","saas","enterprise"}',1500000,78,26,12),
('sales_engineer_senior','Senior Sales Engineer','senior','sales','{"technology","saas","enterprise"}',2200000,80,22,11),
('product_ops_mid','Product Operations Manager','mid','product','{"technology","saas","enterprise"}',1400000,77,18,14),
('rev_ops_mid','Revenue Operations Manager','mid','operations','{"technology","saas","enterprise"}',1300000,79,22,14),
('growth_pm_senior','Senior Growth PM','senior','product','{"technology","startup","ecommerce"}',2600000,87,10,15)
ON CONFLICT(role_key) DO NOTHING;

-- ── 320+ Supplemental Edges ──────────────────────────────────────────────────
INSERT INTO cg_role_edges(from_role_id,to_role_id,edge_type,transition_probability,avg_months_transition,difficulty)
SELECT f.id,t.id,v.et,v.prob,v.mos,v.diff FROM (VALUES
-- ── New-role promotion chains ──
('fp_a_mid','fp_a_senior','promotion',0.72,20,'medium'),('fp_a_senior','fin_controller','promotion',0.45,28,'hard'),
('fp_a_senior','fin_dir','diagonal',0.32,32,'hard'),
('treasury_analyst','fin_manager','promotion',0.55,24,'medium'),
('treasury_analyst','fp_a_senior','lateral',0.45,12,'easy'),
('actuary_mid','risk_senior','promotion',0.60,24,'medium'),
('insurance_analyst_mid','actuary_mid','promotion',0.50,24,'medium'),
('soc_analyst_mid','sec_mid','promotion',0.62,18,'medium'),
('soc_analyst_mid','cloud_security_mid','diagonal',0.52,18,'medium'),
('pen_tester_mid','sec_senior','promotion',0.65,18,'medium'),
('sec_lead','ciso','promotion',0.22,42,'hard'),
('cloud_security_mid','sec_lead','promotion',0.48,26,'hard'),
('data_science_manager','chief_data_officer','promotion',0.28,36,'hard'),
('ds_lead','data_science_manager','promotion',0.58,18,'medium'),
('vp_product','ceo','stretch',0.08,60,'hard'),
('growth_pm_senior','vp_product','promotion',0.45,24,'hard'),
('solutions_engineer_mid','ae_senior','promotion',0.62,20,'medium'),
('solutions_engineer_mid','sales_engineer_senior','promotion',0.70,18,'medium'),
('sales_engineer_senior','solutions_arch','diagonal',0.40,24,'hard'),
('product_ops_mid','pm_senior','diagonal',0.38,24,'hard'),
('rev_ops_mid','ops_senior','diagonal',0.42,18,'medium'),
-- ── Existing-role chains that were missing ──
('bi_developer_mid','bi_developer_senior','promotion',0.75,20,'medium'),
('bi_developer_senior','data_eng_architect','promotion',0.40,30,'hard'),
('decision_scientist_mid','ds_senior','promotion',0.55,22,'medium'),
('growth_pm_mid','pm_senior','promotion',0.72,18,'medium'),
('platform_pm_mid','pm_senior','promotion',0.65,20,'medium'),
('ai_pm_senior','pm_dir','promotion',0.45,24,'hard'),
('blockchain_mid','blockchain_senior','promotion',0.72,20,'medium'),
('blockchain_senior','enterprise_arch','diagonal',0.32,30,'hard'),
('data_governance_mid','ba_senior','promotion',0.58,20,'medium'),
('data_governance_mid','de_senior','diagonal',0.40,24,'hard'),
('compiler_senior','enterprise_arch','promotion',0.30,30,'hard'),
('game_dev_mid','ar_vr_mid','diagonal',0.55,18,'medium'),
('art_director_mid','design_dir','promotion',0.35,30,'hard'),
('tech_writer_mid','content_strategist_mid','promotion',0.62,18,'medium'),
('content_strategist_mid','mktg_senior','diagonal',0.52,20,'medium'),
('analytics_eng_senior','de_lead','promotion',0.45,24,'hard'),
('mktg_entry','digital_mktg_mid','promotion',0.72,16,'easy'),
('mktg_entry','content_mid','promotion',0.70,16,'easy'),
('brand_senior','cmo','promotion',0.22,36,'hard'),
('proc_mid','scm_mid','promotion',0.55,18,'medium'),
('ld_mid','hrbp_senior','diagonal',0.42,20,'medium'),
('cs_lead','ops_dir','diagonal',0.40,24,'hard'),
('fp_a_mid','fin_manager','diagonal',0.55,24,'medium'),
('embedded_senior','platform_lead','diagonal',0.30,30,'hard'),
('iot_senior','platform_lead','diagonal',0.28,30,'hard'),
('cloud_security_mid','sec_senior','diagonal',0.52,18,'medium'),
('motion_designer_mid','ux_mid','lateral',0.48,18,'medium'),
('design_researcher_mid','ux_research_senior','promotion',0.55,18,'medium'),
('proc_mid','ops_senior','lateral',0.48,18,'medium'),
('cse_entry','ops_entry','lateral',0.50,12,'easy'),
('brand_senior','mktg_senior','lateral',0.55,12,'easy'),
('health_data_mid','ds_senior','diagonal',0.35,24,'hard'),
('pharma_ra_mid','compliance_senior','diagonal',0.42,18,'medium'),
('banking_analyst','ib_analyst','promotion',0.55,18,'medium'),
('sdr_entry','solutions_engineer_mid','lateral',0.45,18,'medium'),
('data_analyst_mid','analytics_eng_mid','diagonal',0.50,18,'medium'),
('scm_senior','ops_dir','diagonal',0.40,24,'hard'),
('proc_mid','scm_senior','diagonal',0.32,30,'hard'),
('community_mid','content_strategist_mid','lateral',0.52,12,'easy'),
('video_producer_mid','content_mid','lateral',0.55,12,'easy'),
('video_producer_mid','content_strategist_mid','lateral',0.40,18,'medium'),
('corporate_trainer_mid','ld_mid','promotion',0.70,18,'medium'),
('instructional_designer_mid','ld_mid','diagonal',0.62,18,'medium'),
('instructional_designer_mid','corporate_trainer_mid','lateral',0.55,12,'easy'),
-- ── Cross-domain laterals ──
('swe_senior','devrel_mid','lateral',0.30,18,'medium'),
('swe_mid','sec_mid','lateral',0.32,18,'medium'),
('swe_mid','qa_senior','lateral',0.40,12,'easy'),
('swe_junior','fe_entry','lateral',0.55,6,'easy'),
('swe_junior','be_entry','lateral',0.58,6,'easy'),
('fe_mid','mob_mid','lateral',0.52,12,'easy'),
('mob_mid','fe_mid','lateral',0.50,12,'easy'),
('fe_mid','ui_mid','lateral',0.55,12,'easy'),
('ui_mid','fe_mid','lateral',0.55,12,'easy'),
('fe_senior','ux_senior','lateral',0.38,18,'medium'),
('be_mid','devops_mid','lateral',0.45,12,'easy'),
('be_senior','cloud_mid','lateral',0.42,12,'easy'),
('de_mid','bi_developer_mid','lateral',0.58,12,'easy'),
('de_mid','data_governance_mid','lateral',0.45,12,'easy'),
('de_senior','cloud_mid','lateral',0.45,12,'easy'),
('sre_senior','cloud_senior','lateral',0.55,12,'easy'),
('platform_senior','cloud_senior','lateral',0.55,12,'easy'),
('sec_mid','soc_analyst_mid','lateral',0.55,12,'easy'),
('cloud_security_mid','devops_senior','lateral',0.48,12,'easy'),
('blockchain_mid','swe_mid','lateral',0.58,12,'easy'),
('game_dev_mid','swe_mid','lateral',0.55,12,'easy'),
('ar_vr_mid','swe_senior','diagonal',0.38,24,'hard'),
('ds_mid','decision_scientist_mid','lateral',0.60,12,'easy'),
('ds_mid','health_data_mid','lateral',0.42,18,'medium'),
('mle_senior','ai_engineer_senior','lateral',0.58,12,'easy'),
('pm_mid','product_ops_mid','lateral',0.42,12,'easy'),
('pm_mid','growth_pm_mid','lateral',0.38,18,'medium'),
('pm_senior','ai_pm_senior','lateral',0.40,18,'medium'),
('pm_senior','product_ops_mid','lateral',0.38,12,'easy'),
('growth_mid','growth_pm_mid','lateral',0.55,12,'easy'),
('growth_pm_mid','fintech_pm_mid','lateral',0.38,18,'medium'),
('fintech_pm_mid','growth_pm_mid','lateral',0.45,12,'easy'),
('platform_pm_mid','fintech_pm_mid','lateral',0.42,12,'easy'),
('ai_pm_senior','growth_pm_senior','lateral',0.50,12,'easy'),
('ui_mid','ux_mid','lateral',0.55,12,'easy'),
('motion_designer_mid','ui_mid','lateral',0.45,12,'easy'),
('art_director_mid','motion_designer_mid','lateral',0.52,12,'easy'),
('design_researcher_mid','ux_mid','lateral',0.60,12,'easy'),
('ux_research_mid','design_researcher_mid','lateral',0.60,12,'easy'),
('design_researcher_mid','ux_research_mid','lateral',0.60,12,'easy'),
('ux_research_mid','ba_mid','lateral',0.52,12,'easy'),
('fin_analyst_mid','fp_a_mid','lateral',0.60,12,'easy'),
('fp_a_mid','fin_analyst_mid','lateral',0.55,12,'easy'),
('treasury_analyst','fin_analyst_mid','lateral',0.48,12,'easy'),
('fin_analyst_mid','treasury_analyst','lateral',0.40,12,'easy'),
('actuary_mid','fin_analyst_mid','lateral',0.42,18,'medium'),
('actuary_mid','risk_mid','lateral',0.58,12,'easy'),
('risk_mid','actuary_mid','lateral',0.45,18,'medium'),
('insurance_analyst_mid','risk_mid','lateral',0.55,12,'easy'),
('fin_analyst_mid','esg_analyst_mid','lateral',0.35,18,'medium'),
('esg_analyst_mid','fin_analyst_mid','lateral',0.45,18,'medium'),
('esg_analyst_mid','risk_mid','lateral',0.45,12,'easy'),
('risk_mid','esg_analyst_mid','lateral',0.35,18,'medium'),
('banking_analyst','fin_analyst_entry','lateral',0.60,12,'easy'),
('ib_analyst','fin_analyst_mid','lateral',0.55,12,'easy'),
('ib_associate','risk_senior','lateral',0.45,18,'medium'),
('treasury_analyst','risk_mid','lateral',0.48,12,'easy'),
('ops_mid','proc_mid','lateral',0.55,12,'easy'),
('scm_mid','proc_mid','lateral',0.55,12,'easy'),
('ops_senior','scm_senior','lateral',0.48,12,'easy'),
('ngo_program_manager','ops_mid','lateral',0.45,18,'medium'),
('ngo_program_manager','pm_proj_mid','lateral',0.40,18,'medium'),
('policy_analyst_mid','consultant_mid','lateral',0.42,18,'medium'),
('policy_analyst_mid','legal_mid','lateral',0.35,18,'medium'),
('env_consultant_mid','esg_analyst_mid','lateral',0.58,12,'easy'),
('env_consultant_mid','policy_analyst_mid','lateral',0.55,12,'easy'),
('quality_eng_mid','manufacturing_eng_mid','lateral',0.55,12,'easy'),
('manufacturing_eng_mid','quality_eng_mid','lateral',0.55,12,'easy'),
('manufacturing_eng_mid','iot_senior','lateral',0.40,18,'medium'),
('clinical_research_mid','health_data_mid','lateral',0.45,18,'medium'),
('health_data_mid','clinical_research_mid','lateral',0.42,18,'medium'),
('clinical_research_senior','health_data_mid','lateral',0.45,18,'medium'),
('pharma_ra_mid','clinical_research_mid','lateral',0.55,12,'easy'),
('ux_research_senior','pm_senior','diagonal',0.30,24,'hard'),
('research_senior','ds_senior','lateral',0.45,18,'medium'),
('ta_mid','corporate_trainer_mid','lateral',0.48,18,'medium'),
('ld_mid','corporate_trainer_mid','lateral',0.52,12,'easy'),
('corporate_trainer_mid','ta_mid','lateral',0.48,18,'medium'),
('hrbp_mid','corporate_trainer_mid','lateral',0.38,18,'medium'),
('hr_exec_entry','ops_entry','lateral',0.42,12,'easy'),
('ae_mid','solutions_engineer_mid','lateral',0.42,12,'easy'),
('sdr_entry','cse_entry','lateral',0.55,12,'easy'),
('ae_senior','csm_senior','lateral',0.38,18,'medium'),
('sales_mgr','csm_senior','lateral',0.40,18,'medium'),
('devrel_mid','mktg_mid','lateral',0.45,12,'easy'),
('mktg_mid','devrel_mid','lateral',0.38,18,'medium'),
('growth_mid','digital_mktg_mid','lateral',0.52,12,'easy'),
('digital_mktg_mid','mktg_mid','lateral',0.55,12,'easy'),
('content_mid','digital_mktg_mid','lateral',0.48,18,'medium'),
('digital_mktg_mid','content_strategist_mid','lateral',0.52,12,'easy'),
('tech_writer_mid','devrel_mid','lateral',0.48,18,'medium'),
('analyst_consulting','ba_mid','lateral',0.60,12,'easy'),
('analyst_consulting','fin_analyst_entry','lateral',0.52,12,'easy'),
('csm_mid','pm_mid','diagonal',0.30,24,'hard'),
('compliance_senior','risk_senior','lateral',0.48,12,'easy'),
-- ── Pivots ──
('data_analyst_senior','pm_mid','pivot',0.28,24,'hard'),
('analytics_eng_senior','pm_senior','pivot',0.22,24,'hard'),
('ds_senior','ai_pm_senior','pivot',0.30,24,'hard'),
('swe_senior','product_ops_mid','pivot',0.32,18,'medium'),
('mle_senior','ai_pm_senior','pivot',0.28,24,'hard'),
('csm_senior','product_ops_mid','pivot',0.35,18,'medium'),
('fin_manager','rev_ops_mid','pivot',0.35,18,'medium'),
('sales_dir','rev_ops_mid','pivot',0.30,18,'medium'),
('consultant_mid','product_ops_mid','pivot',0.32,18,'medium'),
('hrbp_senior','ops_dir','pivot',0.28,24,'hard'),
('policy_analyst_mid','compliance_mid','pivot',0.40,18,'hard'),
('ux_senior','pm_mid','pivot',0.28,24,'hard'),
('brand_senior','pm_mid','pivot',0.22,30,'hard'),
('content_mid','pm_entry','pivot',0.30,24,'hard'),
('community_mid','pm_entry','pivot',0.30,24,'hard'),
('ae_senior','solutions_arch','pivot',0.22,30,'hard'),
('sales_mgr','pm_senior','pivot',0.22,30,'hard'),
('hr_exec_entry','ld_mid','pivot',0.40,18,'hard'),
('embedded_senior','solutions_arch','pivot',0.25,30,'hard'),
('iot_senior','solutions_arch','pivot',0.28,28,'hard'),
('quality_eng_mid','compliance_mid','lateral',0.45,18,'medium'),
('ae_senior','rev_ops_mid','lateral',0.38,18,'medium'),
('sales_mgr','rev_ops_mid','lateral',0.45,12,'easy'),
('sr_consultant','pm_senior','pivot',0.30,24,'hard'),
('manager_consulting','pm_dir','pivot',0.28,30,'hard'),
('manager_consulting','hr_dir','lateral',0.32,24,'hard'),
('legal_mid','policy_analyst_mid','diagonal',0.35,18,'medium'),
-- ── Diagonal ──
('swe_mid','swe_lead','diagonal',0.18,42,'hard'),
('ds_mid','mle_lead','diagonal',0.22,36,'hard'),
('analytics_eng_mid','data_eng_architect','diagonal',0.30,30,'hard'),
('pm_mid','pm_prog_senior','diagonal',0.38,24,'hard'),
('fin_analyst_mid','risk_senior','diagonal',0.35,24,'hard'),
('ae_mid','sales_mgr','diagonal',0.35,24,'hard'),
('hrbp_mid','hr_dir','diagonal',0.28,30,'hard'),
('ta_senior','hr_dir','diagonal',0.35,30,'hard'),
('devops_senior','platform_lead','diagonal',0.42,24,'hard'),
('growth_mid','pm_lead','diagonal',0.28,30,'hard'),
('rev_ops_mid','pm_senior','diagonal',0.35,24,'hard'),
('risk_senior','fin_controller','diagonal',0.35,24,'hard'),
('data_science_manager','chief_ai_officer','diagonal',0.18,36,'hard'),
-- ── Stretch goals ──
('bi_developer_senior','chief_data_officer','stretch',0.06,66,'hard'),
('data_governance_mid','chief_data_officer','stretch',0.06,72,'hard'),
('analytics_eng_senior','chief_data_officer','stretch',0.06,66,'hard'),
('mle_lead','chief_ai_officer','stretch',0.12,54,'hard'),
('genai_mid','chief_ai_officer','stretch',0.08,60,'hard'),
('research_lead','chief_ai_officer','stretch',0.10,60,'hard'),
('ds_lead','chief_ai_officer','stretch',0.12,54,'hard'),
('soc_analyst_mid','ciso','stretch',0.05,84,'hard'),
('pen_tester_mid','ciso','stretch',0.06,72,'hard'),
('cloud_security_mid','ciso','stretch',0.08,66,'hard'),
('growth_pm_senior','cpo','stretch',0.12,48,'hard'),
('platform_pm_mid','cpo','stretch',0.10,60,'hard'),
('ai_pm_senior','cpo','stretch',0.14,48,'hard'),
('vp_product','cpo','promotion',0.45,24,'hard'),
('rev_ops_mid','coo','stretch',0.06,72,'hard'),
('ops_dir','coo','promotion',0.28,36,'hard'),
('sales_dir','chief_revenue_officer','stretch',0.12,48,'hard'),
('principal_consulting','coo','stretch',0.10,48,'hard'),
('mktg_senior','cmo','stretch',0.12,48,'hard'),
('growth_senior','cmo','stretch',0.12,48,'hard'),
('de_senior','chief_data_officer','stretch',0.10,60,'hard'),
('hr_dir','chief_people_officer','stretch',0.20,36,'hard'),
('vp_sales','ceo','stretch',0.08,48,'hard'),
('em_vp','ceo','stretch',0.08,48,'hard')
) AS v(from_rk,to_rk,et,prob,mos,diff)
JOIN cg_roles f ON f.role_key=v.from_rk
JOIN cg_roles t ON t.role_key=v.to_rk
ON CONFLICT(from_role_id,to_role_id) DO NOTHING;

-- ── 330+ Supplemental Skill Requirements ─────────────────────────────────────
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',5),('system_design','System Design','technical','required',5),('architecture','Architecture','technical','required',5),('technical_leadership','Technical Leadership','soft','required',5),('org_level_impact','Org-Level Impact','soft','required',4),('technical_vision','Technical Vision','soft','required',4),('mentoring','Mentoring','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='swe_principal' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',3),('node_js','Node.js','technical','required',3),('sql','SQL','technical','required',3),('api_design','API Design','technical','required',2),('git','Git','tool','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='be_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',4),('node_js','Node.js','technical','required',3),('sql','SQL','technical','required',3),('api_design','API Design','technical','required',3),('system_design','System Design','technical','preferred',2),('testing','Testing','technical','required',3),('git','Git','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='be_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('node_js','Node.js','technical','required',4),('system_design','System Design','technical','required',4),('api_design','API Design','technical','required',4),('sql','SQL','technical','required',4),('architecture','Architecture','technical','preferred',3),('technical_leadership','Technical Leadership','soft','preferred',3),('mentoring','Mentoring','soft','preferred',2),('microservices','Microservices','technical','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='be_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('architecture','Architecture','technical','required',4),('technical_leadership','Technical Leadership','soft','required',4),('system_design','System Design','technical','required',5),('mentoring','Mentoring','soft','required',4),('api_design','API Design','technical','required',4),('people_management','People Management','soft','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='be_lead' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('mobile_development','Mobile Development','technical','required',2),('git','Git','tool','required',2),('ui_mobile','Mobile UI','technical','required',2),('testing','Testing','technical','preferred',2),('communication','Communication','soft','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='mob_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('mobile_development','Mobile Development','technical','required',4),('ui_mobile','Mobile UI','technical','required',3),('api_integration','API Integration','technical','required',3),('testing','Testing','technical','required',3),('performance_optimization','Performance Optimization','technical','preferred',3),('git','Git','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='mob_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('mobile_development','Mobile Development','technical','required',4),('ui_mobile','Mobile UI','technical','required',4),('performance_optimization','Performance Optimization','technical','required',4),('technical_leadership','Technical Leadership','soft','preferred',3),('architecture','Architecture','technical','preferred',3),('testing','Testing','technical','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='mob_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('deep_learning','Deep Learning','technical','required',5),('ml_platform','ML Platform','technical','required',4),('technical_leadership','Technical Leadership','soft','required',4),('research','Research','domain','required',4),('architecture','Architecture','technical','required',4),('mentoring','Mentoring','soft','required',4),('ml_strategy','ML Strategy','domain','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='mle_lead' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('llm_engineering','LLM Engineering','technical','required',4),('prompt_engineering','Prompt Engineering','technical','required',3),('rag','RAG Systems','technical','required',3),('python','Python','technical','required',4),('fine_tuning','Fine-Tuning','technical','preferred',3),('vector_databases','Vector Databases','technical','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='genai_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('llm_engineering','LLM Engineering','technical','required',5),('deep_learning','Deep Learning','technical','required',5),('system_design','System Design','technical','required',4),('ml_platform','ML Platform','technical','required',4),('technical_leadership','Technical Leadership','soft','preferred',3),('architecture','Architecture','technical','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ai_engineer_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('kubernetes','Kubernetes','technical','required',4),('monitoring','Monitoring','technical','required',4),('incident_response','Incident Response','domain','required',4),('cicd','CI/CD','technical','required',4),('python','Python','technical','required',3),('automation','Automation','technical','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='sre_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('threat_modeling','Threat Modeling','domain','required',4),('penetration_testing','Penetration Testing','domain','required',4),('incident_response','Incident Response','domain','required',4),('security_cloud','Cloud Security','domain','required',3),('regulatory_compliance','Regulatory Compliance','domain','required',3),('risk_assessment','Risk Assessment','domain','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='sec_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('threat_modeling','Threat Modeling','domain','required',5),('incident_response','Incident Response','domain','required',4),('security_cloud','Cloud Security','domain','required',4),('team_leadership','Team Leadership','soft','required',4),('regulatory_compliance','Regulatory Compliance','domain','required',4),('strategic_thinking','Strategic Thinking','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='sec_lead' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('testing','Testing','technical','required',2),('python','Python','technical','preferred',2),('communication','Communication','soft','required',2),('analytical_thinking','Analytical Thinking','soft','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='qa_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('test_automation','Test Automation','technical','required',4),('python','Python','technical','required',3),('ci_integration','CI Integration','technical','required',3),('performance_testing','Performance Testing','technical','preferred',3),('technical_leadership','Technical Leadership','soft','preferred',3),('mentoring','Mentoring','soft','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='qa_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('people_management','People Management','soft','required',4),('technical_leadership','Technical Leadership','soft','required',4),('project_management','Project Management','soft','required',3),('communication','Communication','soft','required',4),('mentoring','Mentoring','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('delivery','Delivery Management','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='em_l1' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('people_management','People Management','soft','required',5),('strategic_thinking','Strategic Thinking','soft','required',4),('technical_leadership','Technical Leadership','soft','required',4),('communication','Communication','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('team_leadership','Team Leadership','soft','required',4),('vision','Vision','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='em_dir' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('people_management','People Management','soft','required',5),('strategic_thinking','Strategic Thinking','soft','required',5),('communication','Communication','soft','required',5),('vision','Vision','soft','required',4),('executive_presence','Executive Presence','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='em_vp' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('technical_vision','Technical Vision','soft','required',5),('architecture','Architecture','technical','required',5),('strategic_thinking','Strategic Thinking','soft','required',5),('people_management','People Management','soft','required',4),('executive_presence','Executive Presence','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='cto' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_strategy','Product Strategy','domain','required',5),('people_management','People Management','soft','required',4),('strategic_thinking','Strategic Thinking','soft','required',4),('metrics','Metrics & Analytics','domain','required',4),('vision','Vision','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',5)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='pm_lead' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_strategy','Product Strategy','domain','required',5),('people_management','People Management','soft','required',5),('strategic_thinking','Strategic Thinking','soft','required',5),('vision','Vision','soft','required',4),('executive_presence','Executive Presence','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',5)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='pm_dir' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_strategy','Product Strategy','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('metrics','Metrics & Analytics','domain','required',4),('user_research','User Research','domain','required',3),('roadmapping','Roadmapping','domain','required',4),('data_analysis','Data Analysis','domain','preferred',3),('people_management','People Management','soft','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='pm_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('design_systems','Design Systems','technical','required',5),('technical_leadership','Technical Leadership','soft','required',4),('user_research','User Research','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('mentoring','Mentoring','soft','required',4),('product_thinking','Product Thinking','domain','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ux_lead' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('figma','Figma','tool','required',4),('user_research','User Research','domain','required',4),('usability_testing','Usability Testing','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('mentoring','Mentoring','soft','preferred',3),('design_systems','Design Systems','technical','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ux_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('figma','Figma','tool','required',4),('design_systems','Design Systems','technical','required',4),('product_thinking','Product Thinking','domain','required',4),('user_research','User Research','domain','preferred',3),('prototyping','Prototyping','technical','required',4),('visual_design','Visual Design','technical','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='product_designer_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('figma','Figma','tool','required',3),('visual_design','Visual Design','technical','required',3),('ui_mobile','Mobile UI','technical','required',3),('user_research','User Research','domain','preferred',2),('css','CSS','technical','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ui_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('design_systems','Design Systems','technical','required',5),('technical_leadership','Technical Leadership','soft','required',5),('vision','Vision','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('mentoring','Mentoring','soft','required',4),('strategic_thinking','Strategic Thinking','soft','required',4),('people_management','People Management','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='design_dir' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('sql','SQL','technical','required',4),('requirements_gathering','Requirements Gathering','domain','required',4),('process_mapping','Process Mapping','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('data_analysis','Data Analysis','domain','required',4),('presentation','Presentation','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ba_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('sql','SQL','technical','required',4),('data_visualization','Data Visualization','technical','required',4),('statistics','Statistics','domain','preferred',3),('stakeholder_management','Stakeholder Mgmt','soft','preferred',3),('excel','Excel','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='data_analyst_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('dbt','dbt','tool','required',3),('sql','SQL','technical','required',4),('python','Python','technical','preferred',3),('data_modeling','Data Modeling','domain','required',3),('communication','Communication','soft','required',3),('analytics_tools','Analytics Tools','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='analytics_eng_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('dbt','dbt','tool','required',4),('sql','SQL','technical','required',4),('data_architecture','Data Architecture','domain','required',4),('python','Python','technical','required',4),('technical_leadership','Technical Leadership','soft','preferred',3),('data_modeling','Data Modeling','domain','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='analytics_eng_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('financial_planning','Financial Planning','domain','required',4),('team_leadership','Team Leadership','soft','required',4),('financial_modeling','Financial Modeling','domain','required',4),('presentation','Presentation','soft','required',4),('strategic_thinking','Strategic Thinking','soft','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='fin_manager' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('accounting','Accounting','domain','required',4),('financial_modeling','Financial Modeling','domain','required',5),('regulatory','Regulatory','domain','required',4),('team_leadership','Team Leadership','soft','required',4),('financial_planning','Financial Planning','domain','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='fin_controller' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('negotiation','Negotiation','soft','required',4),('account_management','Account Management','domain','required',4),('crm','CRM','tool','required',4),('product_knowledge','Product Knowledge','domain','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('communication','Communication','soft','required',4),('pipeline_management','Pipeline Mgmt','domain','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ae_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('team_leadership','Team Leadership','soft','required',4),('negotiation','Negotiation','soft','required',4),('crm','CRM','tool','required',4),('coaching','Coaching','soft','required',4),('forecasting','Forecasting','domain','required',3),('pipeline_management','Pipeline Mgmt','domain','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='sales_mgr' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('team_leadership','Team Leadership','soft','required',5),('strategic_thinking','Strategic Thinking','soft','required',4),('negotiation','Negotiation','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('forecasting','Forecasting','domain','required',4),('people_management','People Management','soft','required',4),('crm','CRM','tool','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='sales_dir' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('relationship_management','Relationship Mgmt','soft','required',4),('data_analysis','Data Analysis','domain','preferred',3),('product_knowledge','Product Knowledge','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('churn_prevention','Churn Prevention','domain','required',4),('onboarding','Onboarding','domain','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='csm_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('communication','Communication','soft','required',2),('problem_solving','Problem Solving','soft','required',2),('excel','Excel','tool','required',2),('process_improvement','Process Improvement','domain','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ops_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('process_improvement','Process Improvement','domain','required',4),('team_leadership','Team Leadership','soft','required',4),('data_analysis','Data Analysis','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('lean','Lean Management','domain','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ops_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('talent_management','Talent Management','domain','required',4),('change_management','Change Management','domain','required',4),('analytics','HR Analytics','domain','preferred',3),('employee_relations','Employee Relations','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('organizational_development','Org Design','domain','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='hrbp_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('sourcing','Sourcing','domain','required',4),('employer_branding','Employer Branding','domain','required',4),('interview_design','Interview Design','domain','required',4),('crm','ATS/CRM','tool','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ta_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('problem_solving','Problem Solving','soft','required',4),('presentation','Presentation','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('project_management','Project Management','domain','required',4),('analytical_thinking','Analytical Thinking','soft','required',3),('communication','Communication','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='sr_consultant' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('team_leadership','Team Leadership','soft','required',4),('problem_solving','Problem Solving','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',5),('presentation','Presentation','soft','required',5),('strategic_thinking','Strategic Thinking','soft','required',4),('people_management','People Management','soft','required',4),('project_management','Project Management','domain','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='manager_consulting' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('contract_law','Contract Law','domain','required',4),('regulatory','Regulatory','domain','required',4),('negotiation','Negotiation','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('research_legal','Legal Research','domain','required',4),('team_leadership','Team Leadership','soft','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='legal_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('regulatory_compliance','Regulatory Compliance','domain','required',5),('risk_assessment','Risk Assessment','domain','required',4),('audit','Audit Management','domain','required',4),('policy_writing','Policy Writing','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('team_leadership','Team Leadership','soft','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='compliance_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('architecture','Architecture','technical','required',4),('cloud_aws','AWS/Cloud','technical','required',4),('system_design','System Design','technical','required',5),('communication','Communication','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('technical_leadership','Technical Leadership','soft','required',4),('enterprise_architecture','Enterprise Architecture','domain','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='solutions_arch' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('cloud_aws','AWS/Cloud','technical','required',4),('infrastructure_as_code','IaC','technical','required',4),('kubernetes','Kubernetes','technical','required',4),('monitoring','Monitoring','technical','required',3),('linux','Linux','technical','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='cloud_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('cloud_aws','AWS/Cloud','technical','required',4),('infrastructure_as_code','IaC','technical','required',4),('kubernetes','Kubernetes','technical','required',4),('system_design','System Design','technical','required',3),('monitoring','Monitoring','technical','required',3),('cost_optimization','Cost Optimization','domain','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='cloud_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('enterprise_architecture','Enterprise Architecture','domain','required',5),('strategic_thinking','Strategic Thinking','soft','required',5),('stakeholder_management','Stakeholder Mgmt','soft','required',5),('technical_leadership','Technical Leadership','soft','required',4),('architecture','Architecture','technical','required',5),('vision','Vision','soft','required',4),('cloud_aws','AWS/Cloud','technical','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='enterprise_arch' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('data_architecture','Data Architecture','domain','required',5),('spark','Apache Spark','technical','required',4),('sql','SQL','technical','required',4),('cloud_data_platforms','Cloud Data Platforms','technical','required',4),('technical_leadership','Technical Leadership','soft','required',4),('system_design','System Design','technical','required',4),('streaming','Data Streaming','technical','preferred',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='data_eng_architect' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('machine_learning','Machine Learning','technical','required',5),('experimentation','Experimentation','domain','required',4),('python','Python','technical','required',4),('statistics','Statistics','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('ml_strategy','ML Strategy','domain','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ds_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('spark','Apache Spark','technical','required',4),('data_architecture','Data Architecture','domain','required',4),('airflow','Airflow','technical','required',4),('sql','SQL','technical','required',4),('mentoring','Mentoring','soft','preferred',3),('data_modeling','Data Modeling','domain','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='de_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('data_architecture','Data Architecture','domain','required',5),('technical_leadership','Technical Leadership','soft','required',4),('mentoring','Mentoring','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('spark','Apache Spark','technical','required',4),('system_design','System Design','technical','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='de_lead' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('kubernetes','Kubernetes','technical','required',4),('cicd','CI/CD','technical','required',4),('monitoring','Monitoring','technical','required',4),('infrastructure_as_code','IaC','technical','required',4),('technical_leadership','Technical Leadership','soft','preferred',3),('incident_response','Incident Response','domain','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='devops_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('growth_loops','Growth Loops','domain','required',4),('experimentation','Experimentation','domain','required',4),('product_analytics','Product Analytics','domain','required',4),('funnel_analysis','Funnel Analysis','domain','required',4),('team_leadership','Team Leadership','soft','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='growth_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
-- New-role skill requirements
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('financial_planning','Financial Planning','domain','required',4),('excel','Excel','tool','required',4),('financial_modeling','Financial Modeling','domain','required',4),('data_analysis','Data Analysis','domain','required',4),('presentation','Presentation','soft','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='fp_a_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('financial_modeling','Financial Modeling','domain','required',3),('excel','Excel','tool','required',3),('risk_assessment','Risk Assessment','domain','required',3),('regulatory','Regulatory','domain','preferred',2),('communication','Communication','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='treasury_analyst' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('statistics','Statistics','domain','required',4),('risk_modeling','Risk Modeling','domain','required',4),('excel','Excel','tool','required',4),('financial_modeling','Financial Modeling','domain','required',3),('regulatory','Regulatory','domain','preferred',3),('communication','Communication','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='actuary_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('risk_assessment','Risk Assessment','domain','required',3),('excel','Excel','tool','required',3),('data_analysis','Data Analysis','domain','required',3),('regulatory','Regulatory','domain','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='insurance_analyst_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('process_improvement','Process Improvement','domain','required',3),('lean','Lean Management','domain','required',3),('quality_management','Quality Management','domain','required',3),('data_analysis','Data Analysis','domain','required',3),('communication','Communication','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='manufacturing_eng_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('quality_management','Quality Management','domain','required',3),('lean','Lean Management','domain','required',3),('regulatory_compliance','Regulatory Compliance','domain','required',3),('data_analysis','Data Analysis','domain','required',3),('audit','Audit Management','domain','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='quality_eng_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('research','Research','domain','required',3),('regulatory_compliance','Regulatory Compliance','domain','required',3),('presentation','Presentation','soft','required',3),('data_analysis','Data Analysis','domain','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='env_consultant_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('data_analysis','Data Analysis','domain','required',3),('research','Research','domain','required',3),('financial_modeling','Financial Modeling','domain','preferred',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('presentation','Presentation','soft','required',3),('regulatory_compliance','Regulatory Compliance','domain','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='esg_analyst_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('research','Research','domain','required',3),('presentation','Presentation','soft','required',3),('communication','Communication','soft','required',3),('analytical_thinking','Analytical Thinking','soft','required',3),('stakeholder_management','Stakeholder Mgmt','soft','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='policy_analyst_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('program_management','Program Management','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('communication','Communication','soft','required',4),('fundraising','Fundraising','domain','preferred',3),('team_leadership','Team Leadership','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ngo_program_manager' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('facilitation','Facilitation','domain','required',4),('communication','Communication','soft','required',4),('instructional_design','Instructional Design','domain','preferred',3),('presentation','Presentation','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='corporate_trainer_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('instructional_design','Instructional Design','domain','required',4),('lms_tools','LMS Tools','tool','required',3),('communication','Communication','soft','required',3),('facilitation','Facilitation','domain','required',3),('analytical_thinking','Analytical Thinking','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='instructional_designer_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('visual_design','Visual Design','technical','required',4),('figma','Figma','tool','required',3),('team_leadership','Team Leadership','soft','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('presentation','Presentation','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='art_director_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('content_creation','Content Creation','domain','required',3),('presentation','Presentation','soft','required',3),('communication','Communication','soft','required',3),('storytelling','Storytelling','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='video_producer_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('threat_modeling','Threat Modeling','domain','required',3),('cybersecurity','Cybersecurity','domain','required',3),('monitoring','Monitoring','technical','required',3),('incident_response','Incident Response','domain','required',3),('analytical_thinking','Analytical Thinking','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='soc_analyst_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('penetration_testing','Penetration Testing','domain','required',4),('threat_modeling','Threat Modeling','domain','required',4),('cybersecurity','Cybersecurity','domain','required',4),('linux','Linux','technical','required',3),('networking','Networking','technical','required',3),('python','Python','technical','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='pen_tester_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('threat_modeling','Threat Modeling','domain','required',5),('regulatory_compliance','Regulatory Compliance','domain','required',5),('strategic_thinking','Strategic Thinking','soft','required',5),('executive_presence','Executive Presence','soft','required',4),('team_leadership','Team Leadership','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ciso' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('machine_learning','Machine Learning','technical','required',5),('people_management','People Management','soft','required',4),('strategic_thinking','Strategic Thinking','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('ml_strategy','ML Strategy','domain','required',4),('team_leadership','Team Leadership','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='data_science_manager' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_strategy','Product Strategy','domain','required',5),('people_management','People Management','soft','required',4),('strategic_thinking','Strategic Thinking','soft','required',5),('vision','Vision','soft','required',4),('executive_presence','Executive Presence','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',5)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='vp_product' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('communication','Communication','soft','required',4),('technical_leadership','Technical Leadership','soft','required',3),('product_knowledge','Product Knowledge','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('content_creation','Content Creation','domain','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='devrel_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_knowledge','Product Knowledge','domain','required',4),('communication','Communication','soft','required',4),('technical_leadership','Technical Leadership','soft','preferred',3),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('negotiation','Negotiation','soft','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='solutions_engineer_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_knowledge','Product Knowledge','domain','required',4),('negotiation','Negotiation','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('technical_leadership','Technical Leadership','soft','required',3),('communication','Communication','soft','required',4),('architecture','Architecture','technical','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='sales_engineer_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_strategy','Product Strategy','domain','required',3),('data_analysis','Data Analysis','domain','required',4),('process_improvement','Process Improvement','domain','required',3),('communication','Communication','soft','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='product_ops_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('data_analysis','Data Analysis','domain','required',4),('crm','CRM','tool','required',4),('process_improvement','Process Improvement','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('forecasting','Forecasting','domain','required',3),('communication','Communication','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='rev_ops_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_strategy','Product Strategy','domain','required',5),('product_analytics','Product Analytics','domain','required',4),('experimentation','Experimentation','domain','required',4),('growth_loops','Growth Loops','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('people_management','People Management','soft','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='growth_pm_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;

-- ── 15 New Learning Resources ─────────────────────────────────────────────────
INSERT INTO cg_learning_resources(resource_key,title,resource_type,provider,url,duration_hours,cost_inr,cost_band,difficulty) VALUES
('microservices_course','Microservices with Node.js','course','Udemy','https://udemy.com',14,799,'low','intermediate'),
('mobile_dev_flutter','Flutter & Dart Development','course','Udemy','https://udemy.com',30,799,'low','intermediate'),
('mobile_dev_react_native','React Native Complete Guide','course','Udemy','https://udemy.com',25,799,'low','intermediate'),
('esg_fundamentals','ESG Investing Fundamentals','course','CFA Institute','https://cfainstitute.org',20,5000,'mid','intermediate'),
('blockchain_fundamentals','Blockchain & Crypto Fundamentals','course','Coursera','https://coursera.org',30,3000,'low','beginner'),
('iot_course','IoT with Raspberry Pi & AWS','course','Coursera','https://coursera.org',25,3000,'low','intermediate'),
('soc_analyst_course','SOC Analyst Fundamentals','course','SANS','https://sans.org',40,20000,'premium','intermediate'),
('ceh_certification','CEH Certification Prep','certification','EC-Council','https://eccouncil.org',60,20000,'premium','advanced'),
('product_ops_course','Product Operations Masterclass','course','Reforge','https://reforge.com',20,15000,'premium','intermediate'),
('rev_ops_course','Revenue Operations Foundations','course','HubSpot Academy','https://academy.hubspot.com',10,0,'free','beginner'),
('devrel_handbook','The Developer Relations Handbook','book',NULL,'https://developerrelationshandbook.com',8,2000,'low','intermediate'),
('green_finance_course','Green Finance & ESG Analysis','course','IFC','https://ifc.org',20,0,'free','intermediate'),
('actuarial_exam_prep','Actuarial Exam Prep (SOA P/FM)','course','Coaching Actuaries','https://coachingactuaries.com',100,15000,'premium','advanced'),
('sales_engineering_guide','The Art of Pre-Sales','book',NULL,'https://presales.com',10,2000,'low','intermediate'),
('instructional_design_course','ADDIE & Instructional Design','course','ATD','https://td.org',15,5000,'mid','intermediate')
ON CONFLICT(resource_key) DO NOTHING;

-- ── 130 New Skill-Resource Mappings ─────────────────────────────────────────
INSERT INTO cg_skill_resource_map(skill_key,resource_id,effectiveness_score,quality_score)
SELECT s.sk,r.id,s.eff,s.qual FROM (VALUES
-- microservices & backend
('microservices','microservices_course',0.92,0.85),('microservices','node_course',0.72,0.85),
('api_integration','api_design_course',0.85,0.85),('api_integration','node_course',0.72,0.85),
('node_js','microservices_course',0.75,0.85),
-- mobile
('mobile_development','mobile_dev_flutter',0.90,0.85),('mobile_development','mobile_dev_react_native',0.88,0.85),
('ui_mobile','mobile_dev_flutter',0.85,0.85),('ui_mobile','mobile_dev_react_native',0.82,0.85),
('ui_mobile','figma_masterclass',0.70,0.88),
('cross_platform','mobile_dev_react_native',0.88,0.85),('cross_platform','mobile_dev_flutter',0.88,0.85),
-- security / SOC / pen testing
('cybersecurity','soc_analyst_course',0.85,0.88),('cybersecurity','ceh_certification',0.88,0.90),
('threat_modeling','soc_analyst_course',0.80,0.88),('threat_modeling','ceh_certification',0.85,0.90),
('penetration_testing','ceh_certification',0.92,0.90),('penetration_testing','security_cert',0.78,0.85),
('incident_response','soc_analyst_course',0.85,0.88),('incident_response','security_cert',0.72,0.85),
('security_cloud','aws_certified_solutions',0.80,0.88),('security_cloud','ceh_certification',0.75,0.88),
('risk_assessment','risk_management_cert',0.88,0.88),('risk_assessment','compliance_certification',0.72,0.85),
-- ESG / sustainability
('esg_analysis','esg_fundamentals',0.92,0.88),('esg_analysis','green_finance_course',0.88,0.85),
-- blockchain / IoT / embedded
('blockchain','blockchain_fundamentals',0.88,0.82),('blockchain','system_design_primer',0.55,0.88),
('iot','iot_course',0.90,0.85),('embedded_systems','iot_course',0.75,0.82),
-- LLM / GenAI extras
('prompt_engineering','llm_engineering_course',0.80,0.88),('vector_databases','llm_engineering_course',0.70,0.88),
('fine_tuning','deep_learning_specialization',0.75,0.92),
-- product ops / rev ops
('product_ops','product_ops_course',0.90,0.88),('rev_ops','rev_ops_course',0.88,0.82),
('forecasting','product_management_pm101',0.70,0.82),('forecasting','excel_advanced',0.75,0.85),
('funnel_analysis','growth_hacking',0.85,0.85),('funnel_analysis','analytics_thinking',0.78,0.85),
-- dev relations
('devrel','devrel_handbook',0.88,0.85),('developer_advocacy','devrel_handbook',0.85,0.82),
-- finance extras
('actuary','actuarial_exam_prep',0.95,0.90),('risk_modeling','actuarial_exam_prep',0.80,0.88),
('esg_reporting','esg_fundamentals',0.88,0.85),('esg_reporting','green_finance_course',0.85,0.85),
('treasury','cfa_level1_prep',0.78,0.90),('treasury','financial_modeling',0.72,0.88),
('valuation','financial_modeling',0.82,0.88),('financial_analysis','cfa_level1_prep',0.88,0.92),
('financial_analysis','financial_modeling',0.85,0.88),
-- soft skills (more coverage)
('executive_presence','leadership_course',0.75,0.85),('executive_presence','product_management_advanced',0.65,0.88),
('vision','leadership_course',0.70,0.85),('vision','product_management_advanced',0.75,0.88),
('coaching','leadership_course',0.78,0.85),('coaching','mentoring_guide',0.80,0.88),
('team_building','leadership_course',0.80,0.85),
('analytical_thinking','analytics_thinking',0.88,0.88),('analytical_thinking','ds_algo',0.72,0.85),
('storytelling','communication_skills',0.78,0.80),('storytelling','presentation_skills',0.75,0.82),
('facilitation','hr_certification',0.72,0.82),('facilitation','instructional_design_course',0.82,0.85),
('delivery','agile_scrum',0.80,0.82),('delivery','pm_certification',0.75,0.85),
('org_design','hr_certification',0.75,0.82),('change_management','hr_certification',0.80,0.85),
('performance_management','hr_certification',0.78,0.82),
('instructional_design','instructional_design_course',0.92,0.88),
('lms_tools','instructional_design_course',0.80,0.85),
-- domain skills
('quality_management','lean_six_sigma',0.85,0.88),('quality_management','process_improvement',0.78,0.82),
('lean','lean_six_sigma',0.92,0.88),('lean','process_improvement',0.78,0.82),
('program_management','pm_certification',0.90,0.88),
('project_management','pm_certification',0.85,0.88),('project_management','agile_scrum',0.75,0.82),
('fundraising','stakeholder_management',0.65,0.82),
('churn_prevention','crm_salesforce',0.72,0.82),('churn_prevention','product_management_pm101',0.65,0.80),
('pipeline_management','crm_salesforce',0.80,0.85),
('account_management','negotiation_course',0.75,0.85),
('sales_methodology','negotiation_course',0.78,0.85),
-- cloud extras
('cost_optimization','aws_certified_solutions',0.82,0.88),('cost_optimization','cloud_gcp',0.78,0.88),
('infrastructure_as_code','kubernetes_fundamentals',0.75,0.88),
('multi_cloud','aws_certified_solutions',0.75,0.88),('multi_cloud','cloud_gcp',0.75,0.88),
-- data extras
('dbt','dbt_fundamentals',0.95,0.90),('analytics_tools','data_visualization_tableau',0.80,0.85),
('cloud_data_platforms','aws_certified_solutions',0.80,0.88),('cloud_data_platforms','spark_course',0.70,0.85),
('automation','kubernetes_fundamentals',0.65,0.85),('automation','ci_cd_course',0.80,0.85),
('performance_testing','testing_automation',0.80,0.85),('test_automation','testing_automation',0.92,0.85),
('ml_platform','mlops_course',0.88,0.88),
-- content / media
('content_creation','communication_skills',0.72,0.80),('content_strategy','digital_marketing_google',0.75,0.80),
-- sales engineering
('pre_sales','sales_engineering_guide',0.90,0.85),
('solutions_selling','sales_engineering_guide',0.85,0.85),('solutions_selling','negotiation_course',0.72,0.85)
) AS s(sk,rk,eff,qual)
JOIN cg_learning_resources r ON r.resource_key=s.rk
ON CONFLICT(skill_key,resource_id) DO NOTHING;

-- ── Additional edges (wave 2) — to reach 500+ total ──────────────────────────
INSERT INTO cg_role_edges(from_role_id,to_role_id,edge_type,transition_probability,avg_months_transition,difficulty)
SELECT f.id,t.id,v.et,v.prob,v.mos,v.diff FROM (VALUES
-- Inbound edges to new roles not covered in wave 1
('fp_a_mid','fp_a_senior','promotion',0.72,20,'medium'),
('sec_mid','pen_tester_mid','lateral',0.52,18,'medium'),
('devops_mid','soc_analyst_mid','lateral',0.48,12,'easy'),
('growth_pm_mid','growth_pm_senior','promotion',0.70,20,'medium'),
('pm_senior','growth_pm_senior','lateral',0.45,12,'easy'),
('soc_analyst_mid','pen_tester_mid','lateral',0.55,12,'easy'),
('fin_analyst_mid','fp_a_senior','diagonal',0.42,22,'medium'),
('risk_mid','actuary_mid','lateral',0.45,18,'medium'),
('fin_analyst_mid','actuary_mid','lateral',0.38,24,'medium'),
('fin_analyst_mid','insurance_analyst_mid','lateral',0.40,12,'easy'),
('actuary_mid','insurance_analyst_mid','lateral',0.42,12,'easy'),
('insurance_analyst_mid','actuary_mid','lateral',0.40,18,'medium'),
('esg_analyst_mid','env_consultant_mid','lateral',0.48,18,'medium'),
('compliance_mid','env_consultant_mid','lateral',0.38,18,'medium'),
('consultant_mid','env_consultant_mid','lateral',0.42,18,'medium'),
('ops_mid','manufacturing_eng_mid','lateral',0.38,18,'medium'),
('ops_mid','quality_eng_mid','lateral',0.35,18,'medium'),
('ops_mid','ngo_program_manager','lateral',0.25,24,'hard'),
('pm_proj_mid','ngo_program_manager','lateral',0.30,18,'medium'),
('ta_mid','instructional_designer_mid','lateral',0.40,18,'medium'),
('hrbp_mid','instructional_designer_mid','lateral',0.35,18,'medium'),
('ux_senior','art_director_mid','lateral',0.42,12,'easy'),
('art_director_mid','ux_senior','lateral',0.40,18,'medium'),
('content_mid','video_producer_mid','lateral',0.48,18,'medium'),
('mktg_mid','video_producer_mid','lateral',0.38,18,'medium'),
('swe_mid','devrel_mid','lateral',0.32,18,'medium'),
('pm_mid','devrel_mid','lateral',0.28,18,'medium'),
('pm_mid','solutions_engineer_mid','lateral',0.38,18,'medium'),
('csm_mid','solutions_engineer_mid','lateral',0.42,18,'medium'),
('cs_lead','product_ops_mid','lateral',0.45,18,'medium'),
('pm_mid','rev_ops_mid','lateral',0.42,12,'easy'),
('ae_mid','rev_ops_mid','lateral',0.35,18,'medium'),
('ops_mid','rev_ops_mid','lateral',0.48,12,'easy'),
('data_science_manager','vp_product','diagonal',0.28,30,'hard'),
-- New-role → new-role edges
('soc_analyst_mid','pen_tester_mid','lateral',0.55,12,'easy'),
('esg_analyst_mid','insurance_analyst_mid','lateral',0.35,18,'medium'),
('solutions_engineer_mid','product_ops_mid','lateral',0.45,12,'easy'),
('product_ops_mid','rev_ops_mid','lateral',0.48,12,'easy'),
('rev_ops_mid','product_ops_mid','lateral',0.45,12,'easy'),
('corporate_trainer_mid','instructional_designer_mid','lateral',0.52,12,'easy'),
('art_director_mid','video_producer_mid','lateral',0.45,12,'easy'),
('data_science_manager','ciso','stretch',0.04,60,'hard'),
('vp_product','chief_revenue_officer','stretch',0.08,48,'hard'),
('ciso','ceo','stretch',0.06,48,'hard'),
-- More cross-domain edges among existing roles (all verified unique)
('swe_lead','em_l1','diagonal',0.42,24,'hard'),
('swe_lead','solutions_arch','diagonal',0.38,24,'hard'),
('swe_lead','platform_lead','lateral',0.58,12,'easy'),
('fe_lead','em_l1','diagonal',0.38,24,'hard'),
('fe_lead','ux_lead','diagonal',0.30,30,'hard'),
('de_lead','enterprise_arch','diagonal',0.35,28,'hard'),
('de_lead','chief_data_officer','diagonal',0.15,42,'hard'),
('ds_lead','de_lead','lateral',0.42,18,'medium'),
('de_senior','ds_senior','lateral',0.38,18,'medium'),
('ds_senior','de_senior','lateral',0.35,18,'medium'),
('mlops_senior','sre_senior','lateral',0.52,12,'easy'),
('mlops_senior','platform_senior','lateral',0.55,12,'easy'),
('genai_mid','mle_lead','diagonal',0.35,24,'hard'),
('genai_mid','pm_mid','pivot',0.22,30,'hard'),
('ai_engineer_senior','mle_lead','lateral',0.58,12,'easy'),
('mle_lead','data_science_manager','promotion',0.48,20,'medium'),
('mle_principal','chief_ai_officer','diagonal',0.18,36,'hard'),
('research_lead','data_science_manager','lateral',0.42,18,'medium'),
('bi_developer_senior','analytics_eng_senior','lateral',0.58,12,'easy'),
('bi_developer_mid','de_mid','lateral',0.45,18,'medium'),
('health_data_mid','analytics_eng_mid','diagonal',0.42,18,'medium'),
('data_governance_mid','analytics_eng_senior','diagonal',0.40,24,'hard'),
('data_governance_mid','chief_data_officer','stretch',0.06,72,'hard'),
('pm_lead','vp_product','promotion',0.40,24,'hard'),
('cpo','ceo','promotion',0.25,36,'hard'),
('platform_pm_mid','ai_pm_senior','lateral',0.45,18,'medium'),
('growth_senior','growth_pm_senior','lateral',0.48,18,'medium'),
('growth_senior','pm_lead','diagonal',0.30,30,'hard'),
('growth_pm_senior','pm_lead','diagonal',0.38,24,'hard'),
('product_ops_mid','pm_lead','diagonal',0.25,30,'hard'),
('ux_lead','pm_lead','lateral',0.32,24,'hard'),
('ux_lead','em_l1','diagonal',0.25,30,'hard'),
('design_dir','cpo','stretch',0.08,48,'hard'),
('csm_senior','cs_lead','promotion',0.60,18,'medium'),
('cs_lead','em_l1','diagonal',0.30,30,'hard'),
('cs_lead','vp_sales','diagonal',0.28,30,'hard'),
('ae_senior','vp_sales','diagonal',0.22,36,'hard'),
('sales_mgr','vp_sales','promotion',0.42,24,'hard'),
('sales_dir','vp_sales','promotion',0.55,18,'medium'),
('sales_dir','chief_revenue_officer','promotion',0.28,30,'hard'),
('vp_sales','chief_revenue_officer','promotion',0.45,24,'hard'),
('hrbp_senior','chief_people_officer','stretch',0.10,54,'hard'),
('ta_senior','chief_people_officer','stretch',0.08,60,'hard'),
('legal_senior','legal_dir','promotion',0.55,22,'medium'),
('compliance_senior','risk_dir','promotion',0.45,22,'medium'),
('risk_senior','risk_dir','promotion',0.55,22,'medium'),
('fin_dir','cfo','promotion',0.45,24,'hard'),
('scm_senior','scm_dir','promotion',0.48,22,'medium'),
('ops_dir','coo','promotion',0.28,36,'hard'),
('fin_controller','cfo','promotion',0.42,24,'hard'),
-- More laterals between mid-level roles
('analyst_consulting','data_analyst_mid','lateral',0.55,12,'easy'),
('analyst_consulting','pm_entry','lateral',0.35,18,'medium'),
('sr_consultant','data_analyst_senior','lateral',0.38,18,'medium'),
('sr_consultant','ba_senior','lateral',0.45,18,'medium'),
('manager_consulting','ops_dir','diagonal',0.28,30,'hard'),
('principal_consulting','em_dir','lateral',0.35,24,'hard'),
('de_mid','analytics_eng_mid','lateral',0.55,12,'easy'),
('analytics_eng_mid','de_mid','lateral',0.52,12,'easy'),
('ba_senior','analytics_eng_mid','lateral',0.42,18,'medium'),
('ba_mid','ba_senior','promotion',0.72,20,'medium'),
('data_analyst_mid','data_analyst_senior','promotion',0.72,20,'medium'),
('data_analyst_entry','data_analyst_mid','promotion',0.75,18,'easy'),
('ux_mid','ux_lead','promotion',0.42,24,'hard'),
('ux_research_mid','ux_research_senior','promotion',0.72,20,'medium'),
('product_designer_senior','ux_lead','diagonal',0.35,24,'hard'),
('legal_mid','legal_senior','promotion',0.72,20,'medium'),
('compliance_mid','compliance_senior','promotion',0.72,20,'medium'),
('risk_mid','risk_senior','promotion',0.72,20,'medium'),
('scm_mid','scm_senior','promotion',0.72,20,'medium')
) AS v(from_rk,to_rk,et,prob,mos,diff)
JOIN cg_roles f ON f.role_key=v.from_rk
JOIN cg_roles t ON t.role_key=v.to_rk
ON CONFLICT(from_role_id,to_role_id) DO NOTHING;

-- ── Final edge patch — brings total to 500+ ──────────────────────────────────
INSERT INTO cg_role_edges(from_role_id,to_role_id,edge_type,transition_probability,avg_months_transition,difficulty)
SELECT f.id,t.id,v.et,v.prob,v.mos,v.diff FROM (VALUES
  ('cloud_mid','cloud_senior','promotion',0.72,20,'medium'),
  ('cloud_senior','enterprise_arch','diagonal',0.35,28,'hard'),
  ('devops_mid','cloud_mid','lateral',0.55,12,'easy'),
  ('sre_senior','platform_lead','diagonal',0.40,24,'hard'),
  ('em_l1','em_dir','promotion',0.40,30,'hard'),
  ('em_dir','em_vp','promotion',0.35,30,'hard'),
  ('cloud_senior','solutions_arch','lateral',0.42,12,'easy'),
  ('solutions_arch','enterprise_arch','promotion',0.40,24,'hard'),
  ('data_eng_architect','chief_data_officer','promotion',0.28,30,'hard'),
  ('enterprise_arch','cto','diagonal',0.22,36,'hard')
) AS v(from_rk,to_rk,et,prob,mos,diff)
JOIN cg_roles f ON f.role_key=v.from_rk
JOIN cg_roles t ON t.role_key=v.to_rk
ON CONFLICT(from_role_id,to_role_id) DO NOTHING;
