import { pgTable, varchar, text, boolean, real, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const subscriptionPackages = pgTable("subscription_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),                 // e.g. 'exam-ready'
  studentSegment: text("student_segment").notNull(),   // e.g. 'class-10'
  productName: text("product_name").notNull(),
  isRecommended: boolean("is_recommended").notNull().default(false),
  domainsCovered: text("domains_covered").array().notNull(),
  price: real("price"),
  validityDays: integer("validity_days"),
  questionCount: integer("question_count"),
  reportType: text("report_type"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const studentSubscriptions = pgTable("student_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id"),
  studentId: varchar("student_id"),
  packageId: varchar("package_id").notNull(),
  purchaseDate: timestamp("purchase_date").notNull().defaultNow(),
  expiryDate: timestamp("expiry_date"),
  status: text("status").notNull().default("active"), // active/expired/cancelled
  assessmentCompletedAt: timestamp("assessment_completed_at"),
  reportGeneratedAt: timestamp("report_generated_at"),
  paymentTransactionId: varchar("payment_transaction_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
