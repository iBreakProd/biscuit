import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: varchar("google_id").notNull().unique(),
  email: varchar("email").notNull(),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const chatRooms = pgTable("chat_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  title: varchar("title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chatRooms.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  sequence: integer("sequence").notNull(),
  agentTaskId: uuid("agent_task_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentTasks = pgTable("agent_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chatRooms.id),
  chatMessageId: uuid("chat_message_id")
    .notNull()
    .references(() => chatMessages.id),
  inputPrompt: text("input_prompt").notNull(),
  status: text("status", { enum: ["pending", "running", "completed", "error", "timeout", "max_steps"] }).notNull(),
  finalAnswerMarkdown: text("final_answer_markdown"),
  resultJson: jsonb("result_json"),
  stepSummaries: jsonb("step_summaries"),
  usedChunkIds: jsonb("used_chunk_ids"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const driveFiles = pgTable("drive_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  fileId: varchar("file_id").notNull(),
  name: varchar("name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  hash: varchar("hash"),
  lastModifiedAt: timestamp("last_modified_at"),
  lastIngestedAt: timestamp("last_ingested_at"),
  supported: boolean("supported").notNull(),
  ingestionPhase: text("ingestion_phase", { enum: ["discovered", "fetching", "chunk_pending", "vectorizing", "indexed", "failed"] }).notNull(),
  ingestionError: text("ingestion_error"),
  retryCount: integer("retry_count").notNull().default(0),
  lastRetryAt: timestamp("last_retry_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const rawDocuments = pgTable("raw_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  fileId: varchar("file_id").notNull(),
  mimeType: varchar("mime_type").notNull(),
  text: text("text").notNull(),
  hash: varchar("hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  fileId: varchar("file_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  text: text("text").notNull(),
  hash: varchar("hash"),
  vectorized: boolean("vectorized").notNull().default(false),
  qdrantPointId: varchar("qdrant_point_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
