import { db } from "../db";
import { workflowStatuses, type InsertWorkflowStatus } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Default Swedish workflow statuses matching the previous enum values
export const defaultWorkflowStatuses: InsertWorkflowStatus[] = [
  {
    slug: "pending",
    name: "Nya förfrågningar",
    displayOrder: 1,
    color: "yellow",
    isDefault: true,
    isFinal: false,
    isActive: true,
  },
  {
    slug: "reviewing", 
    name: "Under granskning",
    displayOrder: 2,
    color: "blue",
    isDefault: false,
    isFinal: false,
    isActive: true,
  },
  {
    slug: "approved",
    name: "Godkänt", 
    displayOrder: 3,
    color: "green",
    isDefault: false,
    isFinal: false,
    isActive: true,
  },
  {
    slug: "completed",
    name: "Slutfört",
    displayOrder: 4, 
    color: "gray",
    isDefault: false,
    isFinal: true,
    isActive: true,
  },
];

export async function seedWorkflowStatuses(): Promise<void> {
  console.log("🌱 Seeding workflow statuses...");

  try {
    // Check if statuses already exist
    const existingStatuses = await db.select().from(workflowStatuses);
    
    if (existingStatuses.length > 0) {
      console.log(`ℹ️  Workflow statuses already exist (${existingStatuses.length} found), skipping seed.`);
      return;
    }

    // Insert default statuses with generated IDs
    const statusesWithIds = defaultWorkflowStatuses.map(status => ({
      ...status,
      id: randomUUID(),
    }));

    await db.insert(workflowStatuses).values(statusesWithIds);

    console.log(`✅ Successfully seeded ${statusesWithIds.length} workflow statuses:`);
    statusesWithIds.forEach(status => {
      console.log(`   - ${status.slug} (${status.name}) - Order: ${status.displayOrder}, Color: ${status.color}`);
    });

  } catch (error) {
    console.error("❌ Error seeding workflow statuses:", error);
    throw error;
  }
}

// Function to get the default status ID for new bookings
export async function getDefaultStatusId(): Promise<string> {
  const [defaultStatus] = await db
    .select({ id: workflowStatuses.id })
    .from(workflowStatuses)
    .where(eq(workflowStatuses.isDefault, true));

  if (!defaultStatus) {
    throw new Error("No default workflow status found. Please run the seed script first.");
  }

  return defaultStatus.id;
}

// Function to get status by slug for migrations/backwards compatibility
export async function getStatusIdBySlug(slug: string): Promise<string | undefined> {
  const [status] = await db
    .select({ id: workflowStatuses.id })
    .from(workflowStatuses)
    .where(eq(workflowStatuses.slug, slug));

  return status?.id;
}

// Run seed script if called directly (ES module version)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedWorkflowStatuses()
    .then(() => {
      console.log("🎉 Workflow statuses seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding failed:", error);
      process.exit(1);
    });
}