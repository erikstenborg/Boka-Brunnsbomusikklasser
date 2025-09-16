import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  integer,
  pgEnum,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums for better type safety and database constraints
export const activityActionEnum = pgEnum("activity_action", ["created", "status_changed", "assigned", "updated", "notes_added"]);

// Event types table for configurable event types with buffer times
export const eventTypes = pgTable("event_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 50 }).notNull().unique(), // Machine-readable identifier (e.g., "luciatag", "sjungande_julgran")
  name: varchar("name", { length: 100 }).notNull(), // Human-readable Swedish name (e.g., "Luciatåg")
  description: text("description").notNull(), // Detailed Swedish description for the event type
  icon: varchar("icon", { length: 50 }).notNull(), // Icon identifier for UI display (e.g., "Music", "Users")
  defaultDurationMinutes: integer("default_duration_minutes").notNull().default(120), // Default duration in minutes
  bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(30), // Buffer time before event in minutes
  bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(30), // Buffer time after event in minutes
  isActive: boolean("is_active").default(true), // Whether this event type is currently active/bookable
  displayOrder: integer("display_order").notNull().default(0), // Order for UI display
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // Index for active event types ordering
  index("idx_event_types_active_order").on(table.isActive, table.displayOrder),
  // Index for slug lookups
  index("idx_event_types_slug").on(table.slug),
]);

// Workflow statuses table for configurable booking statuses
export const workflowStatuses = pgTable("workflow_statuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 50 }).notNull().unique(), // Machine-readable identifier (e.g., "pending", "approved")
  name: varchar("name", { length: 100 }).notNull(), // Human-readable Swedish name (e.g., "Väntar på granskning")
  displayOrder: integer("display_order").notNull().default(0), // Order for kanban columns and dropdowns
  color: varchar("color", { length: 20 }).default("gray"), // Color for UI display (e.g., "blue", "green", "red")
  isDefault: boolean("is_default").default(false), // Whether this is the default status for new bookings
  isFinal: boolean("is_final").default(false), // Whether this status represents completion of the workflow
  isActive: boolean("is_active").default(true), // Whether this status is currently active/usable
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // Ensure only one default status exists
  index("idx_workflow_statuses_default").on(table.isDefault),
  // Index for ordering in kanban and dropdowns
  index("idx_workflow_statuses_order").on(table.displayOrder, table.isActive),
  // Index for active status lookups
  index("idx_workflow_statuses_active").on(table.isActive),
]);

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event bookings table with proper temporal types and foreign keys
export const eventBookings = pgTable("event_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventTypeId: varchar("event_type_id").notNull(), // Foreign key to event_types
  contactName: varchar("contact_name").notNull(),
  contactEmail: varchar("contact_email").notNull(),
  contactPhone: varchar("contact_phone").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(), // Combined date and time with timezone
  durationMinutes: integer("duration_minutes").notNull(), // Duration in minutes for precise scheduling
  additionalNotes: text("additional_notes"),
  statusId: varchar("status_id").notNull(), // Foreign key to workflow_statuses
  assignedTo: varchar("assigned_to"), // Foreign key to users.id
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // Performance indexes for common queries
  index("idx_event_bookings_status").on(table.statusId),
  index("idx_event_bookings_start_at").on(table.startAt),
  index("idx_event_bookings_assigned_to").on(table.assignedTo),
  index("idx_event_bookings_calendar").on(table.startAt, table.statusId), // Composite index for calendar queries
  index("idx_event_bookings_event_type").on(table.eventTypeId),
  // Foreign key constraints
  foreignKey({
    columns: [table.assignedTo],
    foreignColumns: [users.id],
    name: "fk_event_bookings_assigned_to"
  }),
  foreignKey({
    columns: [table.statusId],
    foreignColumns: [workflowStatuses.id],
    name: "fk_event_bookings_status_id"
  }),
  foreignKey({
    columns: [table.eventTypeId],
    foreignColumns: [eventTypes.id],
    name: "fk_event_bookings_event_type_id"
  }),
]);

// Activity logs table for tracking changes with foreign keys and indexes
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(),
  action: activityActionEnum("action").notNull(),
  details: text("details").notNull(),
  userId: varchar("user_id"), // Who made the change (null for system changes)
  userName: varchar("user_name"), // Cached user name for display
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
}, (table) => [
  // Performance indexes for activity log queries
  index("idx_activity_logs_booking_id").on(table.bookingId),
  index("idx_activity_logs_timestamp").on(table.timestamp),
  index("idx_activity_logs_user_id").on(table.userId),
  index("idx_activity_logs_booking_timestamp").on(table.bookingId, table.timestamp), // Composite for booking history
  // Foreign key constraints
  foreignKey({
    columns: [table.bookingId],
    foreignColumns: [eventBookings.id],
    name: "fk_activity_logs_booking_id"
  }),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "fk_activity_logs_user_id"
  }),
]);

// Define relations for better type safety and joins
export const usersRelations = relations(users, ({ many }) => ({
  assignedBookings: many(eventBookings),
  activityLogs: many(activityLogs),
}));

export const eventTypesRelations = relations(eventTypes, ({ many }) => ({
  bookings: many(eventBookings),
}));

export const workflowStatusesRelations = relations(workflowStatuses, ({ many }) => ({
  bookings: many(eventBookings),
}));

