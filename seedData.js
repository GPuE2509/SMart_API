/**
 * SEED DATA - Sample data for testing API
 *
 * Hướng dẫn sử dụng:
 * 1. Chạy script này để thêm dữ liệu mẫu vào MongoDB
 * 2. Hoặc import thủ công vào MongoDB Compass
 *
 * Lưu ý: File này chỉ để tham khảo, cần tạo script riêng để seed
 */

// ==================== UNITS ====================
const units = [
  {
    name: "Kilogram",
    abbreviation: "kg",
  },
  {
    name: "Gram",
    abbreviation: "g",
  },
  {
    name: "Lít",
    abbreviation: "L",
  },
  {
    name: "Chai",
    abbreviation: "chai",
  },
  {
    name: "Hộp",
    abbreviation: "hộp",
  },
  {
    name: "Gói",
    abbreviation: "gói",
  },
];

// ==================== CATEGORIES ====================
const categories = [
  {
    name: "Rau củ quả",
    description: "Rau củ quả tươi sạch, an toàn",
    image_url: "https://res.cloudinary.com/demo/vegetables.jpg",
    parent_id: null,
    is_active: true,
  },
  {
    name: "Thịt - Hải sản",
    description: "Thịt tươi, hải sản tươi sống",
    image_url: "https://res.cloudinary.com/demo/meat.jpg",
    parent_id: null,
    is_active: true,
  },
  {
    name: "Trái cây",
    description: "Trái cây tươi ngon, giàu vitamin",
    image_url: "https://res.cloudinary.com/demo/fruits.jpg",
    parent_id: null,
    is_active: true,
  },
  {
    name: "Sữa - Trứng",
    description: "Sữa tươi, trứng gà, trứng vịt",
    image_url: "https://res.cloudinary.com/demo/dairy.jpg",
    parent_id: null,
    is_active: true,
  },
  {
    name: "Đồ uống",
    description: "Nước ngọt, nước ép, trà",
    image_url: "https://res.cloudinary.com/demo/drinks.jpg",
    parent_id: null,
    is_active: true,
  },
];

