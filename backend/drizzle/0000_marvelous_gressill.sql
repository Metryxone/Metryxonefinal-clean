CREATE TABLE "academic_chapters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" varchar NOT NULL,
	"chapter_number" integer NOT NULL,
	"chapter_name" text NOT NULL,
	"description" text,
	"estimated_hours" real,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_classes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" varchar NOT NULL,
	"class_number" integer NOT NULL,
	"class_name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_subjects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" varchar NOT NULL,
	"class_id" varchar NOT NULL,
	"subject_code" text NOT NULL,
	"subject_name" text NOT NULL,
	"subject_type" text DEFAULT 'Core' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_topics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" varchar NOT NULL,
	"topic_number" integer NOT NULL,
	"topic_name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_control_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_name" text NOT NULL,
	"policy_type" text NOT NULL,
	"resource" text NOT NULL,
	"actions" text[] NOT NULL,
	"conditions" text,
	"allowed_roles" text[],
	"denied_roles" text[],
	"priority" integer DEFAULT 100 NOT NULL,
	"effect" text DEFAULT 'allow' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acknowledgements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"notification_id" varchar,
	"acknowledgement_type" text NOT NULL,
	"reference_id" text,
	"reference_type" text,
	"notes" text,
	"acknowledged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar,
	"action_type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar NOT NULL,
	"previous_state" text,
	"new_state" text,
	"ip_address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_blueprints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_code" text NOT NULL,
	"blueprint_name" text NOT NULL,
	"board_id" varchar,
	"class_id" varchar,
	"subject_id" varchar,
	"assessment_type" text DEFAULT 'Practice' NOT NULL,
	"total_marks" integer DEFAULT 100 NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"instructions" text,
	"passing_marks" integer DEFAULT 35,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_blueprints_blueprint_code_unique" UNIQUE("blueprint_code")
);
--> statement-breakpoint
CREATE TABLE "assessment_template_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"question_text" text NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"option_c" text,
	"option_d" text,
	"correct_option" text NOT NULL,
	"marks" integer DEFAULT 1 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"grade" text NOT NULL,
	"description" text,
	"duration" integer DEFAULT 60 NOT NULL,
	"total_marks" integer DEFAULT 100 NOT NULL,
	"difficulty" text DEFAULT 'Medium' NOT NULL,
	"category" text DEFAULT 'Academic' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"action" text NOT NULL,
	"details" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institute_id" varchar NOT NULL,
	"batch_code" text NOT NULL,
	"batch_name" text NOT NULL,
	"academic_year" text NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavioural_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"category" text NOT NULL,
	"metric" text NOT NULL,
	"value" integer,
	"description" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" varchar NOT NULL,
	"section_name" text NOT NULL,
	"section_order" integer DEFAULT 1 NOT NULL,
	"question_type" text DEFAULT 'MCQ' NOT NULL,
	"difficulty_mix" text DEFAULT '40:40:20',
	"questions_count" integer DEFAULT 10 NOT NULL,
	"marks_per_question" real DEFAULT 1 NOT NULL,
	"negative_marks" real DEFAULT 0,
	"chapter_scope" text DEFAULT 'Full Syllabus',
	"chapter_ids" text[],
	"optional_questions" integer DEFAULT 0,
	"instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_academic_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" varchar NOT NULL,
	"board_id" varchar,
	"class_id" varchar,
	"academic_year" text NOT NULL,
	"section" text,
	"roll_number" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_exam_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_exam_id" varchar NOT NULL,
	"question_text" text NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"option_c" text,
	"option_d" text,
	"correct_option" text NOT NULL,
	"marks" integer DEFAULT 1 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_exams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" varchar NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"grade" text,
	"exam_type" text DEFAULT 'academic' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"score" integer,
	"total_marks" integer DEFAULT 100 NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"improved_topics" text[],
	"focus_areas" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_subject_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"subject_id" varchar NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" varchar NOT NULL,
	"student_user_id" varchar,
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"grade" text NOT NULL,
	"class_section" text,
	"school_name" text,
	"roll_number" text,
	"gender" text,
	"date_of_birth" date,
	"blood_group" text,
	"primary_language" text,
	"education_board" text,
	"city" text,
	"state" text,
	"special_needs" text,
	"study_hours" text,
	"favorite_subjects" text[],
	"weak_subjects" text[],
	"learning_style" text,
	"career_interest" text,
	"relationship" text,
	"school_type" text,
	"medium_of_instruction" text,
	"extracurricular" text,
	"emergency_contact" text,
	"medical_conditions" text,
	"lbi_consent" boolean DEFAULT false NOT NULL,
	"data_collection_consent" boolean DEFAULT false NOT NULL,
	"dpdp_consent" boolean DEFAULT false NOT NULL,
	"development_acknowledgment" boolean DEFAULT false NOT NULL,
	"progress_sharing_consent" boolean DEFAULT false NOT NULL,
	"consent_date" timestamp,
	"consent_revoked_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competency_library" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competency_number" integer NOT NULL,
	"competency_name" text NOT NULL,
	"domain" text,
	"sub_domain" text,
	"description" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "competency_library_competency_number_unique" UNIQUE("competency_number")
);
--> statement-breakpoint
CREATE TABLE "compliance_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" text NOT NULL,
	"log_type" text NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" varchar,
	"resource_name" text,
	"actor_id" varchar,
	"actor_type" text,
	"actor_name" text,
	"actor_role" text,
	"ip_address" text,
	"user_agent" text,
	"session_id" varchar,
	"request_id" varchar,
	"previous_value" text,
	"new_value" text,
	"change_reason" text,
	"status" text NOT NULL,
	"error_code" text,
	"error_message" text,
	"compliance_frameworks" text[],
	"data_classification" text,
	"retention_period" text DEFAULT '7_years',
	"log_hash" text,
	"previous_log_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_audit_logs_log_id_unique" UNIQUE("log_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_violations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" varchar NOT NULL,
	"violation_type" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"evidence_url" text,
	"reported_by" varchar,
	"status" text DEFAULT 'reported' NOT NULL,
	"resolution" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"action_taken" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_student_link_id" varchar NOT NULL,
	"parent_id" varchar NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"entity_name" text,
	"consent_type" text NOT NULL,
	"consent_version" text DEFAULT '1.0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"granted_at" timestamp,
	"revoked_at" timestamp,
	"expires_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"consent_text" text,
	"data_categories" text[],
	"processing_purposes" text[],
	"lawful_basis" text,
	"retention_period" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"consent_code" text NOT NULL,
	"consent_name" text NOT NULL,
	"description" text,
	"consent_text_template" text NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"requires_witness" boolean DEFAULT false NOT NULL,
	"requires_guardian" boolean DEFAULT false NOT NULL,
	"lawful_basis" text,
	"data_categories" text[],
	"processing_purposes" text[],
	"retention_period" text,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "consent_types_consent_code_unique" UNIQUE("consent_code")
);
--> statement-breakpoint
CREATE TABLE "data_retention_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_name" text NOT NULL,
	"data_category" text NOT NULL,
	"retention_period_days" integer NOT NULL,
	"archival_period_days" integer,
	"deletion_method" text DEFAULT 'secure_delete' NOT NULL,
	"compliance_framework" text[],
	"legal_basis" text,
	"exceptions" text,
	"last_executed" timestamp,
	"next_scheduled" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_access_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"access_type" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"device_type" text,
	"location" text,
	"access_status" text DEFAULT 'success' NOT NULL,
	"failure_reason" text,
	"session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"entity_name" text,
	"folder_path" text NOT NULL,
	"folder_name" text NOT NULL,
	"parent_folder_id" varchar,
	"access_level" text DEFAULT 'private' NOT NULL,
	"retention_policy" text DEFAULT '7_years',
	"encryption_status" text DEFAULT 'encrypted' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" varchar,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"document_type" text NOT NULL,
	"document_category" text NOT NULL,
	"document_name" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"storage_path" text NOT NULL,
	"checksum" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_latest" boolean DEFAULT true NOT NULL,
	"previous_version_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"maker_verified_by" varchar,
	"maker_verified_at" timestamp,
	"maker_notes" text,
	"checker_approved_by" varchar,
	"checker_approved_at" timestamp,
	"checker_notes" text,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"expiry_date" date,
	"is_expired" boolean DEFAULT false NOT NULL,
	"sensitivity_level" text DEFAULT 'confidential' NOT NULL,
	"encryption_algorithm" text DEFAULT 'AES-256',
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"last_accessed_by" varchar,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_boards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_code" text NOT NULL,
	"board_name" text NOT NULL,
	"description" text,
	"country" text DEFAULT 'India' NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "education_boards_board_code_unique" UNIQUE("board_code")
);
--> statement-breakpoint
CREATE TABLE "email_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"consent_type" text NOT NULL,
	"is_consented" boolean DEFAULT true NOT NULL,
	"consented_at" timestamp,
	"revoked_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institute_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"batch_id" varchar NOT NULL,
	"status" text DEFAULT 'Submitted' NOT NULL,
	"requested_on" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"code" text NOT NULL,
	"code_type" text DEFAULT 'standard' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"generated_by" varchar,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"max_usage" integer,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entity_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"status" text DEFAULT 'In Progress' NOT NULL,
	"score_obtained" real,
	"total_marks" real,
	"started_at" timestamp DEFAULT now(),
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" varchar NOT NULL,
	"question_text" text NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"option_c" text,
	"option_d" text,
	"correct_option" text NOT NULL,
	"marks" integer DEFAULT 1 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"selected_option" text,
	"is_correct" boolean,
	"marks_obtained" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institute_id" varchar NOT NULL,
	"exam_code" text NOT NULL,
	"exam_name" text NOT NULL,
	"batch_id" varchar NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exams_exam_code_unique" UNIQUE("exam_code")
);
--> statement-breakpoint
CREATE TABLE "forum_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar,
	"reply_id" varchar,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_moderation_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar,
	"reply_id" varchar,
	"reported_by" varchar,
	"moderated_by" varchar,
	"report_reason" text,
	"moderation_action" text,
	"moderation_notes" text,
	"status" text DEFAULT 'Pending' NOT NULL,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"moderated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "forum_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" varchar NOT NULL,
	"author_type" text DEFAULT 'student' NOT NULL,
	"child_id" varchar,
	"test_id" varchar,
	"question_id" varchar,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"post_type" text DEFAULT 'doubt' NOT NULL,
	"subject_id" varchar,
	"chapter_id" varchar,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"target_audience" text DEFAULT 'all' NOT NULL,
	"assigned_mentor_id" varchar,
	"assigned_teacher_id" varchar,
	"status" text DEFAULT 'Open' NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_replies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"author_type" text DEFAULT 'student' NOT NULL,
	"parent_reply_id" varchar,
	"content" text NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"is_accepted_answer" boolean DEFAULT false NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"post_id" varchar,
	"reply_id" varchar,
	"vote_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" varchar,
	"action_type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar NOT NULL,
	"previous_state" text,
	"new_state" text,
	"ip_address" text,
	"user_agent" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_consent_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"mentor_id" varchar,
	"consent_type" text NOT NULL,
	"consent_text" text NOT NULL,
	"consent_given" boolean DEFAULT false NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"consented_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institute_staff" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institute_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"staff_code" text,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"department" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar,
	"institute_code" text NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "institutes_institute_code_unique" UNIQUE("institute_code")
);
--> statement-breakpoint
CREATE TABLE "institutional_slas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institute_id" varchar NOT NULL,
	"tier" text DEFAULT 'silver' NOT NULL,
	"response_time_hours" integer DEFAULT 24 NOT NULL,
	"completion_target_percent" real DEFAULT 90 NOT NULL,
	"satisfaction_target_percent" real DEFAULT 85 NOT NULL,
	"reporting_frequency" text DEFAULT 'weekly' NOT NULL,
	"dedicated_support" boolean DEFAULT false NOT NULL,
	"priority_escalation" boolean DEFAULT false NOT NULL,
	"custom_branding" boolean DEFAULT false NOT NULL,
	"effective_from" date NOT NULL,
	"effective_until" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"applicant_user_id" varchar NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"resume_url" text,
	"cover_letter" text,
	"source_channel" text,
	"status" text DEFAULT 'applied' NOT NULL,
	"membership_fee" real,
	"membership_paid_at" timestamp,
	"consent_captured" boolean DEFAULT false NOT NULL,
	"consent_captured_at" timestamp,
	"rejection_reason" text,
	"processed_by" varchar,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_approval_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"action" text NOT NULL,
	"comments" text,
	"actor_id" varchar,
	"actor_role" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_distributions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"channel" text NOT NULL,
	"external_post_id" text,
	"posted_at" timestamp,
	"unpublished_at" timestamp,
	"reach_metrics" integer DEFAULT 0,
	"applications_from_channel" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"role_category" text NOT NULL,
	"employment_type" text NOT NULL,
	"work_mode" text NOT NULL,
	"eligibility" text NOT NULL,
	"qualifications" text NOT NULL,
	"responsibilities" text NOT NULL,
	"kpis" text NOT NULL,
	"compensation_model" text NOT NULL,
	"legal_clauses" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"hr_review_by" varchar,
	"hr_review_at" timestamp,
	"hr_review_notes" text,
	"legal_review_by" varchar,
	"legal_review_at" timestamp,
	"legal_review_notes" text,
	"leadership_approval_by" varchar,
	"leadership_approval_at" timestamp,
	"leadership_approval_notes" text,
	"published_at" timestamp,
	"closed_at" timestamp,
	"hiring_quota" integer DEFAULT 0,
	"hired_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_document_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"document_type" text NOT NULL,
	"document_name" text NOT NULL,
	"description" text,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"validity_period" integer,
	"accepted_formats" text[] DEFAULT ARRAY['pdf', 'jpg', 'png']::text[],
	"max_file_size_mb" integer DEFAULT 5,
	"sample_doc_url" text,
	"verification_instructions" text,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"entity_name" text NOT NULL,
	"document_type" text NOT NULL,
	"document_number" text,
	"document_url" text,
	"file_name" text,
	"file_size" integer,
	"mime_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"maker_id" varchar,
	"maker_verified_at" timestamp,
	"maker_notes" text,
	"checker_id" varchar,
	"checker_verified_at" timestamp,
	"checker_notes" text,
	"rejection_reason" text,
	"expiry_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lbi_age_bands" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_code" text NOT NULL,
	"band_name" text NOT NULL,
	"min_age" integer NOT NULL,
	"max_age" integer NOT NULL,
	"grade_range" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_age_bands_band_code_unique" UNIQUE("band_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_age_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"group_name" text NOT NULL,
	"min_age" integer NOT NULL,
	"max_age" integer NOT NULL,
	"difficulty_level" integer NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_age_groups_group_code_unique" UNIQUE("group_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_assessment_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" varchar,
	"student_id" varchar,
	"age_band_id" varchar,
	"assessment_type" text DEFAULT 'full' NOT NULL,
	"target_domains" text[],
	"status" text DEFAULT 'not_started' NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"questions_answered" integer DEFAULT 0 NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"time_spent_seconds" integer DEFAULT 0,
	"device_info" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lbi_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_code" text NOT NULL,
	"assessment_name" text NOT NULL,
	"lbi_type_id" varchar NOT NULL,
	"total_questions" integer NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_assessments_assessment_code_unique" UNIQUE("assessment_code")
);
--> statement-breakpoint
CREATE TABLE "psychopsis_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lbi_domain_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"domain_id" varchar NOT NULL,
	"raw_score" real NOT NULL,
	"percentile_score" real,
	"stanine_score" integer,
	"classification" text,
	"questions_answered" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lbi_domains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_code" text NOT NULL,
	"domain_name" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"weightage" real DEFAULT 1 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_domains_domain_code_unique" UNIQUE("domain_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_code" text NOT NULL,
	"module_name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_modules_module_code_unique" UNIQUE("module_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_overall_index" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"child_id" varchar,
	"student_id" varchar,
	"lbi_score" real NOT NULL,
	"percentile_rank" real,
	"stanine_score" integer,
	"classification" text,
	"strength_domains" text[],
	"development_areas" text[],
	"recommendations" text,
	"report_generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lbi_performance_correlation" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" varchar NOT NULL,
	"lbi_category" text NOT NULL,
	"lbi_metric" text NOT NULL,
	"lbi_score" integer,
	"subject_id" varchar,
	"academic_score" real,
	"correlation_strength" real,
	"correlation_type" text,
	"insight" text,
	"recommended_actions" text[],
	"analysis_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lbi_question_bank" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub_module_id" varchar NOT NULL,
	"question_code" text NOT NULL,
	"set_number" integer,
	"difficulty_level" integer DEFAULT 1 NOT NULL,
	"question_type" text DEFAULT 'likert' NOT NULL,
	"question_text" text NOT NULL,
	"passage_text" text,
	"keying" text DEFAULT 'Positive' NOT NULL,
	"option_a" text,
	"option_a_score" integer,
	"option_b" text,
	"option_b_score" integer,
	"option_c" text,
	"option_c_score" integer,
	"option_d" text,
	"option_d_score" integer,
	"option_e" text,
	"option_e_score" integer,
	"correct_answer" text,
	"explanation" text,
	"subject" text,
	"age_group_id" varchar,
	"language" text DEFAULT 'EN',
	"anchor" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_question_bank_question_code_unique" UNIQUE("question_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_code" text NOT NULL,
	"domain_id" varchar NOT NULL,
	"subdomain_id" varchar NOT NULL,
	"age_band_id" varchar NOT NULL,
	"response_scale_id" varchar,
	"question_text" text NOT NULL,
	"question_text_hi" text,
	"question_text_mr" text,
	"question_text_ta" text,
	"question_text_te" text,
	"question_type" text DEFAULT 'likert' NOT NULL,
	"response_options" text,
	"scoring" text,
	"reverse_scored" boolean DEFAULT false NOT NULL,
	"difficulty" text DEFAULT 'MEDIUM' NOT NULL,
	"language" text DEFAULT 'EN' NOT NULL,
	"set_number" integer DEFAULT 1,
	"display_order" integer DEFAULT 0 NOT NULL,
	"tags" text[],
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "lbi_questions_question_code_unique" UNIQUE("question_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_response_scales" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scale_code" text NOT NULL,
	"scale_name" text NOT NULL,
	"scale_type" text DEFAULT 'likert' NOT NULL,
	"options" text NOT NULL,
	"scoring" text NOT NULL,
	"reverse_scoring_map" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_response_scales_scale_code_unique" UNIQUE("scale_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_scoring_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_code" text NOT NULL,
	"rule_name" text NOT NULL,
	"domain_id" varchar,
	"subdomain_id" varchar,
	"age_band_id" varchar,
	"calculation_type" text DEFAULT 'mean' NOT NULL,
	"norm_type" text DEFAULT 'percentile' NOT NULL,
	"norm_data" text,
	"min_score" real,
	"max_score" real,
	"cutoffs" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_scoring_rules_rule_code_unique" UNIQUE("rule_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_session_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"response_value" integer,
	"response_text" text,
	"raw_score" real,
	"adjusted_score" real,
	"response_time_ms" integer,
	"question_order" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lbi_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"status" text DEFAULT 'Not Started' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lbi_sub_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" varchar NOT NULL,
	"sub_module_code" text NOT NULL,
	"sub_module_name" text NOT NULL,
	"question_type" text DEFAULT 'likert' NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_sub_modules_sub_module_code_unique" UNIQUE("sub_module_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_subdomain_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"subdomain_id" varchar NOT NULL,
	"raw_score" real NOT NULL,
	"percentile_score" real,
	"stanine_score" integer,
	"classification" text,
	"questions_answered" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lbi_subdomains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" varchar NOT NULL,
	"subdomain_code" text NOT NULL,
	"subdomain_name" text NOT NULL,
	"description" text,
	"weightage" real DEFAULT 1 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_subdomains_subdomain_code_unique" UNIQUE("subdomain_code")
);
--> statement-breakpoint
CREATE TABLE "lbi_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lbi_types_type_name_unique" UNIQUE("type_name")
);
--> statement-breakpoint
CREATE TABLE "learning_plan_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_name" text NOT NULL,
	"description" text,
	"target_grade" text,
	"target_board" text,
	"subject_focus" text[],
	"duration_weeks" integer DEFAULT 12 NOT NULL,
	"difficulty" text DEFAULT 'moderate' NOT NULL,
	"weekly_hours" integer DEFAULT 10 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"milestones" text,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lei_registrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"lei_code" text NOT NULL,
	"entity_name" text NOT NULL,
	"entity_type" text NOT NULL,
	"registration_authority" text,
	"registration_number" text,
	"jurisdiction" text,
	"legal_address" text,
	"headquarters_address" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"valid_from" date,
	"valid_until" date,
	"last_verified" timestamp,
	"verified_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lei_registrations_lei_code_unique" UNIQUE("lei_code")
);
--> statement-breakpoint
CREATE TABLE "mentor_kpis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" varchar NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"student_satisfaction" real DEFAULT 0,
	"session_completion_rate" real DEFAULT 0,
	"outcome_improvement" real DEFAULT 0,
	"compliance_adherence" real DEFAULT 0,
	"revenue_contribution" real DEFAULT 0,
	"sessions_completed" integer DEFAULT 0,
	"students_assigned" integer DEFAULT 0,
	"alert_level" text DEFAULT 'none',
	"alert_issued_at" timestamp,
	"alert_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentor_payouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" varchar NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_revenue" real DEFAULT 0 NOT NULL,
	"commission_rate" real DEFAULT 0 NOT NULL,
	"commission_amount" real DEFAULT 0 NOT NULL,
	"deductions" real DEFAULT 0,
	"net_payout" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"blocked_reason" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"transaction_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentor_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" varchar,
	"user_id" varchar,
	"application_id" varchar,
	"mentor_code" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"profile_photo" text,
	"bio" text,
	"specializations" text[],
	"qualifications" text[],
	"languages" text[],
	"availability" text,
	"preferred_age_groups" text[],
	"status" text DEFAULT 'pending_activation' NOT NULL,
	"activated_at" timestamp,
	"activated_by" varchar,
	"suspended_at" timestamp,
	"suspended_reason" text,
	"deactivated_at" timestamp,
	"deactivation_reason" text,
	"rating" real,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"completed_sessions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mentor_profiles_mentor_code_unique" UNIQUE("mentor_code")
);
--> statement-breakpoint
CREATE TABLE "mentor_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" varchar NOT NULL,
	"task_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_audience" text,
	"scheduled_date" timestamp,
	"duration" integer,
	"location" text,
	"is_online" boolean DEFAULT true NOT NULL,
	"meeting_link" text,
	"status" text DEFAULT 'assigned' NOT NULL,
	"completed_at" timestamp,
	"feedback" text,
	"rating" integer,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"mentor_code" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"specialization" text,
	"qualifications" text,
	"status" text DEFAULT 'pending_training' NOT NULL,
	"activated_at" timestamp,
	"warning_issued_at" timestamp,
	"warning_reason" text,
	"suspended_at" timestamp,
	"suspension_reason" text,
	"deactivated_at" timestamp,
	"deactivation_reason" text,
	"performance_health_index" real DEFAULT 100,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mentors_mentor_code_unique" UNIQUE("mentor_code")
);
--> statement-breakpoint
CREATE TABLE "mfa_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"code" varchar(6) NOT NULL,
	"email" varchar NOT NULL,
	"attempt_token" varchar NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ngo_registrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"ngo_code" text NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"registration_number" text,
	"tax_exemption_number" text,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"address" text,
	"city" text,
	"state" text,
	"pincode" text,
	"focus_areas" text[],
	"beneficiary_count" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"documents_verified" boolean DEFAULT false,
	"kyc_verified" boolean DEFAULT false,
	"verified_by" varchar,
	"verified_at" timestamp,
	"onboarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ngo_registrations_ngo_code_unique" UNIQUE("ngo_code")
);
--> statement-breakpoint
CREATE TABLE "notification_broadcasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"type" text DEFAULT 'fyi' NOT NULL,
	"category" text DEFAULT 'system' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"target_roles" text[],
	"target_user_ids" text[],
	"priority" text DEFAULT 'normal' NOT NULL,
	"action_url" text,
	"action_label" text,
	"send_email" boolean DEFAULT false NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"total_delivered" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" varchar NOT NULL,
	"sender_id" varchar,
	"type" text DEFAULT 'fyi' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"action_url" text,
	"action_label" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp,
	"is_email_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp,
	"metadata" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"entity_name" text NOT NULL,
	"entity_email" text,
	"entity_phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"rejection_reason" text,
	"documents_verified" boolean DEFAULT false,
	"kyc_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_student_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"relationship" text DEFAULT 'Parent',
	"lbi_consent" boolean DEFAULT false NOT NULL,
	"consent_date" timestamp,
	"consent_revoked_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_test_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" varchar NOT NULL,
	"child_id" varchar NOT NULL,
	"assigned_by" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_test_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"answers" text NOT NULL,
	"marks_obtained" integer NOT NULL,
	"total_marks" integer NOT NULL,
	"score" integer NOT NULL,
	"correct_answers" integer NOT NULL,
	"incorrect_answers" integer NOT NULL,
	"question_results" text NOT NULL,
	"completed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" varchar NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"duration" integer DEFAULT 30 NOT NULL,
	"total_marks" integer NOT NULL,
	"questions" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"full_name" text NOT NULL,
	"mobile" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_reconciliations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_period" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_payments_received" real DEFAULT 0 NOT NULL,
	"total_payments_done" real DEFAULT 0 NOT NULL,
	"net_balance" real DEFAULT 0 NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"payout_count" integer DEFAULT 0 NOT NULL,
	"discrepancy_amount" real,
	"discrepancy_notes" text,
	"reconciled_by" varchar,
	"reconciled_at" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" varchar NOT NULL,
	"subject_id" varchar,
	"chapter_id" varchar,
	"test_type" text,
	"total_tests" integer DEFAULT 0 NOT NULL,
	"completed_tests" integer DEFAULT 0 NOT NULL,
	"average_score" real,
	"highest_score" real,
	"lowest_score" real,
	"average_time_seconds" integer,
	"improvement_trend" real,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"permission_key" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permission_definitions_permission_key_unique" UNIQUE("permission_key")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"setting_type" text DEFAULT 'string' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"description" text,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "platform_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"entity_name" text,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"payment_gateway" text,
	"gateway_transaction_id" text,
	"gateway_order_id" text,
	"description" text,
	"invoice_number" text,
	"invoice_url" text,
	"processed_by" varchar,
	"processed_at" timestamp,
	"failure_reason" text,
	"refunded_amount" real,
	"refunded_at" timestamp,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pre_onboarding_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"entity_name" text,
	"temporary_onboarding_status" text DEFAULT 'pending' NOT NULL,
	"temporary_approved_by" varchar,
	"temporary_approved_at" timestamp,
	"total_kyc_documents" integer DEFAULT 0 NOT NULL,
	"uploaded_kyc_documents" integer DEFAULT 0 NOT NULL,
	"verified_kyc_documents" integer DEFAULT 0 NOT NULL,
	"kyc_completion_percent" real DEFAULT 0 NOT NULL,
	"total_consents" integer DEFAULT 0 NOT NULL,
	"granted_consents" integer DEFAULT 0 NOT NULL,
	"consent_completion_percent" real DEFAULT 0 NOT NULL,
	"total_amount" real DEFAULT 0 NOT NULL,
	"paid_amount" real DEFAULT 0 NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"overall_status" text DEFAULT 'incomplete' NOT NULL,
	"spoc_name" text,
	"spoc_email" text,
	"spoc_phone" text,
	"spoc_designation" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psychometric_age_bands" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_code" text NOT NULL,
	"band_name" text NOT NULL,
	"age_range_start" integer NOT NULL,
	"age_range_end" integer,
	"context" text NOT NULL,
	"display_order" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "psychometric_age_bands_band_code_unique" UNIQUE("band_code")
);
--> statement-breakpoint
CREATE TABLE "psychometric_assessment_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"age_band_id" varchar NOT NULL,
	"domain_id" varchar NOT NULL,
	"subdomain_id" varchar,
	"raw_score" real,
	"percentile_score" real,
	"scaled_score" real,
	"interpretation" text,
	"recommendations" text,
	"assessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psychometric_domain_age_band_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" varchar NOT NULL,
	"age_band_id" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"questions_count" integer DEFAULT 10,
	"weightage" real DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psychometric_domains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_code" text NOT NULL,
	"domain_name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'Core',
	"display_order" integer DEFAULT 1 NOT NULL,
	"icon_name" text,
	"color_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "psychometric_domains_domain_code_unique" UNIQUE("domain_code")
);
--> statement-breakpoint
CREATE TABLE "psychometric_question_bank" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_code" text NOT NULL,
	"domain_id" varchar NOT NULL,
	"subdomain_id" varchar,
	"age_band_id" varchar NOT NULL,
	"question_text" text NOT NULL,
	"question_type" text DEFAULT 'Likert' NOT NULL,
	"response_options" text,
	"scoring_logic" text,
	"reverse_scored" boolean DEFAULT false NOT NULL,
	"difficulty" text DEFAULT 'Medium',
	"language" text DEFAULT 'EN' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "psychometric_question_bank_question_code_unique" UNIQUE("question_code")
);
--> statement-breakpoint
CREATE TABLE "psychometric_subdomains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" varchar NOT NULL,
	"subdomain_code" text NOT NULL,
	"subdomain_name" text NOT NULL,
	"description" text,
	"measurement_scale" text DEFAULT '1-10',
	"display_order" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "psychometric_subdomains_subdomain_code_unique" UNIQUE("subdomain_code")
);
--> statement-breakpoint
CREATE TABLE "role_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"level" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_definitions_role_name_unique" UNIQUE("role_name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"granted_by" varchar,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_key" text NOT NULL,
	"config_value" text NOT NULL,
	"config_type" text NOT NULL,
	"description" text,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"compliance_framework" text[],
	"last_modified_by" varchar,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "security_configurations_config_key_unique" UNIQUE("config_key")
);
--> statement-breakpoint
CREATE TABLE "security_incidents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_code" text NOT NULL,
	"incident_type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"affected_systems" text[],
	"affected_users" text[],
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"detected_by" varchar,
	"contained_at" timestamp,
	"resolved_at" timestamp,
	"root_cause" text,
	"remediation_steps" text,
	"preventive_measures" text,
	"assigned_to" varchar,
	"escalated_to" varchar,
	"notifications_sent" boolean DEFAULT false NOT NULL,
	"compliance_impact" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "security_incidents_incident_code_unique" UNIQUE("incident_code")
);
--> statement-breakpoint
CREATE TABLE "staff_batch_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" varchar NOT NULL,
	"batch_id" varchar NOT NULL,
	"subject_id" varchar,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_name" text NOT NULL,
	"role_code" text NOT NULL,
	"permissions" text[],
	"description" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_roles_role_code_unique" UNIQUE("role_code")
);
--> statement-breakpoint
CREATE TABLE "student_assessment_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"selected_option" text,
	"text_response" text,
	"score" integer,
	"response_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_assessment_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"module_id" varchar NOT NULL,
	"age_group_id" varchar,
	"status" text DEFAULT 'Not Started' NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"questions_answered" integer DEFAULT 0 NOT NULL,
	"raw_score" real,
	"percentile_score" real,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_bulk_imports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institute_id" varchar NOT NULL,
	"batch_id" varchar,
	"file_name" text NOT NULL,
	"file_size" integer,
	"storage_path" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"processed_rows" integer DEFAULT 0 NOT NULL,
	"successful_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_rows" integer DEFAULT 0 NOT NULL,
	"error_log" text,
	"validation_errors" text[],
	"requires_approval" boolean DEFAULT true NOT NULL,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"uploaded_by" varchar,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_competency_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"competency_id" varchar NOT NULL,
	"session_id" varchar,
	"raw_score" real,
	"percentile_score" real,
	"proficiency_level" text,
	"assessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institute_id" varchar NOT NULL,
	"institute_name" text NOT NULL,
	"student_id" varchar NOT NULL,
	"student_name" text NOT NULL,
	"parent_id" varchar,
	"parent_name" text,
	"class_name" text,
	"section" text,
	"roll_number" text,
	"admission_date" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_status" text DEFAULT 'pending',
	"fee_amount" real,
	"paid_amount" real DEFAULT 0,
	"due_date" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"approval_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_import_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" varchar NOT NULL,
	"row_number" integer NOT NULL,
	"student_name" text NOT NULL,
	"dob" date,
	"gender" text,
	"parent_name" text,
	"parent_email" text,
	"parent_phone" text,
	"class_grade" text,
	"section" text,
	"roll_number" text,
	"admission_number" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"validation_errors" text[],
	"student_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" varchar,
	"student_id" varchar,
	"package_id" varchar NOT NULL,
	"purchase_date" timestamp DEFAULT now() NOT NULL,
	"expiry_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"assessment_completed_at" timestamp,
	"report_generated_at" timestamp,
	"payment_transaction_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"institute_id" varchar,
	"student_code" text NOT NULL,
	"full_name" text NOT NULL,
	"dob" date,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "students_student_code_unique" UNIQUE("student_code")
);
--> statement-breakpoint
CREATE TABLE "study_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" varchar NOT NULL,
	"created_by_parent_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"task_type" text DEFAULT 'study' NOT NULL,
	"subject_id" varchar,
	"chapter_id" varchar,
	"topic_id" varchar,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"due_date" timestamp,
	"estimated_minutes" integer,
	"status" text DEFAULT 'Pending' NOT NULL,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"student_segment" text NOT NULL,
	"product_name" text NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"domains_covered" text[] DEFAULT '{}'::text[] NOT NULL,
	"price" real,
	"validity_days" integer,
	"question_count" integer,
	"report_type" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervised_test_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" varchar NOT NULL,
	"parent_id" varchar NOT NULL,
	"child_id" varchar NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "test_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" varchar NOT NULL,
	"approver_user_id" varchar NOT NULL,
	"approval_status" text DEFAULT 'Pending' NOT NULL,
	"comments" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" varchar NOT NULL,
	"assignment_type" text NOT NULL,
	"child_id" varchar,
	"batch_id" varchar,
	"institute_id" varchar,
	"section" text,
	"assigned_by" varchar NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" varchar NOT NULL,
	"assignment_id" varchar,
	"child_id" varchar NOT NULL,
	"status" text DEFAULT 'Not Started' NOT NULL,
	"score_obtained" real,
	"total_marks" real,
	"percentage_score" real,
	"time_taken_seconds" integer,
	"started_at" timestamp,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_blueprints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_code" text NOT NULL,
	"blueprint_name" text NOT NULL,
	"test_type" text NOT NULL,
	"description" text,
	"board_id" varchar,
	"class_id" varchar,
	"subject_id" varchar,
	"chapter_id" varchar,
	"duration" integer DEFAULT 60 NOT NULL,
	"total_marks" integer DEFAULT 100 NOT NULL,
	"passing_marks" integer DEFAULT 35 NOT NULL,
	"total_questions" integer DEFAULT 20 NOT NULL,
	"question_distribution" text,
	"instructions" text,
	"created_by" varchar,
	"institute_id" varchar,
	"is_public" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "test_blueprints_blueprint_code_unique" UNIQUE("blueprint_code")
);
--> statement-breakpoint
CREATE TABLE "test_question_bank" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_code" text NOT NULL,
	"question_type" text DEFAULT 'MCQ' NOT NULL,
	"difficulty_level" text DEFAULT 'Medium' NOT NULL,
	"question_text" text NOT NULL,
	"option_a" text,
	"option_b" text,
	"option_c" text,
	"option_d" text,
	"option_e" text,
	"correct_option" text,
	"answer_text" text,
	"explanation" text,
	"marks" integer DEFAULT 1 NOT NULL,
	"negative_marks" real DEFAULT 0,
	"board_id" varchar,
	"class_id" varchar,
	"subject_id" varchar,
	"chapter_id" varchar,
	"topic_id" varchar,
	"assessment_type" text DEFAULT 'Practice',
	"assessment_code" text,
	"passage_id" varchar,
	"case_study_id" varchar,
	"diagram_url" text,
	"tags" text[],
	"language" text DEFAULT 'EN' NOT NULL,
	"psychopsis_sub_module_id" varchar,
	"created_by" varchar,
	"institute_id" varchar,
	"is_verified" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "test_question_bank_question_code_unique" UNIQUE("question_code")
);
--> statement-breakpoint
CREATE TABLE "test_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" varchar NOT NULL,
	"question_bank_id" varchar,
	"question_text" text NOT NULL,
	"option_a" text,
	"option_b" text,
	"option_c" text,
	"option_d" text,
	"correct_option" text NOT NULL,
	"explanation" text,
	"marks" integer DEFAULT 1 NOT NULL,
	"negative_marks" real DEFAULT 0,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"selected_option" text,
	"is_correct" boolean,
	"marks_obtained" real DEFAULT 0,
	"time_taken_seconds" integer,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_workflow_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" varchar NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"action_by" varchar NOT NULL,
	"action_type" text NOT NULL,
	"comments" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_code" text NOT NULL,
	"test_name" text NOT NULL,
	"test_type" text NOT NULL,
	"blueprint_id" varchar,
	"board_id" varchar,
	"class_id" varchar,
	"subject_id" varchar,
	"chapter_id" varchar,
	"duration" integer DEFAULT 60 NOT NULL,
	"total_marks" integer DEFAULT 100 NOT NULL,
	"passing_marks" integer DEFAULT 35 NOT NULL,
	"instructions" text,
	"created_by" varchar NOT NULL,
	"institute_id" varchar,
	"creator_type" text DEFAULT 'parent' NOT NULL,
	"workflow_status" text DEFAULT 'Draft' NOT NULL,
	"is_auto_generated" boolean DEFAULT false NOT NULL,
	"scheduled_at" timestamp,
	"expires_at" timestamp,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tests_test_code_unique" UNIQUE("test_code")
);
--> statement-breakpoint
CREATE TABLE "training_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" varchar NOT NULL,
	"program_id" varchar NOT NULL,
	"status" text DEFAULT 'enrolled' NOT NULL,
	"attendance_percent" real DEFAULT 0,
	"assessment_score" real,
	"started_at" timestamp,
	"completed_at" timestamp,
	"failure_reason" text,
	"retraining_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_programs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_name" text NOT NULL,
	"description" text,
	"role_category" text NOT NULL,
	"duration_days" integer DEFAULT 7 NOT NULL,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"modules" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"device_type" text,
	"browser" text,
	"os" text,
	"location" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"terminated_at" timestamp,
	"termination_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text,
	"role" text DEFAULT 'parent' NOT NULL,
	"roles" text[] DEFAULT ARRAY['parent']::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "white_label_partners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_code" text NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"brand_logo_url" text,
	"brand_primary_color" text,
	"brand_accent_color" text,
	"custom_domain" text,
	"revenue_share_percent" real DEFAULT 20 NOT NULL,
	"mentor_pool_size" integer DEFAULT 0,
	"status" text DEFAULT 'pilot' NOT NULL,
	"pilot_start_date" date,
	"rollout_date" date,
	"terminated_at" timestamp,
	"termination_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "white_label_partners_partner_code_unique" UNIQUE("partner_code")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_chapters" ADD CONSTRAINT "academic_chapters_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_classes" ADD CONSTRAINT "academic_classes_board_id_education_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."education_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_subjects" ADD CONSTRAINT "academic_subjects_board_id_education_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."education_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_subjects" ADD CONSTRAINT "academic_subjects_class_id_academic_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."academic_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_topics" ADD CONSTRAINT "academic_topics_chapter_id_academic_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."academic_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD CONSTRAINT "acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD CONSTRAINT "acknowledgements_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_blueprints" ADD CONSTRAINT "assessment_blueprints_board_id_education_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."education_boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_blueprints" ADD CONSTRAINT "assessment_blueprints_class_id_academic_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."academic_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_blueprints" ADD CONSTRAINT "assessment_blueprints_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_blueprints" ADD CONSTRAINT "assessment_blueprints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_template_questions" ADD CONSTRAINT "assessment_template_questions_template_id_assessment_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."assessment_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_sections" ADD CONSTRAINT "blueprint_sections_blueprint_id_assessment_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."assessment_blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_academic_profiles" ADD CONSTRAINT "child_academic_profiles_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_academic_profiles" ADD CONSTRAINT "child_academic_profiles_board_id_education_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."education_boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_academic_profiles" ADD CONSTRAINT "child_academic_profiles_class_id_academic_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."academic_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_exam_questions" ADD CONSTRAINT "child_exam_questions_child_exam_id_child_exams_id_fk" FOREIGN KEY ("child_exam_id") REFERENCES "public"."child_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_exams" ADD CONSTRAINT "child_exams_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_subject_enrollments" ADD CONSTRAINT "child_subject_enrollments_profile_id_child_academic_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."child_academic_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_subject_enrollments" ADD CONSTRAINT "child_subject_enrollments_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_violations" ADD CONSTRAINT "compliance_violations_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_violations" ADD CONSTRAINT "compliance_violations_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_violations" ADD CONSTRAINT "compliance_violations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_parent_student_link_id_parent_student_links_id_fk" FOREIGN KEY ("parent_student_link_id") REFERENCES "public"."parent_student_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."document_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_maker_verified_by_users_id_fk" FOREIGN KEY ("maker_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_checker_approved_by_users_id_fk" FOREIGN KEY ("checker_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_last_accessed_by_users_id_fk" FOREIGN KEY ("last_accessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_consents" ADD CONSTRAINT "email_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_codes" ADD CONSTRAINT "entity_codes_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_responses" ADD CONSTRAINT "exam_responses_attempt_id_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_responses" ADD CONSTRAINT "exam_responses_question_id_exam_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_attachments" ADD CONSTRAINT "forum_attachments_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_attachments" ADD CONSTRAINT "forum_attachments_reply_id_forum_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."forum_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_moderation_logs" ADD CONSTRAINT "forum_moderation_logs_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_moderation_logs" ADD CONSTRAINT "forum_moderation_logs_reply_id_forum_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."forum_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_moderation_logs" ADD CONSTRAINT "forum_moderation_logs_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_moderation_logs" ADD CONSTRAINT "forum_moderation_logs_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_question_id_test_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."test_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_chapter_id_academic_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."academic_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_assigned_mentor_id_users_id_fk" FOREIGN KEY ("assigned_mentor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_assigned_teacher_id_users_id_fk" FOREIGN KEY ("assigned_teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_votes" ADD CONSTRAINT "forum_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_votes" ADD CONSTRAINT "forum_votes_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_votes" ADD CONSTRAINT "forum_votes_reply_id_forum_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."forum_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_audit_logs" ADD CONSTRAINT "hr_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_consent_logs" ADD CONSTRAINT "hr_consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_consent_logs" ADD CONSTRAINT "hr_consent_logs_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institute_staff" ADD CONSTRAINT "institute_staff_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institute_staff" ADD CONSTRAINT "institute_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institute_staff" ADD CONSTRAINT "institute_staff_role_id_staff_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."staff_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutes" ADD CONSTRAINT "institutes_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutional_slas" ADD CONSTRAINT "institutional_slas_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_job_postings_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_approval_logs" ADD CONSTRAINT "job_approval_logs_job_id_job_postings_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_approval_logs" ADD CONSTRAINT "job_approval_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_distributions" ADD CONSTRAINT "job_distributions_job_id_job_postings_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_hr_review_by_users_id_fk" FOREIGN KEY ("hr_review_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_legal_review_by_users_id_fk" FOREIGN KEY ("legal_review_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_leadership_approval_by_users_id_fk" FOREIGN KEY ("leadership_approval_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_maker_id_users_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_checker_id_users_id_fk" FOREIGN KEY ("checker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_assessment_sessions" ADD CONSTRAINT "lbi_assessment_sessions_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_assessment_sessions" ADD CONSTRAINT "lbi_assessment_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_assessment_sessions" ADD CONSTRAINT "lbi_assessment_sessions_age_band_id_lbi_age_bands_id_fk" FOREIGN KEY ("age_band_id") REFERENCES "public"."lbi_age_bands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_assessments" ADD CONSTRAINT "lbi_assessments_lbi_type_id_lbi_types_id_fk" FOREIGN KEY ("lbi_type_id") REFERENCES "public"."lbi_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychopsis_categories" ADD CONSTRAINT "psychopsis_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_domain_scores" ADD CONSTRAINT "lbi_domain_scores_session_id_lbi_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."lbi_assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_domain_scores" ADD CONSTRAINT "lbi_domain_scores_domain_id_lbi_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."lbi_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_overall_index" ADD CONSTRAINT "lbi_overall_index_session_id_lbi_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."lbi_assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_overall_index" ADD CONSTRAINT "lbi_overall_index_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_overall_index" ADD CONSTRAINT "lbi_overall_index_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_performance_correlation" ADD CONSTRAINT "lbi_performance_correlation_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_performance_correlation" ADD CONSTRAINT "lbi_performance_correlation_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_question_bank" ADD CONSTRAINT "lbi_question_bank_sub_module_id_lbi_sub_modules_id_fk" FOREIGN KEY ("sub_module_id") REFERENCES "public"."lbi_sub_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_questions" ADD CONSTRAINT "lbi_questions_domain_id_lbi_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."lbi_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_questions" ADD CONSTRAINT "lbi_questions_subdomain_id_lbi_subdomains_id_fk" FOREIGN KEY ("subdomain_id") REFERENCES "public"."lbi_subdomains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_questions" ADD CONSTRAINT "lbi_questions_age_band_id_lbi_age_bands_id_fk" FOREIGN KEY ("age_band_id") REFERENCES "public"."lbi_age_bands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_questions" ADD CONSTRAINT "lbi_questions_response_scale_id_lbi_response_scales_id_fk" FOREIGN KEY ("response_scale_id") REFERENCES "public"."lbi_response_scales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_scoring_rules" ADD CONSTRAINT "lbi_scoring_rules_domain_id_lbi_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."lbi_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_scoring_rules" ADD CONSTRAINT "lbi_scoring_rules_subdomain_id_lbi_subdomains_id_fk" FOREIGN KEY ("subdomain_id") REFERENCES "public"."lbi_subdomains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_scoring_rules" ADD CONSTRAINT "lbi_scoring_rules_age_band_id_lbi_age_bands_id_fk" FOREIGN KEY ("age_band_id") REFERENCES "public"."lbi_age_bands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_session_responses" ADD CONSTRAINT "lbi_session_responses_session_id_lbi_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."lbi_assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_session_responses" ADD CONSTRAINT "lbi_session_responses_question_id_lbi_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."lbi_questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_sessions" ADD CONSTRAINT "lbi_sessions_assessment_id_lbi_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."lbi_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_sessions" ADD CONSTRAINT "lbi_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_sub_modules" ADD CONSTRAINT "lbi_sub_modules_module_id_lbi_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."lbi_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_subdomain_scores" ADD CONSTRAINT "lbi_subdomain_scores_session_id_lbi_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."lbi_assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_subdomain_scores" ADD CONSTRAINT "lbi_subdomain_scores_subdomain_id_lbi_subdomains_id_fk" FOREIGN KEY ("subdomain_id") REFERENCES "public"."lbi_subdomains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lbi_subdomains" ADD CONSTRAINT "lbi_subdomains_domain_id_lbi_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."lbi_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_templates" ADD CONSTRAINT "learning_plan_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_templates" ADD CONSTRAINT "learning_plan_templates_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lei_registrations" ADD CONSTRAINT "lei_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lei_registrations" ADD CONSTRAINT "lei_registrations_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_kpis" ADD CONSTRAINT "mentor_kpis_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_payouts" ADD CONSTRAINT "mentor_payouts_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_payouts" ADD CONSTRAINT "mentor_payouts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_tasks" ADD CONSTRAINT "mentor_tasks_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_tasks" ADD CONSTRAINT "mentor_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentors" ADD CONSTRAINT "mentors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentors" ADD CONSTRAINT "mentors_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_codes" ADD CONSTRAINT "mfa_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ngo_registrations" ADD CONSTRAINT "ngo_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ngo_registrations" ADD CONSTRAINT "ngo_registrations_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_approvals" ADD CONSTRAINT "onboarding_approvals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_test_assignments" ADD CONSTRAINT "parent_test_assignments_test_id_parent_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."parent_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_test_assignments" ADD CONSTRAINT "parent_test_assignments_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_test_assignments" ADD CONSTRAINT "parent_test_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_test_results" ADD CONSTRAINT "parent_test_results_assignment_id_parent_test_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."parent_test_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_tests" ADD CONSTRAINT "parent_tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_analytics" ADD CONSTRAINT "performance_analytics_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_analytics" ADD CONSTRAINT "performance_analytics_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_analytics" ADD CONSTRAINT "performance_analytics_chapter_id_academic_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."academic_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_transactions" ADD CONSTRAINT "platform_transactions_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_onboarding_checklists" ADD CONSTRAINT "pre_onboarding_checklists_temporary_approved_by_users_id_fk" FOREIGN KEY ("temporary_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_onboarding_checklists" ADD CONSTRAINT "pre_onboarding_checklists_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_onboarding_checklists" ADD CONSTRAINT "pre_onboarding_checklists_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_assessment_results" ADD CONSTRAINT "psychometric_assessment_results_age_band_id_psychometric_age_bands_id_fk" FOREIGN KEY ("age_band_id") REFERENCES "public"."psychometric_age_bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_assessment_results" ADD CONSTRAINT "psychometric_assessment_results_domain_id_psychometric_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."psychometric_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_assessment_results" ADD CONSTRAINT "psychometric_assessment_results_subdomain_id_psychometric_subdomains_id_fk" FOREIGN KEY ("subdomain_id") REFERENCES "public"."psychometric_subdomains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_domain_age_band_config" ADD CONSTRAINT "psychometric_domain_age_band_config_domain_id_psychometric_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."psychometric_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_domain_age_band_config" ADD CONSTRAINT "psychometric_domain_age_band_config_age_band_id_psychometric_age_bands_id_fk" FOREIGN KEY ("age_band_id") REFERENCES "public"."psychometric_age_bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_question_bank" ADD CONSTRAINT "psychometric_question_bank_domain_id_psychometric_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."psychometric_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_question_bank" ADD CONSTRAINT "psychometric_question_bank_subdomain_id_psychometric_subdomains_id_fk" FOREIGN KEY ("subdomain_id") REFERENCES "public"."psychometric_subdomains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_question_bank" ADD CONSTRAINT "psychometric_question_bank_age_band_id_psychometric_age_bands_id_fk" FOREIGN KEY ("age_band_id") REFERENCES "public"."psychometric_age_bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_subdomains" ADD CONSTRAINT "psychometric_subdomains_domain_id_psychometric_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."psychometric_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_role_definitions_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permission_definitions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_configurations" ADD CONSTRAINT "security_configurations_last_modified_by_users_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_detected_by_users_id_fk" FOREIGN KEY ("detected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_batch_assignments" ADD CONSTRAINT "staff_batch_assignments_staff_id_institute_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."institute_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_batch_assignments" ADD CONSTRAINT "staff_batch_assignments_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_batch_assignments" ADD CONSTRAINT "staff_batch_assignments_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessment_responses" ADD CONSTRAINT "student_assessment_responses_session_id_student_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."student_assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessment_responses" ADD CONSTRAINT "student_assessment_responses_question_id_lbi_question_bank_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."lbi_question_bank"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessment_sessions" ADD CONSTRAINT "student_assessment_sessions_module_id_lbi_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."lbi_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessment_sessions" ADD CONSTRAINT "student_assessment_sessions_age_group_id_lbi_age_groups_id_fk" FOREIGN KEY ("age_group_id") REFERENCES "public"."lbi_age_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_bulk_imports" ADD CONSTRAINT "student_bulk_imports_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_bulk_imports" ADD CONSTRAINT "student_bulk_imports_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_bulk_imports" ADD CONSTRAINT "student_bulk_imports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_bulk_imports" ADD CONSTRAINT "student_bulk_imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_competency_scores" ADD CONSTRAINT "student_competency_scores_competency_id_competency_library_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competency_library"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_competency_scores" ADD CONSTRAINT "student_competency_scores_session_id_student_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."student_assessment_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_import_records" ADD CONSTRAINT "student_import_records_import_id_student_bulk_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."student_bulk_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_import_records" ADD CONSTRAINT "student_import_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subscriptions" ADD CONSTRAINT "student_subscriptions_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subscriptions" ADD CONSTRAINT "student_subscriptions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subscriptions" ADD CONSTRAINT "student_subscriptions_package_id_subscription_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."subscription_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_created_by_parent_id_users_id_fk" FOREIGN KEY ("created_by_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_chapter_id_academic_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."academic_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_topic_id_academic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."academic_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervised_test_sessions" ADD CONSTRAINT "supervised_test_sessions_exam_id_child_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."child_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervised_test_sessions" ADD CONSTRAINT "supervised_test_sessions_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervised_test_sessions" ADD CONSTRAINT "supervised_test_sessions_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_approvals" ADD CONSTRAINT "test_approvals_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_approvals" ADD CONSTRAINT "test_approvals_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_assignments" ADD CONSTRAINT "test_assignments_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_assignments" ADD CONSTRAINT "test_assignments_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_assignments" ADD CONSTRAINT "test_assignments_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_assignments" ADD CONSTRAINT "test_assignments_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_assignments" ADD CONSTRAINT "test_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_assignment_id_test_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."test_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_blueprints" ADD CONSTRAINT "test_blueprints_board_id_education_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."education_boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_blueprints" ADD CONSTRAINT "test_blueprints_class_id_academic_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."academic_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_blueprints" ADD CONSTRAINT "test_blueprints_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_blueprints" ADD CONSTRAINT "test_blueprints_chapter_id_academic_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."academic_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_blueprints" ADD CONSTRAINT "test_blueprints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_blueprints" ADD CONSTRAINT "test_blueprints_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_question_bank" ADD CONSTRAINT "test_question_bank_board_id_education_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."education_boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_question_bank" ADD CONSTRAINT "test_question_bank_class_id_academic_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."academic_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_question_bank" ADD CONSTRAINT "test_question_bank_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_question_bank" ADD CONSTRAINT "test_question_bank_chapter_id_academic_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."academic_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_question_bank" ADD CONSTRAINT "test_question_bank_topic_id_academic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."academic_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_question_bank" ADD CONSTRAINT "test_question_bank_psychopsis_sub_module_id_lbi_sub_modules_id_fk" FOREIGN KEY ("psychopsis_sub_module_id") REFERENCES "public"."lbi_sub_modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_question_bank" ADD CONSTRAINT "test_question_bank_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_question_bank" ADD CONSTRAINT "test_question_bank_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_question_bank_id_test_question_bank_id_fk" FOREIGN KEY ("question_bank_id") REFERENCES "public"."test_question_bank"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_responses" ADD CONSTRAINT "test_responses_attempt_id_test_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."test_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_responses" ADD CONSTRAINT "test_responses_question_id_test_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."test_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_workflow_history" ADD CONSTRAINT "test_workflow_history_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_workflow_history" ADD CONSTRAINT "test_workflow_history_action_by_users_id_fk" FOREIGN KEY ("action_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_blueprint_id_test_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."test_blueprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_board_id_education_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."education_boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_class_id_academic_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."academic_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_chapter_id_academic_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."academic_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;