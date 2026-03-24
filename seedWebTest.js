/**
 * Seed Data để test Sales Report & Recipe Management trên Web
 *
 * Chạy: node seedWebTest.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Models
const User = require("./models/User");
const Category = require("./models/Category");
const Product = require("./models/Product");
const ProductUnit = require("./models/ProductUnit");
const Unit = require("./models/Unit");
const Order = require("./models/Order");
const OrderDetail = require("./models/OrderDetail");
const Recipe = require("./models/Recipe");
const RecipeIngredient = require("./models/RecipeIngredient");

// Generate random number in range
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Generate random date in past days
const randomDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysAgo));
  date.setHours(randomInt(6, 22)); // Store hours from 6 AM to 10 PM
  date.setMinutes(randomInt(0, 59));
  return date;
};

// Generate unique order code
const generateOrderCode = (index) => {
  const date = new Date();
  return `ORD${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(index).padStart(5, "0")}`;
};

async function seedWebTest() {
  try {
    console.log("🔌 Đang kết nối MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Đã kết nối MongoDB!\n");

    // ==================== 1. TÌM HOẶC TẠO USERS ====================
    console.log("👤 Tìm/tạo users...");

    let admin = await User.findOne({ role: "admin" });
    if (!admin) {
      admin = await User.create({
        username: "Admin",
        email: "admin@smart.com",
        password: "$2a$10$somehashedpassword",
        role: "admin",
        is_active: true,
        is_verified: true,
      });
    }
    console.log("   ✅ Admin:", admin.email);

    let customer = await User.findOne({ role: "customer" });
    if (!customer) {
      customer = await User.create({
        username: "Customer Test",
        email: "customer@test.com",
        password: "$2a$10$somehashedpassword",
        role: "customer",
        is_active: true,
        is_verified: true,
      });
    }
    console.log("   ✅ Customer:", customer.email);

    // ==================== 2. TẠO UNITS ====================
    console.log("\n📏 Tạo đơn vị tính...");
    const unitsData = [
      { name: "Kilogram", abbreviation: "kg" },
      { name: "Gói", abbreviation: "gói" },
      { name: "Hộp", abbreviation: "hộp" },
      { name: "Chai", abbreviation: "chai" },
      { name: "Lon", abbreviation: "lon" },
      { name: "Cái", abbreviation: "cái" },
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
      { name: "Gia vị", description: "Gia vị nấu ăn" },
      { name: "Mì - Gạo", description: "Mì gói, gạo các loại" },
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
      // Rau củ
      {
        name: "Cà chua",
        category: "Rau củ quả",
        price: 25000,
        importPrice: 18000,
        unit: "kg",
      },
      {
        name: "Cà rốt",
        category: "Rau củ quả",
        price: 18000,
        importPrice: 12000,
        unit: "kg",
      },
      {
        name: "Rau muống",
        category: "Rau củ quả",
        price: 12000,
        importPrice: 8000,
        unit: "gói",
      },
      {
        name: "Khoai tây",
        category: "Rau củ quả",
        price: 22000,
        importPrice: 15000,
        unit: "kg",
      },
      {
        name: "Hành tây",
        category: "Rau củ quả",
        price: 20000,
        importPrice: 14000,
        unit: "kg",
      },

      // Thịt - Cá
      {
        name: "Thịt ba chỉ",
        category: "Thịt - Cá",
        price: 145000,
        importPrice: 110000,
        unit: "kg",
      },
      {
        name: "Thịt bò Úc",
        category: "Thịt - Cá",
        price: 280000,
        importPrice: 220000,
        unit: "kg",
      },
      {
        name: "Cá hồi phi lê",
        category: "Thịt - Cá",
        price: 350000,
        importPrice: 280000,
        unit: "kg",
      },
      {
        name: "Gà ta nguyên con",
        category: "Thịt - Cá",
        price: 120000,
        importPrice: 90000,
        unit: "kg",
      },
      {
        name: "Tôm sú",
        category: "Thịt - Cá",
        price: 250000,
        importPrice: 200000,
        unit: "kg",
      },

      // Sữa - Đồ uống
      {
        name: "Sữa tươi TH True Milk",
        category: "Sữa - Đồ uống",
        price: 32000,
        importPrice: 25000,
        unit: "hộp",
      },
      {
        name: "Sữa chua Vinamilk",
        category: "Sữa - Đồ uống",
        price: 28000,
        importPrice: 22000,
        unit: "hộp",
      },
      {
        name: "Nước cam ép Tropicana",
        category: "Sữa - Đồ uống",
        price: 45000,
        importPrice: 36000,
        unit: "chai",
      },
      {
        name: "Coca Cola",
        category: "Sữa - Đồ uống",
        price: 12000,
        importPrice: 9000,
        unit: "lon",
      },
      {
        name: "Pepsi",
        category: "Sữa - Đồ uống",
        price: 11000,
        importPrice: 8500,
        unit: "lon",
      },

      // Bánh kẹo
      {
        name: "Bánh Oreo",
        category: "Bánh kẹo",
        price: 35000,
        importPrice: 28000,
        unit: "gói",
      },
      {
        name: "Kẹo socola Ferrero",
        category: "Bánh kẹo",
        price: 120000,
        importPrice: 95000,
        unit: "hộp",
      },
      {
        name: "Bánh quy Cosy",
        category: "Bánh kẹo",
        price: 25000,
        importPrice: 19000,
        unit: "hộp",
      },

      // Gia vị
      {
        name: "Nước mắm Nam Ngư",
        category: "Gia vị",
        price: 28000,
        importPrice: 22000,
        unit: "chai",
      },
      {
        name: "Dầu ăn Tường An",
        category: "Gia vị",
        price: 52000,
        importPrice: 42000,
        unit: "chai",
      },

      // Mì - Gạo
      {
        name: "Mì Hảo Hảo",
        category: "Mì - Gạo",
        price: 4500,
        importPrice: 3500,
        unit: "gói",
      },
      {
        name: "Gạo ST25",
        category: "Mì - Gạo",
        price: 28000,
        importPrice: 22000,
        unit: "kg",
      },
    ];

    const productUnits = [];
    const productMap = {};

    for (const p of productsData) {
      let product = await Product.findOne({ name: p.name });

      if (!product) {
        product = await Product.create({
          name: p.name,
          category_id: categories[p.category]._id,
          description: `${p.name} chất lượng cao`,
          image_url: `https://picsum.photos/seed/${encodeURIComponent(p.name)}/400/400`,
          tax_percentage: 8,
          total_stock: 500,
          is_active: true,
        });
      }
      productMap[p.name] = product;

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
          barcode: `899${Date.now()}${Math.floor(Math.random() * 10000)}`,
          is_base_unit: true,
          is_active: true,
        });
      }

      productUnits.push({
        ...productUnit.toObject(),
        importPrice: p.importPrice,
        productName: p.name,
      });
    }
    console.log(`   ✅ Đã tạo ${productUnits.length} sản phẩm`);

    // ==================== 5. TẠO ORDERS (cho Sales Report) ====================
    console.log("\n🛒 Tạo đơn hàng mẫu (30 ngày qua)...");

    // Xóa orders test cũ
    const existingTestOrders = await Order.find({ order_code: /^ORD202/ });
    if (existingTestOrders.length > 0) {
      const orderIds = existingTestOrders.map((o) => o._id);
      await OrderDetail.deleteMany({ order_id: { $in: orderIds } });
      await Order.deleteMany({ _id: { $in: orderIds } });
      console.log(`   ⚠️ Đã xóa ${existingTestOrders.length} đơn hàng test cũ`);
    }

    const NUM_ORDERS = 150; // 150 đơn hàng trong 30 ngày
    let totalRevenue = 0;
    let totalProfit = 0;

    for (let i = 1; i <= NUM_ORDERS; i++) {
      const orderDate = randomDate(30);
      const numItems = randomInt(1, 5);

      let orderTotal = 0;
      let orderProfit = 0;
      const orderDetails = [];

      // Select random products for this order
      const selectedProducts = [...productUnits]
        .sort(() => Math.random() - 0.5)
        .slice(0, numItems);

      for (const pu of selectedProducts) {
        const quantity = randomInt(1, 5);
        const unitPrice = pu.price;
        const totalPrice = unitPrice * quantity;
        const profit = (unitPrice - pu.importPrice) * quantity;

        orderTotal += totalPrice;
        orderProfit += profit;

        orderDetails.push({
          product_unit_id: pu._id,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
        });
      }

      const taxAmount = Math.round(orderTotal * 0.08);
      const finalAmount = orderTotal + taxAmount;

      // Create order
      const order = await Order.create({
        order_code: generateOrderCode(i),
        user_id: customer._id,
        total_amount: orderTotal,
        discount_amount: 0,
        tax_amount: taxAmount,
        final_amount: finalAmount,
        payment_method: ["cash", "payos", "card"][randomInt(0, 2)],
        payment_status: "paid",
        order_status: "completed",
        order_type: ["online", "pos"][randomInt(0, 1)],
        created_at: orderDate,
      });

      // Create order details
      for (const detail of orderDetails) {
        await OrderDetail.create({
          order_id: order._id,
          ...detail,
        });
      }

      totalRevenue += finalAmount;
      totalProfit += orderProfit;

      if (i % 30 === 0) {
        console.log(`   📝 Đã tạo ${i}/${NUM_ORDERS} đơn hàng...`);
      }
    }

    console.log(`   ✅ Đã tạo ${NUM_ORDERS} đơn hàng`);
    console.log(`   💰 Tổng doanh thu: ${totalRevenue.toLocaleString()}đ`);
    console.log(`   📈 Tổng lợi nhuận: ${totalProfit.toLocaleString()}đ`);

    // ==================== 6. TẠO RECIPES ====================
    console.log("\n📖 Tạo công thức nấu ăn...");

    // Xóa recipes cũ
    await RecipeIngredient.deleteMany({});
    await Recipe.deleteMany({});

    const recipesData = [
      {
        title: "Canh cà chua trứng",
        description: "Món canh thanh mát, dễ nấu, phù hợp cho bữa cơm gia đình",
        image_url: "https://picsum.photos/seed/canh-ca-chua/600/400",
        instruction: `Bước 1: Rửa sạch cà chua, cắt múi cau
Bước 2: Đun sôi nước dùng, cho cà chua vào nấu mềm
Bước 3: Đập trứng vào bát, khuấy đều
Bước 4: Cho trứng vào nồi canh, khuấy nhẹ
Bước 5: Nêm gia vị, rắc hành lá và tắt bếp`,
        ingredients: [
          { productName: "Cà chua", quantity: 3, unit: "quả" },
          { productName: "Hành tây", quantity: 0.5, unit: "củ" },
        ],
      },
      {
        title: "Thịt kho tàu",
        description: "Món thịt kho truyền thống, đậm đà hương vị Việt Nam",
        image_url: "https://picsum.photos/seed/thit-kho-tau/600/400",
        instruction: `Bước 1: Cắt thịt ba chỉ thành miếng vuông 4cm
Bước 2: Ướp thịt với nước mắm, đường, tỏi 30 phút
Bước 3: Thắng nước màu với đường
Bước 4: Cho thịt vào đảo đều, thêm nước dừa
Bước 5: Kho liu riu 45 phút đến khi thịt mềm, nước sệt lại`,
        ingredients: [
          { productName: "Thịt ba chỉ", quantity: 500, unit: "g" },
          { productName: "Nước mắm Nam Ngư", quantity: 3, unit: "thìa" },
        ],
      },
      {
        title: "Gà kho gừng",
        description: "Món gà thơm lừng, cay nhẹ từ gừng tươi",
        image_url: "https://picsum.photos/seed/ga-kho-gung/600/400",
        instruction: `Bước 1: Chặt gà thành miếng vừa ăn, rửa sạch
Bước 2: Gừng đập dập, băm nhỏ
Bước 3: Phi thơm gừng với dầu ăn
Bước 4: Cho gà vào đảo săn, thêm nước mắm, đường
Bước 5: Kho nhỏ lửa 30 phút, thêm tiêu và tắt bếp`,
        ingredients: [
          { productName: "Gà ta nguyên con", quantity: 1, unit: "kg" },
          { productName: "Dầu ăn Tường An", quantity: 2, unit: "thìa" },
          { productName: "Nước mắm Nam Ngư", quantity: 2, unit: "thìa" },
        ],
      },
      {
        title: "Cá hồi áp chảo",
        description: "Món cá hồi healthy, giữ nguyên dưỡng chất",
        image_url: "https://picsum.photos/seed/ca-hoi-ap-chao/600/400",
        instruction: `Bước 1: Cá hồi rửa sạch, thấm khô, ướp muối tiêu
Bước 2: Đun nóng chảo với ít dầu olive
Bước 3: Áp chảo cá hồi mỗi mặt 3-4 phút
Bước 4: Cá chín vàng đều, rắc chanh lên trên
Bước 5: Trang trí với rau mầm và thưởng thức`,
        ingredients: [
          { productName: "Cá hồi phi lê", quantity: 200, unit: "g" },
        ],
      },
      {
        title: "Canh khoai tây thịt bằm",
        description: "Canh bổ dưỡng, thơm ngọt tự nhiên",
        image_url: "https://picsum.photos/seed/canh-khoai-tay/600/400",
        instruction: `Bước 1: Khoai tây gọt vỏ, cắt hạt lựu
Bước 2: Thịt băm xào sơ với hành tỏi
Bước 3: Đổ nước vào, cho khoai tây nấu chín
Bước 4: Nêm gia vị vừa ăn
Bước 5: Rắc hành lá và dọn ra bàn`,
        ingredients: [
          { productName: "Khoai tây", quantity: 300, unit: "g" },
          { productName: "Thịt ba chỉ", quantity: 150, unit: "g" },
          { productName: "Hành tây", quantity: 0.5, unit: "củ" },
        ],
      },
      {
        title: "Mì xào hải sản",
        description: "Mì xào với tôm, mực thơm ngon hấp dẫn",
        image_url: "https://picsum.photos/seed/mi-xao-hai-san/600/400",
        instruction: `Bước 1: Trần mì qua nước sôi, để ráo
Bước 2: Tôm bóc vỏ, rửa sạch với muối
Bước 3: Xào tôm với tỏi, thêm rau củ
Bước 4: Cho mì vào, thêm nước tương, dầu hào
Bước 5: Đảo đều, trang trí và dọn ra`,
        ingredients: [
          { productName: "Mì Hảo Hảo", quantity: 3, unit: "gói" },
          { productName: "Tôm sú", quantity: 200, unit: "g" },
          { productName: "Cà rốt", quantity: 1, unit: "củ" },
        ],
      },
    ];

    for (const r of recipesData) {
      const recipe = await Recipe.create({
        title: r.title,
        description: r.description,
        instruction: r.instruction,
        image_url: r.image_url,
      });

      // Add ingredients
      for (const ing of r.ingredients) {
        const product = productMap[ing.productName];
        if (product) {
          await RecipeIngredient.create({
            recipe_id: recipe._id,
            product_id: product._id,
            quantity_needed: ing.quantity,
            unit_note: ing.unit,
          });
        }
      }

      console.log(`   ✅ ${r.title} (${r.ingredients.length} nguyên liệu)`);
    }

    // ==================== 7. HIỂN THỊ THÔNG TIN TEST ====================
    console.log("\n" + "=".repeat(60));
    console.log("✅ SEED DATA HOÀN TẤT - SẴN SÀNG TEST TRÊN WEB");
    console.log("=".repeat(60));

    console.log("\n🌐 ĐĂNG NHẬP WEB ADMIN:");
    console.log("   URL: http://localhost:5173");
    console.log(`   Email: ${admin.email}`);

    console.log("\n📊 SALES REPORT DATA:");
    console.log(`   - ${NUM_ORDERS} đơn hàng trong 30 ngày qua`);
    console.log(`   - ${productUnits.length} sản phẩm`);
    console.log(`   - Doanh thu: ${totalRevenue.toLocaleString()}đ`);
    console.log(`   - Lợi nhuận: ${totalProfit.toLocaleString()}đ`);

    console.log("\n📖 RECIPE DATA:");
    console.log(`   - ${recipesData.length} công thức nấu ăn`);

    console.log("\n🔗 TEST PAGES:");
    console.log("   - /admin/reports → Xem báo cáo doanh thu");
    console.log("   - /admin/recipes → Quản lý công thức");

    console.log("\n" + "=".repeat(60));

    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    process.exit(1);
  }
}

seedWebTest();