// ==================== PRODUCTS ====================
const products = [
  // RAU CỦ QUẢ
  {
    name: "Cà chua",
    category_id: "RAU_CU_QUA_ID", // Thay bằng ID thực tế
    description: "Cà chua tươi, giàu vitamin C, tốt cho sức khỏe",
    image_url: "https://res.cloudinary.com/demo/tomato.jpg",
    tax_percentage: 8,
    total_stock: 100,
    is_active: true,
  },
  {
    name: "Cải bắp",
    category_id: "RAU_CU_QUA_ID",
    description: "Cải bắp tươi, giàu chất xơ",
    image_url: "https://res.cloudinary.com/demo/cabbage.jpg",
    tax_percentage: 8,
    total_stock: 80,
    is_active: true,
  },
  {
    name: "Khoai tây",
    category_id: "RAU_CU_QUA_ID",
    description: "Khoai tây sạch, giàu tinh bột",
    image_url: "https://res.cloudinary.com/demo/potato.jpg",
    tax_percentage: 8,
    total_stock: 120,
    is_active: true,
  },
  {
    name: "Cà rốt",
    category_id: "RAU_CU_QUA_ID",
    description: "Cà rốt tươi, giàu vitamin A",
    image_url: "https://res.cloudinary.com/demo/carrot.jpg",
    tax_percentage: 8,
    total_stock: 90,
    is_active: true,
  },
  {
    name: "Rau muống",
    category_id: "RAU_CU_QUA_ID",
    description: "Rau muống tươi, sạch",
    image_url: "https://res.cloudinary.com/demo/spinach.jpg",
    tax_percentage: 8,
    total_stock: 50,
    is_active: true,
  },

  // THỊT - HẢI SẢN
  {
    name: "Thịt ba chỉ",
    category_id: "THIT_HAI_SAN_ID",
    description: "Thịt ba chỉ tươi, thơm ngon",
    image_url: "https://res.cloudinary.com/demo/pork-belly.jpg",
    tax_percentage: 8,
    total_stock: 50,
    is_active: true,
  },
  {
    name: "Thịt bò Úc",
    category_id: "THIT_HAI_SAN_ID",
    description: "Thịt bò nhập khẩu Úc, cao cấp",
    image_url: "https://res.cloudinary.com/demo/beef.jpg",
    tax_percentage: 8,
    total_stock: 30,
    is_active: true,
  },
  {
    name: "Cá hồi",
    category_id: "THIT_HAI_SAN_ID",
    description: "Cá hồi Na Uy, giàu omega-3",
    image_url: "https://res.cloudinary.com/demo/salmon.jpg",
    tax_percentage: 8,
    total_stock: 25,
    is_active: true,
  },
  {
    name: "Tôm sú",
    category_id: "THIT_HAI_SAN_ID",
    description: "Tôm sú tươi sống, size lớn",
    image_url: "https://res.cloudinary.com/demo/shrimp.jpg",
    tax_percentage: 8,
    total_stock: 40,
    is_active: true,
  },

  // TRÁI CÂY
  {
    name: "Cam Úc",
    category_id: "TRAI_CAY_ID",
    description: "Cam Úc nhập khẩu, ngọt mát",
    image_url: "https://res.cloudinary.com/demo/orange.jpg",
    tax_percentage: 8,
    total_stock: 100,
    is_active: true,
  },
  {
    name: "Táo Fuji",
    category_id: "TRAI_CAY_ID",
    description: "Táo Fuji Nhật Bản, giòn ngọt",
    image_url: "https://res.cloudinary.com/demo/apple.jpg",
    tax_percentage: 8,
    total_stock: 80,
    is_active: true,
  },
  {
    name: "Chuối",
    category_id: "TRAI_CAY_ID",
    description: "Chuối sứ, thơm ngon bổ dưỡng",
    image_url: "https://res.cloudinary.com/demo/banana.jpg",
    tax_percentage: 8,
    total_stock: 150,
    is_active: true,
  },
  {
    name: "Dưa hấu",
    category_id: "TRAI_CAY_ID",
    description: "Dưa hấu ruột đỏ, ngọt mát",
    image_url: "https://res.cloudinary.com/demo/watermelon.jpg",
    tax_percentage: 8,
    total_stock: 60,
    is_active: true,
  },

  // SỮA - TRỨNG
  {
    name: "Sữa tươi TH True Milk",
    category_id: "SUA_TRUNG_ID",
    description: "Sữa tươi 100%, không đường",
    image_url: "https://res.cloudinary.com/demo/milk.jpg",
    tax_percentage: 8,
    total_stock: 200,
    is_active: true,
  },
  {
    name: "Trứng gà Đà Lạt",
    category_id: "SUA_TRUNG_ID",
    description: "Trứng gà sạch Đà Lạt, giàu dinh dưỡng",
    image_url: "https://res.cloudinary.com/demo/eggs.jpg",
    tax_percentage: 8,
    total_stock: 300,
    is_active: true,
  },
  {
    name: "Phô mai Con Bò Cười",
    category_id: "SUA_TRUNG_ID",
    description: "Phô mai lát, dinh dưỡng cho trẻ",
    image_url: "https://res.cloudinary.com/demo/cheese.jpg",
    tax_percentage: 8,
    total_stock: 150,
    is_active: true,
  },

  // ĐỒ UỐNG
  {
    name: "Coca Cola",
    category_id: "DO_UONG_ID",
    description: "Nước ngọt có ga Coca Cola",
    image_url: "https://res.cloudinary.com/demo/cola.jpg",
    tax_percentage: 8,
    total_stock: 500,
    is_active: true,
  },
  {
    name: "Nước cam ép Minute Maid",
    category_id: "DO_UONG_ID",
    description: "Nước cam ép 100% không đường",
    image_url: "https://res.cloudinary.com/demo/orange-juice.jpg",
    tax_percentage: 8,
    total_stock: 200,
    is_active: true,
  },
  {
    name: "Trà xanh 0 độ C-On",
    category_id: "DO_UONG_ID",
    description: "Trà xanh không độ, thanh mát",
    image_url: "https://res.cloudinary.com/demo/green-tea.jpg",
    tax_percentage: 8,
    total_stock: 300,
    is_active: true,
  },
];