export const eventBookingsRelations = relations(eventBookings, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [eventBookings.assignedTo],
    references: [users.id],
  }),
  status: one(workflowStatuses, {
    fields: [eventBookings.statusId],
    references: [workflowStatuses.id],
  }),
  eventType: one(eventTypes, {
    fields: [eventBookings.eventTypeId],
    references: [eventTypes.id],
  }),
  activityLogs: many(activityLogs),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  booking: one(eventBookings, {
    fields: [activityLogs.bookingId],
    references: [eventBookings.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

// Schema types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Event booking schemas with updated temporal handling
export const insertEventBookingSchema = createInsertSchema(eventBookings)
  .omit({
    id: true,
    status: true,
    assignedTo: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // Accept Date objects for temporal data (as Drizzle expects)
    startAt: z.date({ invalid_type_error: "Invalid date format" }),
    durationMinutes: z.number().min(30, "Minimum duration is 30 minutes").max(480, "Maximum duration is 8 hours"),
  });

export const updateEventBookingSchema = createInsertSchema(eventBookings)
  .pick({
    statusId: true,
    assignedTo: true,
    additionalNotes: true,
  })
  .extend({
    // Status ID must be a valid UUID string
    statusId: z.string().uuid().optional(),
    assignedTo: z.string().optional(),
  });

// Admin-specific schemas for kanban workflow operations
export const updateBookingStatusSchema = z.object({
  statusId: z.string().uuid({
    message: "Valid status ID is required",
  }),
});

export const assignBookingSchema = z.object({
  assignedTo: z.string().min(1, "Assigned user ID is required"),
});

// Form schema for frontend with date/time splitting
export const eventBookingFormSchema = z.object({
  eventTypeId: z.string().uuid({
    message: "Please select a valid event type",
  }),
  eventType: z.string().optional(), // For backwards compatibility during migration
  contactName: z.string().min(2, "Name must be at least 2 characters"),
  contactEmail: z.string().email("Please enter a valid email address"),
  contactPhone: z.string().min(10, "Please enter a valid phone number"),
  requestedDate: z.string().min(1, "Please select a date"),
  startTime: z.string().min(1, "Please select a start time"),
  durationHours: z.number().min(0.5, "Minimum duration is 0.5 hours").max(8, "Maximum duration is 8 hours").default(2),
  additionalNotes: z.string().optional(),
});

// Workflow status schemas
export const insertWorkflowStatusSchema = createInsertSchema(workflowStatuses)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    slug: z.string().min(1).max(50).regex(/^[a-z_]+$/, "Slug must contain only lowercase letters and underscores"),
    name: z.string().min(1).max(100),
    displayOrder: z.number().int().min(0).default(0),
    color: z.string().min(1).max(20).default("gray"),
    isDefault: z.boolean().default(false),
    isFinal: z.boolean().default(false),
    isActive: z.boolean().default(true),
  });

export const updateWorkflowStatusSchema = createInsertSchema(workflowStatuses)
  .pick({
    name: true,
    displayOrder: true,
    color: true,
    isDefault: true,
    isFinal: true,
    isActive: true,
  })
  .extend({
    name: z.string().min(1).max(100).optional(),
    displayOrder: z.number().int().min(0).optional(),
    color: z.string().min(1).max(20).optional(),
    isDefault: z.boolean().optional(),
    isFinal: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

export type InsertEventBooking = z.infer<typeof insertEventBookingSchema>;
export type UpdateEventBooking = z.infer<typeof updateEventBookingSchema>;
export type UpdateBookingStatus = z.infer<typeof updateBookingStatusSchema>;
export type AssignBooking = z.infer<typeof assignBookingSchema>;
export type EventBookingForm = z.infer<typeof eventBookingFormSchema>;
export type EventBooking = typeof eventBookings.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type InsertEventType = z.infer<typeof insertEventTypeSchema>;
export type UpdateEventType = z.infer<typeof updateEventTypeSchema>;

// Workflow status types
export type WorkflowStatus = typeof workflowStatuses.$inferSelect;
export type InsertWorkflowStatus = z.infer<typeof insertWorkflowStatusSchema>;
export type UpdateWorkflowStatus = z.infer<typeof updateWorkflowStatusSchema>;

// Activity log schemas with updated action types
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Event type schemas
export const insertEventTypeSchema = createInsertSchema(eventTypes)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    slug: z.string().min(1).max(50).regex(/^[a-z_]+$/, "Slug must contain only lowercase letters and underscores"),
    name: z.string().min(1).max(100),
    description: z.string().min(1),
    icon: z.string().min(1).max(50),
    defaultDurationMinutes: z.number().int().min(15).max(480).default(120),
    bufferBeforeMinutes: z.number().int().min(0).max(240).default(30),
    bufferAfterMinutes: z.number().int().min(0).max(240).default(30),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
  });

export const updateEventTypeSchema = createInsertSchema(eventTypes)
  .pick({
    name: true,
    description: true,
    icon: true,
    defaultDurationMinutes: true,
    bufferBeforeMinutes: true,
    bufferAfterMinutes: true,
    isActive: true,
    displayOrder: true,
  })
  .extend({
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(1).optional(),
    icon: z.string().min(1).max(50).optional(),
    defaultDurationMinutes: z.number().int().min(15).max(480).optional(),
    bufferBeforeMinutes: z.number().int().min(0).max(240).optional(),
    bufferAfterMinutes: z.number().int().min(0).max(240).optional(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  });

// Helper types
export type ActivityAction = typeof activityLogs.action.enumValues[number];

// Extended booking types with relations
export type EventBookingWithStatus = EventBooking & {
  status: WorkflowStatus;
};

export type EventBookingWithStatusAndType = EventBooking & {
  status: WorkflowStatus;
  eventType: EventType;
};
