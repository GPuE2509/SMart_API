require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");
const Unit = require("./models/Unit");

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/SMart",
    );
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await Product.deleteMany({});
    await Unit.deleteMany({});
    console.log("🗑️  Cleared existing data");

    // Seed Units
    const units = await Unit.insertMany([
      { name: "Chai" },
      { name: "Lon" },
      { name: "Lốc" },
      { name: "Thùng" },
      { name: "Kg" },
      { name: "Gram" },
      { name: "Hộp" },
      { name: "Gói" },
      { name: "Cái" },
      { name: "Bịch" },
    ]);
    console.log(`✅ Seeded ${units.length} units`);

    // Seed Products
    const products = await Product.insertMany([
      {
        name: "Coca Cola",
        description: "Nước ngọt có ga Coca Cola",
        image_url:
          "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=150",
        tax_percentage: 10,
        total_stock: 0,
        is_active: true,
      },
      {
        name: "Pepsi",
        description: "Nước ngọt có ga Pepsi",
        image_url:
          "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=150",
        tax_percentage: 10,
        total_stock: 0,
        is_active: true,
      },
      {
        name: "Cà chua bi",
        description: "Cà chua bi tươi",
        image_url:
          "https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=150",
        tax_percentage: 5,
        total_stock: 0,
        is_active: true,
      },
      {
        name: "Mì Hảo Hảo",
        description: "Mì gói Hảo Hảo các vị",
        image_url:
          "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=150",
        tax_percentage: 8,
        total_stock: 0,
        is_active: true,
      },
      {
        name: "Sữa tươi Vinamilk",
        description: "Sữa tươi không đường",
        image_url:
          "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=150",
        tax_percentage: 5,
        total_stock: 0,
        is_active: true,
      },
      {
        name: "Bánh mì sandwich",
        description: "Bánh mì gối sandwich",
        image_url:
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=150",
        tax_percentage: 5,
        total_stock: 0,
        is_active: true,
      },
      {
        name: "Trứng gà",
        description: "Trứng gà tươi",
        image_url:
          "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=150",
        tax_percentage: 0,
        total_stock: 0,
        is_active: true,
      },
      {
        name: "Nước suối Lavie",
        description: "Nước khoáng Lavie",
        image_url:
          "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=150",
        tax_percentage: 10,
        total_stock: 0,
        is_active: true,
      },
    ]);
    console.log(`✅ Seeded ${products.length} products`);

    console.log("\n📋 Products Created:");
    products.forEach((p) => {
      console.log(`   - ${p.name} (ID: ${p._id})`);
    });

    console.log("\n📋 Units Created:");
    units.forEach((u) => {
      console.log(`   - ${u.name} (ID: ${u._id})`);
    });

    console.log("\n✨ Seed data completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
