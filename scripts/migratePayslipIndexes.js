require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Payslip = require("../models/Payslip");

async function migratePayslipIndexes() {
  try {
    await connectDB();

    const indexes = await Payslip.collection.indexes();

    const legacyIndex = indexes.find(
      (idx) =>
        idx.unique === true &&
        idx.key &&
        idx.key.user_id === 1 &&
        idx.key.month === 1 &&
        idx.key.year === 1,
    );

    if (legacyIndex) {
      await Payslip.collection.dropIndex(legacyIndex.name);
      console.log(`Dropped legacy unique index: ${legacyIndex.name}`);
    } else {
      console.log("Legacy unique index not found, skip drop.");
    }

    const hasUserPeriodIndex = indexes.some(
      (idx) =>
        idx.key &&
        idx.key.user_id === 1 &&
        idx.key.period_start_date === 1 &&
        idx.key.period_end_date === 1,
    );
    if (hasUserPeriodIndex) {
      console.log("User-period unique index already exists, skip create.");
    } else {
      await Payslip.collection.createIndex(
        { user_id: 1, period_start_date: 1, period_end_date: 1 },
        { unique: true, name: "user_period_unique" },
      );
      console.log("Ensured unique index: user_period_unique");
    }

    const hasMonthYearUserIndex = indexes.some(
      (idx) =>
        idx.key &&
        idx.key.month === 1 &&
        idx.key.year === 1 &&
        idx.key.user_id === 1,
    );
    if (hasMonthYearUserIndex) {
      console.log("Month-year-user index already exists, skip create.");
    } else {
      await Payslip.collection.createIndex(
        { month: 1, year: 1, user_id: 1 },
        { name: "month_year_user_idx" },
      );
      console.log("Ensured index: month_year_user_idx");
    }

    console.log("Payslip index migration completed.");
    process.exit(0);
  } catch (error) {
    console.error("Payslip index migration failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

migratePayslipIndexes();
