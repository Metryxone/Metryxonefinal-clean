from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import (
    String, Text, Boolean, Integer, DateTime, ForeignKey,
    UniqueConstraint, Index, Enum, Numeric
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


# -------------------------
# ENUMS
# -------------------------
class QuestionType(str, enum.Enum):
    MCQ = "MCQ"
    SUBJECTIVE = "SUBJECTIVE"
    LIKERT = "LIKERT"


class DifficultyLevel(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class QuestionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class UploadStatus(str, enum.Enum):
    RECEIVED = "RECEIVED"
    VALIDATED = "VALIDATED"
    COMMITTED = "COMMITTED"
    FAILED = "FAILED"


# -------------------------
# MIXINS
# -------------------------
class UUIDPKMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ExtraJSONMixin:
    extra: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


# -------------------------
# UPLOAD-OWNED TABLES
# -------------------------
# NOTE: This service shares its database with the Node/Express backend, which
# OWNS the auth/domain tables (users, students, tests, attempts, ...). This
# service must NEVER define or create those tables, and must NOT hold a foreign
# key into them (the Node `users.id` is a varchar uuid, incompatible with a pg
# uuid FK). `created_by` is therefore a plain nullable column with no FK.
class QuestionBank(Base, UUIDPKMixin, TimestampMixin, ExtraJSONMixin):
    __tablename__ = "question_bank"

    # ✅ Required for multi-module routing (fixes your upload failures)
    module_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    question_code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)


    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType, name="question_type"), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)

    difficulty: Mapped[Optional[DifficultyLevel]] = mapped_column(Enum(DifficultyLevel, name="difficulty_level"))
    bloom_level: Mapped[Optional[str]] = mapped_column(String(50))

    status: Mapped[QuestionStatus] = mapped_column(
        Enum(QuestionStatus, name="question_status"), nullable=False, default=QuestionStatus.DRAFT
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Plain nullable column — intentionally NOT a FK to the Node-owned users table.
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Academic taxonomy (optional)
    board: Mapped[Optional[str]] = mapped_column(String(100))
    grade: Mapped[Optional[str]] = mapped_column(String(50))
    subject: Mapped[Optional[str]] = mapped_column(String(120))
    chapter: Mapped[Optional[str]] = mapped_column(String(120))
    topic: Mapped[Optional[str]] = mapped_column(String(120))
    language: Mapped[Optional[str]] = mapped_column(String(30))

    tags: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[Optional[str]] = mapped_column(String(120))

    review_state: Mapped[Optional[str]] = mapped_column(String(40))
    llm_improvable: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    llm_notes: Mapped[Optional[str]] = mapped_column(Text)

    # LBI-style fields (optional but indexed for analytics)
    domain_code: Mapped[Optional[str]] = mapped_column(String(50))
    domain_name: Mapped[Optional[str]] = mapped_column(String(255))
    subdomain_code: Mapped[Optional[str]] = mapped_column(String(50))
    subdomain_name: Mapped[Optional[str]] = mapped_column(String(255))
    age_band_code: Mapped[Optional[str]] = mapped_column(String(20))
    keying: Mapped[Optional[str]] = mapped_column(String(20))   # Positive / Negative
    anchor: Mapped[Optional[str]] = mapped_column(String(10))   # Yes / No
    passage_text: Mapped[Optional[str]] = mapped_column(Text)
    explanation: Mapped[Optional[str]] = mapped_column(Text)

    options: Mapped[List["QuestionOption"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        # Helpful query indexes
        Index("ix_qb_status", "status"),
        Index("ix_qb_domain_subdomain", "domain_code", "subdomain_code"),
        Index("ix_qb_grade_subject", "grade", "subject"),
    )


class QuestionOption(Base, UUIDPKMixin, TimestampMixin, ExtraJSONMixin):
    __tablename__ = "question_options"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("question_bank.id", ondelete="CASCADE"), nullable=False
    )

    option_code: Mapped[str] = mapped_column(String(10), nullable=False)  # A/B/C/D etc
    option_text: Mapped[str] = mapped_column(Text, nullable=False)
    option_score: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    question: Mapped["QuestionBank"] = relationship(back_populates="options")

    __table_args__ = (
        # ✅ prevents duplicates when re-uploading
        UniqueConstraint("question_id", "option_code", name="uq_question_options_questionid_code"),
        Index("ix_question_options_question_id", "question_id"),
    )


# -------------------------
# BULK UPLOAD AUDIT TABLES (your upload pipeline uses these)
# -------------------------
class BulkUploadJob(Base, UUIDPKMixin, TimestampMixin, ExtraJSONMixin):
    __tablename__ = "bulk_upload_jobs"

    upload_type: Mapped[str] = mapped_column(String(50), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)

    status: Mapped[UploadStatus] = mapped_column(Enum(UploadStatus, name="upload_status"), nullable=False, default=UploadStatus.RECEIVED)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    rows: Mapped[List["BulkUploadRow"]] = relationship(back_populates="job", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_bulk_upload_jobs_type", "upload_type"),)


class BulkUploadRow(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "bulk_upload_rows"

    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bulk_upload_jobs.id", ondelete="CASCADE"), nullable=False)
    row_num: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OK")
    error: Mapped[Optional[str]] = mapped_column(Text)

    raw: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    job: Mapped["BulkUploadJob"] = relationship(back_populates="rows")

    __table_args__ = (
        Index("ix_bulk_upload_rows_job_id", "job_id"),
        UniqueConstraint("job_id", "row_num", name="uq_bulk_upload_rows_job_row"),
    )



class TaskVariant(Base, UUIDPKMixin, TimestampMixin, ExtraJSONMixin):
    __tablename__ = "task_variants"

    variant_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    instruction_text: Mapped[str] = mapped_column(Text, nullable=False)

    primary_target: Mapped[Optional[str]] = mapped_column(String(255))
    distractors: Mapped[Optional[str]] = mapped_column(String(255))
    age_band: Mapped[Optional[str]] = mapped_column(String(20))
    selectivity: Mapped[Optional[str]] = mapped_column(String(50))
    target: Mapped[Optional[str]] = mapped_column(String(255))

    module_code: Mapped[str] = mapped_column(String(50), nullable=False, default="EXAM_READY", index=True)
