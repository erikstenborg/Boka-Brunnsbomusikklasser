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
export const eventTypeEnum = pgEnum("event_type", ["luciatag", "sjungande_julgran"]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending", "reviewing", "approved", "completed"]);
export const activityActionEnum = pgEnum("activity_action", ["created", "status_changed", "assigned", "updated", "notes_added"]);

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
  eventType: eventTypeEnum("event_type").notNull(),
  contactName: varchar("contact_name").notNull(),
  contactEmail: varchar("contact_email").notNull(),
  contactPhone: varchar("contact_phone").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(), // Combined date and time with timezone
  durationMinutes: integer("duration_minutes").notNull(), // Duration in minutes for precise scheduling
  additionalNotes: text("additional_notes"),
  status: bookingStatusEnum("status").notNull().default("pending"),
  assignedTo: varchar("assigned_to"), // Foreign key to users.id
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // Performance indexes for common queries
  index("idx_event_bookings_status").on(table.status),
  index("idx_event_bookings_start_at").on(table.startAt),
  index("idx_event_bookings_assigned_to").on(table.assignedTo),
  index("idx_event_bookings_calendar").on(table.startAt, table.status), // Composite index for calendar queries
  index("idx_event_bookings_event_type").on(table.eventType),
  // Foreign key constraints
  foreignKey({
    columns: [table.assignedTo],
    foreignColumns: [users.id],
    name: "fk_event_bookings_assigned_to"
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

export const eventBookingsRelations = relations(eventBookings, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [eventBookings.assignedTo],
    references: [users.id],
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
    startAt: z.date("Invalid date format"),
    durationMinutes: z.number().min(30, "Minimum duration is 30 minutes").max(480, "Maximum duration is 8 hours"),
  });

export const updateEventBookingSchema = createInsertSchema(eventBookings)
  .pick({
    status: true,
    assignedTo: true,
    additionalNotes: true,
  })
  .extend({
    // Explicitly validate enum values for better type safety
    status: z.enum(["pending", "reviewing", "approved", "completed"]).optional(),
    assignedTo: z.string().optional(),
  });

// Admin-specific schemas for kanban workflow operations
export const updateBookingStatusSchema = z.object({
  status: z.enum(["pending", "reviewing", "approved", "completed"], {
    required_error: "Status is required",
  }),
});

export const assignBookingSchema = z.object({
  assignedTo: z.string().min(1, "Assigned user ID is required"),
});

// Form schema for frontend with date/time splitting
export const eventBookingFormSchema = z.object({
  eventType: z.enum(["luciatag", "sjungande_julgran"], {
    required_error: "Please select an event type",
  }),
  contactName: z.string().min(2, "Name must be at least 2 characters"),
  contactEmail: z.string().email("Please enter a valid email address"),
  contactPhone: z.string().min(10, "Please enter a valid phone number"),
  requestedDate: z.string().min(1, "Please select a date"),
  startTime: z.string().min(1, "Please select a start time"),
  durationHours: z.number().min(0.5, "Minimum duration is 0.5 hours").max(8, "Maximum duration is 8 hours").default(2),
  additionalNotes: z.string().optional(),
});

export type InsertEventBooking = z.infer<typeof insertEventBookingSchema>;
export type UpdateEventBooking = z.infer<typeof updateEventBookingSchema>;
export type UpdateBookingStatus = z.infer<typeof updateBookingStatusSchema>;
export type AssignBooking = z.infer<typeof assignBookingSchema>;
export type EventBookingForm = z.infer<typeof eventBookingFormSchema>;
export type EventBooking = typeof eventBookings.$inferSelect;

// Activity log schemas with updated action types
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Helper types for enum values
export type EventType = typeof eventBookings.eventType.enumValues[number];
export type BookingStatus = typeof eventBookings.status.enumValues[number];
export type ActivityAction = typeof activityLogs.action.enumValues[number];
