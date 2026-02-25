/**
 * Migration script: Move status from batch level to item level
 * Run this once to migrate existing data
 *
 * Command: node migrations/migrate-batch-status.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const ProductBatch = require("../models/ProductBatch");

const migrateData = async () => {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully!");

    console.log("\nFetching all batches...");
    const batches = await ProductBatch.find({});
    console.log(`Found ${batches.length} batches`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const batch of batches) {
      try {
        console.log(`\nProcessing batch: ${batch._id}`);

        // Determine date_status and status for items
        const now = new Date();

        batch.items = batch.items.map((item) => {
          // Calculate date_status based on expiry_date
          let date_status = "active";
          if (item.expiry_date) {
            const expiryDate = new Date(item.expiry_date);
            const daysUntilExpiry = Math.ceil(
              (expiryDate - now) / (1000 * 60 * 60 * 24),
            );

            if (daysUntilExpiry < 0) {
              date_status = "expired";
            } else if (daysUntilExpiry <= 30) {
              date_status = "near_expiry";
            }
          }

          // Set default status or preserve if already exists
          const status = item.status || "instock";

          return {
            ...item.toObject(),
            date_status: item.date_status || date_status,
            status: status,
          };
        });

        await batch.save();
        updatedCount++;
        console.log(`✓ Updated batch ${batch._id}`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error updating batch ${batch._id}:`, error.message);
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("Migration completed!");
    console.log(`Total batches: ${batches.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log("=".repeat(50));

    await mongoose.disconnect();
    console.log("\nDisconnected from database");
    process.exit(0);
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run migration
migrateData();
