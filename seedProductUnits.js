require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");
const Unit = require("./models/Unit");
const ProductUnit = require("./models/ProductUnit");

const seedProductUnits = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/SMart",
    );
    console.log("✅ Connected to MongoDB");

    // Clear existing product units
    await ProductUnit.deleteMany({});
    console.log("🗑️  Cleared existing product units");

    // Get all products and units
    const products = await Product.find();
    const units = await Unit.find();

    // Find common units
    const chaiUnit = units.find((u) => u.name === "Chai");
    const lonUnit = units.find((u) => u.name === "Lon");
    const kgUnit = units.find((u) => u.name === "Kg");
    const hopUnit = units.find((u) => u.name === "Hộp");
    const goiUnit = units.find((u) => u.name === "Gói");
    const vienUnit = units.find((u) => u.name === "Cái");
    const bichUnit = units.find((u) => u.name === "Bịch");
    const locUnit = units.find((u) => u.name === "Lốc");

    const productUnitsData = [];

    // Coca Cola
    const cocaCola = products.find((p) => p.name === "Coca Cola");
    if (cocaCola && chaiUnit && lonUnit && locUnit) {
      productUnitsData.push(
        {
          product_id: cocaCola._id,
          unit_id: lonUnit._id,
          unit_value: 1,
          price: 12000,
          barcode: "5449000000996",
          is_base_unit: true,
          is_active: true,
        },
        {
          product_id: cocaCola._id,
          unit_id: chaiUnit._id,
          unit_value: 1,
          price: 10000,
          barcode: "5449000054227",
          is_base_unit: false,
          is_active: true,
        },
        {
          product_id: cocaCola._id,
          unit_id: locUnit._id,
          unit_value: 6,
          price: 65000,
          barcode: "5449000111715",
          is_base_unit: false,
          is_active: true,
        },
      );
    }

    // Pepsi
    const pepsi = products.find((p) => p.name === "Pepsi");
    if (pepsi && lonUnit && chaiUnit && locUnit) {
      productUnitsData.push(
        {
          product_id: pepsi._id,
          unit_id: lonUnit._id,
          unit_value: 1,
          price: 11000,
          barcode: "8934588013232",
          is_base_unit: true,
          is_active: true,
        },
        {
          product_id: pepsi._id,
          unit_id: chaiUnit._id,
          unit_value: 1,
          price: 9000,
          barcode: "8934588013249",
          is_base_unit: false,
          is_active: true,
        },
        {
          product_id: pepsi._id,
          unit_id: locUnit._id,
          unit_value: 6,
          price: 60000,
          barcode: "8934588013256",
          is_base_unit: false,
          is_active: true,
        },
      );
    }

    // Cà chua bi
    const caChua = products.find((p) => p.name === "Cà chua bi");
    if (caChua && kgUnit) {
      productUnitsData.push({
        product_id: caChua._id,
        unit_id: kgUnit._id,
        unit_value: 1,
        price: 35000,
        barcode: "2000000000001",
        is_base_unit: true,
        is_active: true,
      });
    }

    // Mì Hảo Hảo
    const miHaoHao = products.find((p) => p.name === "Mì Hảo Hảo");
    if (miHaoHao && goiUnit && bichUnit) {
      productUnitsData.push(
        {
          product_id: miHaoHao._id,
          unit_id: goiUnit._id,
          unit_value: 1,
          price: 3500,
          barcode: "8934563882594",
          is_base_unit: true,
          is_active: true,
        },
        {
          product_id: miHaoHao._id,
          unit_id: bichUnit._id,
          unit_value: 30,
          price: 95000,
          barcode: "8934563882600",
          is_base_unit: false,
          is_active: true,
        },
      );
    }

    // Sữa tươi Vinamilk
    const sua = products.find((p) => p.name === "Sữa tươi Vinamilk");
    if (sua && hopUnit && locUnit) {
      productUnitsData.push(
        {
          product_id: sua._id,
          unit_id: hopUnit._id,
          unit_value: 1,
          price: 8000,
          barcode: "8934673132596",
          is_base_unit: true,
          is_active: true,
        },
        {
          product_id: sua._id,
          unit_id: locUnit._id,
          unit_value: 4,
          price: 30000,
          barcode: "8934673132602",
          is_base_unit: false,
          is_active: true,
        },
      );
    }

    // Bánh mì sandwich
    const banhMi = products.find((p) => p.name === "Bánh mì sandwich");
    if (banhMi && goiUnit) {
      productUnitsData.push({
        product_id: banhMi._id,
        unit_id: goiUnit._id,
        unit_value: 1,
        price: 25000,
        barcode: "8934680020206",
        is_base_unit: true,
        is_active: true,
      });
    }

    // Trứng gà
    const trung = products.find((p) => p.name === "Trứng gà");
    if (trung && vienUnit && bichUnit) {
      productUnitsData.push(
        {
          product_id: trung._id,
          unit_id: vienUnit._id,
          unit_value: 1,
          price: 4000,
          barcode: "2000000000018",
          is_base_unit: true,
          is_active: true,
        },
        {
          product_id: trung._id,
          unit_id: bichUnit._id,
          unit_value: 10,
          price: 38000,
          barcode: "2000000000025",
          is_base_unit: false,
          is_active: true,
        },
      );
    }

    // Nước suối Lavie
    const nuoc = products.find((p) => p.name === "Nước suối Lavie");
    if (nuoc && chaiUnit && locUnit) {
      productUnitsData.push(
        {
          product_id: nuoc._id,
          unit_id: chaiUnit._id,
          unit_value: 1,
          price: 5000,
          barcode: "8934588013263",
          is_base_unit: true,
          is_active: true,
        },
        {
          product_id: nuoc._id,
          unit_id: locUnit._id,
          unit_value: 6,
          price: 27000,
          barcode: "8934588013270",
          is_base_unit: false,
          is_active: true,
        },
      );
    }

    // Insert product units
    const createdUnits = await ProductUnit.insertMany(productUnitsData);
    console.log(`✅ Seeded ${createdUnits.length} product units`);

    // Update product total_stock
    for (const product of products) {
      const productUnits = createdUnits.filter(
        (pu) => pu.product_id.toString() === product._id.toString(),
      );
      if (productUnits.length > 0) {
        // Set random stock for demo
        product.total_stock = Math.floor(Math.random() * 100) + 50;
        await product.save();
      }
    }
    console.log("✅ Updated product stock");

    console.log("\n📋 Product Units Summary:");
    for (const product of products) {
      const units = createdUnits.filter(
        (pu) => pu.product_id.toString() === product._id.toString(),
      );
      if (units.length > 0) {
        console.log(`\n${product.name} (Stock: ${product.total_stock}):`);
        for (const unit of units) {
          const unitInfo = await Unit.findById(unit.unit_id);
          console.log(
            `   - ${unitInfo.name}: ${unit.price.toLocaleString("vi-VN")}đ (${unit.barcode})`,
          );
        }
      }
    }

    console.log("\n✨ Seed product units completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding product units:", error);
    process.exit(1);
  }
};

seedProductUnits();
