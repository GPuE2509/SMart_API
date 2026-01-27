/**
 * COMPLETE SEED SCRIPT - Add sample data to MongoDB
 * 
 * Usage: node seedCompleteData.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Unit = require('./models/Unit');
const Category = require('./models/Category');
const Product = require('./models/Product');
const ProductUnit = require('./models/ProductUnit');

// MongoDB connection - Load from .env file
require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/SMart';

// ==================== SAMPLE DATA ====================

// 1. UNITS (Đơn vị)
const unitsData = [
  { name: 'Kilogram', abbreviation: 'kg' },
  { name: 'Gram', abbreviation: 'g' },
  { name: 'Lít', abbreviation: 'L' },
  { name: 'Chai', abbreviation: 'chai' },
  { name: 'Lon', abbreviation: 'lon' },
  { name: 'Hộp', abbreviation: 'hộp' },
  { name: 'Gói', abbreviation: 'gói' },
  { name: 'Cái', abbreviation: 'cái' },
  { name: 'Thùng', abbreviation: 'thùng' },
  { name: 'Bó', abbreviation: 'bó' },
];

// 2. CATEGORIES (Danh mục)
const categoriesData = [
  {
    name: 'Rau củ quả',
    description: 'Rau củ quả tươi sạch, an toàn thực phẩm',
    image_url: 'https://via.placeholder.com/400/4CAF50/FFFFFF?text=Rau+Cu+Qua',
    is_active: true,
  },
  {
    name: 'Thịt - Hải sản',
    description: 'Thịt tươi, hải sản tươi sống chất lượng cao',
    image_url: 'https://via.placeholder.com/400/FF5722/FFFFFF?text=Thit+-+Hai+San',
    is_active: true,
  },
  {
    name: 'Trái cây',
    description: 'Trái cây tươi ngon, giàu vitamin',
    image_url: 'https://via.placeholder.com/400/FF9800/FFFFFF?text=Trai+Cay',
    is_active: true,
  },
  {
    name: 'Sữa - Trứng',
    description: 'Sữa tươi, trứng gà, sản phẩm từ sữa',
    image_url: 'https://via.placeholder.com/400/2196F3/FFFFFF?text=Sua+-+Trung',
    is_active: true,
  },
  {
    name: 'Đồ uống',
    description: 'Nước ngọt, nước ép, trà, cà phê',
    image_url: 'https://via.placeholder.com/400/9C27B0/FFFFFF?text=Do+Uong',
    is_active: true,
  },
  {
    name: 'Đồ khô - Gia vị',
    description: 'Gạo, mì, gia vị, đồ khô',
    image_url: 'https://via.placeholder.com/400/795548/FFFFFF?text=Do+Kho',
    is_active: true,
  },
];

// 3. PRODUCTS WITH MULTIPLE IMAGES (Sản phẩm với nhiều ảnh)
const productsData = [
  // RAU CỦ QUẢ
  {
    name: 'Cà chua',
    description: 'Cà chua tươi, giàu vitamin C và lycopene, tốt cho tim mạch và da',
    image_url: 'https://images.unsplash.com/photo-1546470427-227a4573e735?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
      'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=400',
    ],
    tax_percentage: 8,
    total_stock: 100,
    is_active: true,
    categoryName: 'Rau củ quả',
  },
  {
    name: 'Cải bắp',
    description: 'Cải bắp tươi ngon, giàu chất xơ, vitamin K và C',
    image_url: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=400',
    ],
    tax_percentage: 8,
    total_stock: 80,
    is_active: true,
    categoryName: 'Rau củ quả',
  },
  {
    name: 'Khoai tây',
    description: 'Khoai tây Đà Lạt, giàu tinh bột, vitamin B6',
    image_url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1508313880080-c4bef43d8e66?w=400',
      'https://images.unsplash.com/photo-1552874869-5c39ec9288dc?w=400',
    ],
    tax_percentage: 8,
    total_stock: 120,
    is_active: true,
    categoryName: 'Rau củ quả',
  },
  {
    name: 'Cà rốt',
    description: 'Cà rốt tươi, giàu beta-carotene, vitamin A tốt cho mắt',
    image_url: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1582515073490-39981397c445?w=400',
    ],
    tax_percentage: 8,
    total_stock: 90,
    is_active: true,
    categoryName: 'Rau củ quả',
  },

  // THỊT - HẢI SẢN
  {
    name: 'Thịt ba chỉ',
    description: 'Thịt ba chỉ heo tươi, thơm ngon, thích hợp nướng, kho',
    image_url: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400',
      'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=400',
    ],
    tax_percentage: 8,
    total_stock: 50,
    is_active: true,
    categoryName: 'Thịt - Hải sản',
  },
  {
    name: 'Thịt bò Úc',
    description: 'Thịt bò nhập khẩu từ Úc, cao cấp, mềm ngon',
    image_url: 'https://images.unsplash.com/photo-1588347818036-eeb8b97c0566?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=400',
    ],
    tax_percentage: 8,
    total_stock: 30,
    is_active: true,
    categoryName: 'Thịt - Hải sản',
  },
  {
    name: 'Cá hồi Na Uy',
    description: 'Cá hồi tươi nhập khẩu Na Uy, giàu omega-3',
    image_url: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1580959375944-1ab5b8c1c3d2?w=400',
      'https://images.unsplash.com/photo-1574781330855-d0db8cc6a79c?w=400',
    ],
    tax_percentage: 8,
    total_stock: 25,
    is_active: true,
    categoryName: 'Thịt - Hải sản',
  },

  // TRÁI CÂY
  {
    name: 'Cam Úc',
    description: 'Cam Úc nhập khẩu, ngọt mát, giàu vitamin C',
    image_url: 'https://images.unsplash.com/photo-1580052614034-c55d20bfee3b?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=400',
      'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=400',
    ],
    tax_percentage: 8,
    total_stock: 100,
    is_active: true,
    categoryName: 'Trái cây',
  },
  {
    name: 'Táo Fuji Nhật Bản',
    description: 'Táo Fuji nhập khẩu Nhật Bản, giòn ngọt, thơm',
    image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400',
      'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=400',
      'https://images.unsplash.com/photo-1589217157232-464b505b197f?w=400',
    ],
    tax_percentage: 8,
    total_stock: 80,
    is_active: true,
    categoryName: 'Trái cây',
  },
  {
    name: 'Chuối sứ',
    description: 'Chuối sứ Việt Nam, thơm ngon, bổ dưỡng',
    image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400',
    ],
    tax_percentage: 8,
    total_stock: 150,
    is_active: true,
    categoryName: 'Trái cây',
  },

  // SỮA - TRỨNG
  {
    name: 'Sữa tươi TH True Milk',
    description: 'Sữa tươi 100% không đường, giàu canxi',
    image_url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400',
      'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400',
    ],
    tax_percentage: 8,
    total_stock: 200,
    is_active: true,
    categoryName: 'Sữa - Trứng',
  },
  {
    name: 'Trứng gà Đà Lạt',
    description: 'Trứng gà sạch từ Đà Lạt, giàu protein',
    image_url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1606850780554-b55ef1da540b?w=400',
    ],
    tax_percentage: 8,
    total_stock: 300,
    is_active: true,
    categoryName: 'Sữa - Trứng',
  },

  // ĐỒ UỐNG
  {
    name: 'Coca Cola',
    description: 'Nước ngọt có ga Coca Cola 330ml, sảng khoái',
    image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400',
      'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400',
    ],
    tax_percentage: 8,
    total_stock: 500,
    is_active: true,
    categoryName: 'Đồ uống',
  },
  {
    name: 'Nước cam ép Minute Maid',
    description: 'Nước cam ép 100% từ cam tươi',
    image_url: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400',
    ],
    tax_percentage: 8,
    total_stock: 200,
    is_active: true,
    categoryName: 'Đồ uống',
  },
  {
    name: 'Trà xanh không độ C-On',
    description: 'Trà xanh 0 độ C-On, thanh mát, không calories',
    image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400',
      'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=400',
    ],
    tax_percentage: 8,
    total_stock: 300,
    is_active: true,
    categoryName: 'Đồ uống',
  },

  // ĐỒ KHÔ - GIA VỊ
  {
    name: 'Gạo ST25',
    description: 'Gạo ST25 thơm ngon, hạt dài, giá trị dinh dưỡng cao',
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
    additional_images: [
      'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400',
    ],
    tax_percentage: 8,
    total_stock: 150,
    is_active: true,
    categoryName: 'Đồ khô - Gia vị',
  },
];

// ==================== SEED FUNCTIONS ====================

async function clearDatabase() {
  console.log('🗑️  Clearing existing data...');
  await Unit.deleteMany({});
  await Category.deleteMany({});
  await Product.deleteMany({});
  await ProductUnit.deleteMany({});
  console.log('✅ Database cleared!');
}

async function seedUnits() {
  console.log('\n📏 Seeding units...');
  const units = await Unit.insertMany(unitsData);
  console.log(`✅ Created ${units.length} units`);
  units.forEach(unit => {
    console.log(`   - ${unit.name} (${unit.abbreviation})`);
  });
  return units;
}

async function seedCategories() {
  console.log('\n📂 Seeding categories...');
  const categories = await Category.insertMany(categoriesData);
  console.log(`✅ Created ${categories.length} categories`);
  categories.forEach(cat => {
    console.log(`   - ${cat.name}`);
  });
  return categories;
}

async function seedProducts(categories) {
  console.log('\n📦 Seeding products...');
  
  // Map category names to IDs
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.name] = cat._id;
  });
  
  // Update products with real category IDs
  const productsWithCategories = productsData.map(product => ({
    name: product.name,
    description: product.description,
    image_url: product.image_url,
    additional_images: product.additional_images || [],
    tax_percentage: product.tax_percentage,
    total_stock: product.total_stock,
    is_active: product.is_active,
    category_id: categoryMap[product.categoryName],
  }));
  
  const products = await Product.insertMany(productsWithCategories);
  console.log(`✅ Created ${products.length} products`);
  
  products.forEach((product, index) => {
    console.log(`   ${index + 1}. ${product.name} (${product.additional_images?.length || 0} additional images)`);
  });
  
  return products;
}

async function seedProductUnits(products, units) {
  console.log('\n💰 Seeding product units (prices)...');
  
  // Find common units
  const kgUnit = units.find(u => u.abbreviation === 'kg');
  const gUnit = units.find(u => u.abbreviation === 'g');
  const literUnit = units.find(u => u.abbreviation === 'L');
  const chaiUnit = units.find(u => u.abbreviation === 'chai');
  const lonUnit = units.find(u => u.abbreviation === 'lon');
  const hopUnit = units.find(u => u.abbreviation === 'hộp');
  const goiUnit = units.find(u => u.abbreviation === 'gói');
  const thungUnit = units.find(u => u.abbreviation === 'thùng');
  const boUnit = units.find(u => u.abbreviation === 'bó');
  
  const productUnitsData = [];
  
  // Cà chua
  const caChua = products.find(p => p.name === 'Cà chua');
  if (caChua && kgUnit && gUnit) {
    productUnitsData.push(
      {
        product_id: caChua._id,
        unit_id: kgUnit._id,
        exchange_value: 1,
        price: 25000,
        barcode: '8934567890001',
        is_base_unit: true,
        is_active: true,
      },
      {
        product_id: caChua._id,
        unit_id: gUnit._id,
        exchange_value: 0.5,
        price: 13000,
        barcode: '8934567890002',
        is_base_unit: false,
        is_active: true,
      }
    );
  }
  
  // Cải bắp
  const caiBap = products.find(p => p.name === 'Cải bắp');
  if (caiBap && kgUnit) {
    productUnitsData.push({
      product_id: caiBap._id,
      unit_id: kgUnit._id,
      exchange_value: 1,
      price: 20000,
      barcode: '8934567890003',
      is_base_unit: true,
      is_active: true,
    });
  }
  
  // Khoai tây
  const khoaiTay = products.find(p => p.name === 'Khoai tây');
  if (khoaiTay && kgUnit) {
    productUnitsData.push(
      {
        product_id: khoaiTay._id,
        unit_id: kgUnit._id,
        exchange_value: 1,
        price: 30000,
        barcode: '8934567890004',
        is_base_unit: true,
        is_active: true,
      },
      {
        product_id: khoaiTay._id,
        unit_id: goiUnit._id,
        exchange_value: 2,
        price: 55000,
        barcode: '8934567890005',
        is_base_unit: false,
        is_active: true,
      }
    );
  }
  
  // Cà rốt
  const caRot = products.find(p => p.name === 'Cà rốt');
  if (caRot && kgUnit && boUnit) {
    productUnitsData.push(
      {
        product_id: caRot._id,
        unit_id: kgUnit._id,
        exchange_value: 1,
        price: 22000,
        barcode: '8934567890006',
        is_base_unit: true,
        is_active: true,
      },
      {
        product_id: caRot._id,
        unit_id: boUnit._id,
        exchange_value: 0.5,
        price: 12000,
        barcode: '8934567890007',
        is_base_unit: false,
        is_active: true,
      }
    );
  }
  
  // Thịt ba chỉ
  const thitBaChi = products.find(p => p.name === 'Thịt ba chỉ');
  if (thitBaChi && kgUnit) {
    productUnitsData.push({
      product_id: thitBaChi._id,
      unit_id: kgUnit._id,
      exchange_value: 1,
      price: 150000,
      barcode: '8934567890008',
      is_base_unit: true,
      is_active: true,
    });
  }
  
  // Thịt bò Úc
  const thitBo = products.find(p => p.name === 'Thịt bò Úc');
  if (thitBo && kgUnit) {
    productUnitsData.push({
      product_id: thitBo._id,
      unit_id: kgUnit._id,
      exchange_value: 1,
      price: 350000,
      barcode: '8934567890009',
      is_base_unit: true,
      is_active: true,
    });
  }
  
  // Cá hồi
  const caHoi = products.find(p => p.name === 'Cá hồi Na Uy');
  if (caHoi && kgUnit) {
    productUnitsData.push({
      product_id: caHoi._id,
      unit_id: kgUnit._id,
      exchange_value: 1,
      price: 450000,
      barcode: '8934567890010',
      is_base_unit: true,
      is_active: true,
    });
  }
  
  // Cam Úc
  const camUc = products.find(p => p.name === 'Cam Úc');
  if (camUc && kgUnit) {
    productUnitsData.push({
      product_id: camUc._id,
      unit_id: kgUnit._id,
      exchange_value: 1,
      price: 45000,
      barcode: '8934567890011',
      is_base_unit: true,
      is_active: true,
    });
  }
  
  // Táo Fuji
  const taoFuji = products.find(p => p.name === 'Táo Fuji Nhật Bản');
  if (taoFuji && kgUnit) {
    productUnitsData.push({
      product_id: taoFuji._id,
      unit_id: kgUnit._id,
      exchange_value: 1,
      price: 120000,
      barcode: '8934567890012',
      is_base_unit: true,
      is_active: true,
    });
  }
  
  // Chuối
  const chuoi = products.find(p => p.name === 'Chuối sứ');
  if (chuoi && kgUnit) {
    productUnitsData.push({
      product_id: chuoi._id,
      unit_id: kgUnit._id,
      exchange_value: 1,
      price: 18000,
      barcode: '8934567890013',
      is_base_unit: true,
      is_active: true,
    });
  }
  
  // Sữa TH
  const suaTH = products.find(p => p.name === 'Sữa tươi TH True Milk');
  if (suaTH && hopUnit) {
    productUnitsData.push(
      {
        product_id: suaTH._id,
        unit_id: hopUnit._id,
        exchange_value: 1,
        price: 28000,
        barcode: '8934567890014',
        is_base_unit: true,
        is_active: true,
      },
      {
        product_id: suaTH._id,
        unit_id: thungUnit._id,
        exchange_value: 12,
        price: 320000,
        barcode: '8934567890015',
        is_base_unit: false,
        is_active: true,
      }
    );
  }
  
  // Trứng gà
  const trungGa = products.find(p => p.name === 'Trứng gà Đà Lạt');
  if (trungGa && goiUnit) {
    productUnitsData.push({
      product_id: trungGa._id,
      unit_id: goiUnit._id,
      exchange_value: 10, // 10 quả/gói
      price: 35000,
      barcode: '8934567890016',
      is_base_unit: true,
      is_active: true,
    });
  }
  
  // Coca Cola
  const coca = products.find(p => p.name === 'Coca Cola');
  if (coca && lonUnit && thungUnit) {
    productUnitsData.push(
      {
        product_id: coca._id,
        unit_id: lonUnit._id,
        exchange_value: 1,
        price: 12000,
        barcode: '8934567890017',
        is_base_unit: true,
        is_active: true,
      },
      {
        product_id: coca._id,
        unit_id: thungUnit._id,
        exchange_value: 24,
        price: 260000,
        barcode: '8934567890018',
        is_base_unit: false,
        is_active: true,
      }
    );
  }
  
  // Nước cam
  const nuocCam = products.find(p => p.name === 'Nước cam ép Minute Maid');
  if (nuocCam && hopUnit) {
    productUnitsData.push({
      product_id: nuocCam._id,
      unit_id: hopUnit._id,
      exchange_value: 1,
      price: 15000,
      barcode: '8934567890019',
      is_base_unit: true,
      is_active: true,
    });
  }
  
  // Trà xanh
  const traXanh = products.find(p => p.name === 'Trà xanh không độ C-On');
  if (traXanh && chaiUnit && thungUnit) {
    productUnitsData.push(
      {
        product_id: traXanh._id,
        unit_id: chaiUnit._id,
        exchange_value: 1,
        price: 10000,
        barcode: '8934567890020',
        is_base_unit: true,
        is_active: true,
      },
      {
        product_id: traXanh._id,
        unit_id: thungUnit._id,
        exchange_value: 24,
        price: 220000,
        barcode: '8934567890021',
        is_base_unit: false,
        is_active: true,
      }
    );
  }
  
  // Gạo ST25
  const gao = products.find(p => p.name === 'Gạo ST25');
  if (gao && kgUnit && goiUnit) {
    productUnitsData.push(
      {
        product_id: gao._id,
        unit_id: kgUnit._id,
        exchange_value: 1,
        price: 35000,
        barcode: '8934567890022',
        is_base_unit: true,
        is_active: true,
      },
      {
        product_id: gao._id,
        unit_id: goiUnit._id,
        exchange_value: 5,
        price: 165000,
        barcode: '8934567890023',
        is_base_unit: false,
        is_active: true,
      }
    );
  }
  
  const productUnits = await ProductUnit.insertMany(productUnitsData);
  console.log(`✅ Created ${productUnits.length} product units (price configurations)`);
  
  return productUnits;
}

// ==================== MAIN SEED FUNCTION ====================

async function seed() {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  SMART RETAIL - COMPLETE SEED DATA    ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB:', MONGODB_URI);
    
    // Clear existing data
    await clearDatabase();
    
    // Seed data in order
    const units = await seedUnits();
    const categories = await seedCategories();
    const products = await seedProducts(categories);
    const productUnits = await seedProductUnits(products, units);
    
    // Summary
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  SEED SUMMARY                          ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`✅ Units: ${units.length}`);
    console.log(`✅ Categories: ${categories.length}`);
    console.log(`✅ Products: ${products.length}`);
    console.log(`✅ Product Units: ${productUnits.length}`);
    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📱 Now you can:');
    console.log('   1. Start the mobile app: cd ../Mobile/SMart_Mobile_Client && npm start');
    console.log('   2. Browse products in the app');
    console.log('   3. Test Product Detail with image gallery');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seed error:', error);
    process.exit(1);
  }
}

// Run seed
seed();
