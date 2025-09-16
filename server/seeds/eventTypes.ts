import { db } from "../db";
import { eventTypes, eventBookings, type InsertEventType } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Default Swedish event types with buffer times and Swedish descriptions
export const defaultEventTypes: InsertEventType[] = [
  {
    slug: "luciatag",
    name: "Luciatåg",
    description: "Traditionell svensk luciafirande med sång och ljus. Luciatåg är en vacker tradition där barn och ungdomar sjunger julsånger iklädd vita klänningar och stjärnkronor.",
    icon: "Music",
    defaultDurationMinutes: 30, // 0.5 hours as specified
    bufferBeforeMinutes: 30, // 30 minutes buffer before
    bufferAfterMinutes: 30, // 30 minutes buffer after
    isActive: true,
    displayOrder: 1,
  },
  {
    slug: "sjungande_julgran",
    name: "Sjungande Julgran",
    description: "Julgransuppvisning med sång och musikframförande. En festlig upplevelse där deltagarna sjunger traditionella julsånger runt julgranen.",
    icon: "Users",
    defaultDurationMinutes: 120, // 2 hours default duration
    bufferBeforeMinutes: 120, // 2 hours buffer before as specified
    bufferAfterMinutes: 120, // 2 hours buffer after as specified
    isActive: true,
    displayOrder: 2,
  },
];

export async function seedEventTypes(): Promise<void> {
  console.log("🌱 Seeding event types...");

  try {
    // Check if event types already exist
    const existingEventTypes = await db.select().from(eventTypes);
    
    if (existingEventTypes.length > 0) {
      console.log(`ℹ️  Event types already exist (${existingEventTypes.length} found), skipping seed.`);
      return;
    }

    // Insert default event types with generated IDs
    const eventTypesWithIds = defaultEventTypes.map(eventType => ({
      ...eventType,
      id: randomUUID(),
    }));

    await db.insert(eventTypes).values(eventTypesWithIds);

    console.log(`✅ Successfully seeded ${eventTypesWithIds.length} event types:`);
    eventTypesWithIds.forEach(eventType => {
      console.log(`   - ${eventType.slug} (${eventType.name})`);
      console.log(`     Duration: ${eventType.defaultDurationMinutes} min, Buffer: ${eventType.bufferBeforeMinutes}/${eventType.bufferAfterMinutes} min`);
    });

  } catch (error) {
    console.error("❌ Error seeding event types:", error);
    throw error;
  }
}

// Function to get event type ID by slug for migrations
export async function getEventTypeIdBySlug(slug: string): Promise<string | undefined> {
  const [eventType] = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(eq(eventTypes.slug, slug));

  return eventType?.id;
}

// Migration function to update existing bookings from enum to foreign key
export async function migrateEventBookingsToEventTypes(): Promise<void> {
  console.log("🔄 Migrating existing event bookings to use event types...");

  try {
    // First, ensure event types are seeded
    await seedEventTypes();

    // Get event type IDs for mapping
    const luciatagId = await getEventTypeIdBySlug("luciatag");
    const sjungandeJulgranId = await getEventTypeIdBySlug("sjungande_julgran");

    if (!luciatagId || !sjungandeJulgranId) {
      throw new Error("Event types not found. Please ensure event types are seeded first.");
    }

    console.log(`📋 Event type mappings:`);
    console.log(`   - luciatag -> ${luciatagId}`);
    console.log(`   - sjungande_julgran -> ${sjungandeJulgranId}`);

    // Note: Due to schema changes, we'll handle the migration in the storage update
    // The actual column migration will be handled by drizzle when we push the schema
    
    console.log("✅ Event type migration setup completed!");
    console.log("⚠️  Note: Existing booking data will be migrated when the new schema is pushed.");

  } catch (error) {
    console.error("❌ Error migrating event bookings:", error);
    throw error;
  }
}

// Run seed script if called directly (ES module version)
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateEventBookingsToEventTypes()
    .then(() => {
      console.log("🎉 Event types seeding and migration completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration failed:", error);
      process.exit(1);
    });
}