// ==================== PRODUCT UNITS ====================
// Ví dụ cho sản phẩm "Cà chua"
const productUnits = [
  // Cà chua - kg (đơn vị cơ bản)
  {
    product_id: "CA_CHUA_ID",
    unit_id: "KG_UNIT_ID",
    exchange_value: 1,
    price: 25000,
    barcode: "8934567890123",
    is_base_unit: true,
    is_active: true,
  },
  // Cà chua - 500g
  {
    product_id: "CA_CHUA_ID",
    unit_id: "G_UNIT_ID",
    exchange_value: 0.5,
    price: 13000,
    barcode: "8934567890124",
    is_base_unit: false,
    is_active: true,
  },

  // Thịt ba chỉ - kg
  {
    product_id: "THIT_BA_CHI_ID",
    unit_id: "KG_UNIT_ID",
    exchange_value: 1,
    price: 150000,
    barcode: "8934567890125",
    is_base_unit: true,
    is_active: true,
  },

  // Cam Úc - kg
  {
    product_id: "CAM_UC_ID",
    unit_id: "KG_UNIT_ID",
    exchange_value: 1,
    price: 45000,
    barcode: "8934567890126",
    is_base_unit: true,
    is_active: true,
  },

  // Sữa TH - hộp 1L
  {
    product_id: "SUA_TH_ID",
    unit_id: "HOP_UNIT_ID",
    exchange_value: 1,
    price: 28000,
    barcode: "8934567890127",
    is_base_unit: true,
    is_active: true,
  },

  // Coca - chai
  {
    product_id: "COCA_ID",
    unit_id: "CHAI_UNIT_ID",
    exchange_value: 1,
    price: 12000,
    barcode: "8934567890128",
    is_base_unit: true,
    is_active: true,
  },
];

// ==================== EXPORT ====================
module.exports = {
  units,
  categories,
  products,
  productUnits,
};

/**
 * ==================== HƯỚNG DẪN SEED DATA ====================
 *
 * Cách 1: Sử dụng MongoDB Compass
 * 1. Mở MongoDB Compass
 * 2. Connect vào database
 * 3. Tạo collections: units, categories, products, productunits
 * 4. Import JSON vào từng collection
 *
 * Cách 2: Tạo seed script
 *
 * // seed.js
 * const mongoose = require('mongoose');
 * const { units, categories, products, productUnits } = require('./seedData');
 * const { Unit, Category, Product, ProductUnit } = require('./models');
 *
 * async function seed() {
 *   try {
 *     await mongoose.connect(process.env.MONGODB_URI);
 *
 *     // Clear existing data
 *     await Unit.deleteMany({});
 *     await Category.deleteMany({});
 *     await Product.deleteMany({});
 *     await ProductUnit.deleteMany({});
 *
 *     // Insert units
 *     const insertedUnits = await Unit.insertMany(units);
 *     console.log('Units seeded:', insertedUnits.length);
 *
 *     // Insert categories
 *     const insertedCategories = await Category.insertMany(categories);
 *     console.log('Categories seeded:', insertedCategories.length);
 *
 *     // Update products with real category IDs
 *     const updatedProducts = products.map(p => ({
 *       ...p,
 *       category_id: insertedCategories[0]._id // Update với ID thật
 *     }));
 *
 *     // Insert products
 *     const insertedProducts = await Product.insertMany(updatedProducts);
 *     console.log('Products seeded:', insertedProducts.length);
 *
 *     // Update product units with real IDs
 *     const updatedProductUnits = productUnits.map(pu => ({
 *       ...pu,
 *       product_id: insertedProducts[0]._id, // Update với ID thật
 *       unit_id: insertedUnits[0]._id // Update với ID thật
 *     }));
 *
 *     // Insert product units
 *     const insertedProductUnits = await ProductUnit.insertMany(updatedProductUnits);
 *     console.log('Product units seeded:', insertedProductUnits.length);
 *
 *     console.log('Seed completed!');
 *     process.exit(0);
 *   } catch (error) {
 *     console.error('Seed error:', error);
 *     process.exit(1);
 *   }
 * }
 *
 * seed();
 *
 * // Chạy: node seed.js
 *
 * ============================================================
 */
