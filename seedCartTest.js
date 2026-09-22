/**
 * Seed Data để test Search/Filter Cart trên Mobile
 *
 * Chạy: node seedCartTest.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Models
const User = require("./models/User");
const Category = require("./models/Category");
const Product = require("./models/Product");
const ProductUnit = require("./models/ProductUnit");
const Unit = require("./models/Unit");
const CartItem = require("./models/CartItem");

async function seedCartTest() {
  try {
    console.log("🔌 Đang kết nối MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Đã kết nối MongoDB!\n");

    // ==================== 1. TÌM USER ====================
    console.log("👤 Tìm user...");
    const testUser = await User.findOne({
      email: "test.customer@smart.com",
    });

    if (!testUser) {
      console.error("   ❌ Không tìm thấy user: test.customer@smart.com");
      process.exit(1);
    }
    console.log("   ✅ Đã tìm thấy user: test.customer@smart.com");

    // ==================== 2. TẠO UNITS ====================
    console.log("\n📏 Tạo đơn vị tính...");
    const unitsData = [
      { name: "Kilogram", abbreviation: "kg" },
      { name: "Gói", abbreviation: "gói" },
      { name: "Hộp", abbreviation: "hộp" },
      { name: "Chai", abbreviation: "chai" },
    ];

    const units = {};
    for (const u of unitsData) {
      let unit = await Unit.findOne({ abbreviation: u.abbreviation });
      if (!unit) {
        unit = await Unit.create(u);
      }
      units[u.abbreviation] = unit;
    }
    console.log("   ✅ Đã tạo/kiểm tra đơn vị tính");

    // ==================== 3. TẠO CATEGORIES ====================
    console.log("\n📁 Tạo danh mục...");
    const categoriesData = [
      { name: "Rau củ quả", description: "Rau củ tươi sạch" },
      { name: "Thịt - Cá", description: "Thịt tươi, cá tươi" },
      { name: "Sữa - Đồ uống", description: "Sữa và đồ uống các loại" },
      { name: "Bánh kẹo", description: "Bánh kẹo nhập khẩu" },
    ];

    const categories = {};
    for (const c of categoriesData) {
      let cat = await Category.findOne({ name: c.name });
      if (!cat) {
        cat = await Category.create({ ...c, is_active: true });
      }
      categories[c.name] = cat;
    }
    console.log("   ✅ Đã tạo/kiểm tra danh mục");

    // ==================== 4. TẠO PRODUCTS ====================
    console.log("\n📦 Tạo sản phẩm...");
    const productsData = [
      // Rau củ quả - keyword test: "rau", "cà"
      {
        name: "Cà chua",
        category: "Rau củ quả",
        price: 25000,
        unit: "kg",
        description: "Cà chua tươi ngon",
      },
      {
        name: "Cà rốt",
        category: "Rau củ quả",
        price: 18000,
        unit: "kg",
        description: "Cà rốt Đà Lạt",
      },
      {
        name: "Rau muống",
        category: "Rau củ quả",
        price: 12000,
        unit: "gói",
        description: "Rau muống sạch",
      },
      {
        name: "Bắp cải",
        category: "Rau củ quả",
        price: 15000,
        unit: "kg",
        description: "Bắp cải tươi",
      },

      // Thịt - Cá - keyword test: "thịt", "cá"
      {
        name: "Thịt ba chỉ",
        category: "Thịt - Cá",
        price: 145000,
        unit: "kg",
        description: "Thịt heo ba chỉ",
      },
      {
        name: "Thịt bò Úc",
        category: "Thịt - Cá",
        price: 280000,
        unit: "kg",
        description: "Thịt bò nhập khẩu",
      },
      {
        name: "Cá hồi phi lê",
        category: "Thịt - Cá",
        price: 350000,
        unit: "kg",
        description: "Cá hồi Na Uy",
      },

      // Sữa - Đồ uống - keyword test: "sữa", "nước"
      {
        name: "Sữa tươi TH",
        category: "Sữa - Đồ uống",
        price: 32000,
        unit: "hộp",
        description: "Sữa tươi 1L",
      },
      {
        name: "Sữa chua Vinamilk",
        category: "Sữa - Đồ uống",
        price: 28000,
        unit: "hộp",
        description: "Sữa chua 4 hộp",
      },
      {
        name: "Nước cam ép",
        category: "Sữa - Đồ uống",
        price: 45000,
        unit: "chai",
        description: "Nước cam 100%",
      },
      {
        name: "Coca Cola",
        category: "Sữa - Đồ uống",
        price: 12000,
        unit: "chai",
        description: "Nước ngọt có ga",
      },

      // Bánh kẹo - keyword test: "bánh", "kẹo"
      {
        name: "Bánh Oreo",
        category: "Bánh kẹo",
        price: 35000,
        unit: "gói",
        description: "Bánh quy Oreo",
      },
      {
        name: "Kẹo socola",
        category: "Bánh kẹo",
        price: 55000,
        unit: "hộp",
        description: "Kẹo socola Đức",
      },
    ];

    const productUnits = [];
    for (const p of productsData) {
      let product = await Product.findOne({ name: p.name });

      if (!product) {
        product = await Product.create({
          name: p.name,
          category_id: categories[p.category]._id,
          description: p.description,
          image_url: `https://picsum.photos/seed/${p.name}/400/400`,
          tax_percentage: 8,
          total_stock: 100,
          is_active: true,
        });
      }

      // Tạo ProductUnit
      let productUnit = await ProductUnit.findOne({
        product_id: product._id,
        unit_id: units[p.unit]._id,
      });

      if (!productUnit) {
        productUnit = await ProductUnit.create({
          product_id: product._id,
          unit_id: units[p.unit]._id,
          exchange_value: 1,
          price: p.price,
          barcode: `899${Date.now()}${Math.floor(Math.random() * 1000)}`,
          is_base_unit: true,
          is_active: true,
        });
      }

      productUnits.push(productUnit);
      console.log(`   ✅ ${p.name} - ${p.price.toLocaleString()}đ/${p.unit}`);
    }

    // ==================== 5. THÊM VÀO GIỎ HÀNG ====================
    console.log("\n🛒 Thêm sản phẩm vào giỏ hàng...");

    // Xóa giỏ hàng cũ
    await CartItem.deleteMany({ user_id: testUser._id });

    // Thêm 8 sản phẩm đa dạng vào giỏ
    const cartProducts = [
      { index: 0, quantity: 2 }, // Cà chua - 25000
      { index: 1, quantity: 1 }, // Cà rốt - 18000
      { index: 4, quantity: 1 }, // Thịt ba chỉ - 145000
      { index: 6, quantity: 1 }, // Cá hồi - 350000
      { index: 7, quantity: 3 }, // Sữa TH - 32000
      { index: 9, quantity: 2 }, // Nước cam - 45000
      { index: 11, quantity: 1 }, // Bánh Oreo - 35000
      { index: 12, quantity: 1 }, // Kẹo socola - 55000
    ];

    let totalAmount = 0;
    for (const cp of cartProducts) {
      const pu = productUnits[cp.index];
      if (pu) {
        await CartItem.create({
          user_id: testUser._id,
          product_unit_id: pu._id,
          quantity: cp.quantity,
        });
        const itemTotal = pu.price * cp.quantity;
        totalAmount += itemTotal;

        const product = await Product.findById(pu.product_id);
        console.log(
          `   ➕ ${product.name} x${cp.quantity} = ${itemTotal.toLocaleString()}đ`,
        );
      }
    }

    // ==================== 6. HIỂN THỊ THÔNG TIN TEST ====================
    console.log("\n" + "=".repeat(60));
    console.log("✅ SEED DATA HOÀN TẤT - SẴN SÀNG TEST TRÊN MOBILE");
    console.log("=".repeat(60));

    console.log("\n📱 ĐĂNG NHẬP MOBILE APP:");
    console.log("   Email: test.customer@smart.com");

    console.log("\n🛒 GIỎ HÀNG ĐÃ CÓ:");
    console.log(`   - ${cartProducts.length} sản phẩm`);
    console.log(`   - Tổng tiền: ${totalAmount.toLocaleString()}đ`);

    console.log("\n🔍 TEST SEARCH/FILTER:");
    console.log("   Keyword để test:");
    console.log('     - "cà" → Cà chua, Cà rốt');
    console.log('     - "sữa" → Sữa tươi, Sữa chua');
    console.log('     - "thịt" → Thịt ba chỉ');
    console.log("   Lọc giá:");
    console.log("     - 10,000 - 50,000 → Rau, sữa, nước ngọt");
    console.log("     - 100,000 - 500,000 → Thịt, cá");
    console.log("   Lọc danh mục:");
    console.log("     - Rau củ quả");
    console.log("     - Sữa - Đồ uống");

    console.log("\n🔗 API ENDPOINT:");
    console.log("   GET /api/v1/customer/orders/cart/search");
    console.log(
      "   Query: ?search=sua&min_price=10000&max_price=50000&sort_by=price-asc",
    );

    console.log("\n" + "=".repeat(60));

    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    process.exit(1);
  }
}

seedCartTest();
