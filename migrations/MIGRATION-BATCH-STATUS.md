# Migration: Batch Status to Item Status

## 📝 Tóm tắt thay đổi

### Trước (Old Structure)
```javascript
ProductBatch {
  _id: "NK-260225-1430",
  items: [
    {
      product_id: ObjectId,
      quantity: 100,
      // ... other fields
    }
  ],
  status: "instock" | "expired" | "near_expiry" | ...  // ← Status ở batch level
}
```

### Sau (New Structure)
```javascript
ProductBatch {
  _id: "NK-260225-1430",
  items: [
    {
      product_id: ObjectId,
      quantity: 100,
      date_status: "active" | "expired" | "near_expiry",  // ← Tự động tính theo HSD
      status: "instock" | "outdate" | "onsale" | "sold" | "rejected"  // ← Thủ công
    }
  ],
  // ✗ Không còn status ở batch level
}
```

## 🎯 Lý do thay đổi

1. **Mỗi item có thể có trạng thái khác nhau**: Một lô có thể có item hết hạn và item còn tốt
2. **Tách biệt 2 loại status**:
   - `date_status`: Trạng thái dựa trên hạn sử dụng (tự động)
   - `status`: Trạng thái nghiệp vụ (thủ công: trong kho, đang bán, đã bán...)
3. **Linh hoạt hơn**: Quản lý từng sản phẩm trong lô độc lập

## 🔧 Files đã thay đổi

### 1. Model
**File**: `models/ProductBatch.js`
- ✓ Thêm `date_status` và `status` vào `batchItemSchema`
- ✗ Xóa `status` khỏi `productBatchSchema`

### 2. Service
**File**: `services/repository_staff/productBatchService.js`
- ✓ Sửa `updateBatchStatus()` → `updateItemStatus()`: Update từng item
- ✓ Sửa `getAllBatches()`: Filter theo `items.status` hoặc `items.date_status`
- ✓ Sửa `importBatch()`: Set default status cho items
- ✓ Sửa `updateBatch()`: Preserve status của items
- ✓ Sửa `rejectBatch()`: Set `status = "rejected"` cho items
- ✓ Sửa `changeStatus()`: Update status cho tất cả items

### 3. Migration
**File**: `migrations/migrate-batch-status.js`
- Script để migrate dữ liệu cũ

## 🚀 Cách chạy Migration

### Bước 1: Backup Database
```bash
# MongoDB Atlas: Sử dụng Cloud Backups
# Local MongoDB:
mongodump --uri="mongodb://localhost:27017/yourdb" --out="./backup-$(date +%Y%m%d)"
```

### Bước 2: Chạy Migration
```bash
cd SMart_API
node migrations/migrate-batch-status.js
```

### Bước 3: Kiểm tra kết quả
```bash
# Connect to MongoDB
mongosh "your-connection-string"

# Xem sample data sau migration
db.productbatches.findOne()

# Kiểm tra items có date_status và status
db.productbatches.aggregate([
  { $unwind: "$items" },
  { $group: { 
    _id: { date_status: "$items.date_status", status: "$items.status" },
    count: { $sum: 1 }
  }}
])
```

## 📊 Status Fields

### date_status (Tự động)
| Value | Ý nghĩa | Điều kiện |
|-------|---------|-----------|
| `active` | Còn hạn tốt | HSD > 30 ngày |
| `near_expiry` | Sắp hết hạn | HSD ≤ 30 ngày |
| `expired` | Hết hạn | HSD < 0 ngày |

**Được tự động cập nhật bởi**: `updateItemStatus()` mỗi khi fetch hoặc save

### status (Thủ công)
| Value | Ý nghĩa | Ai set |
|-------|---------|--------|
| `instock` | Trong kho | Default khi nhập |
| `outdate` | Quá hạn | Admin/Staff |
| `onsale` | Đang bán | Admin/Staff |
| `sold` | Đã bán hết | Admin/Staff |
| `rejected` | Đã từ chối | System (khi reject batch) |

**Được cập nhật bởi**: API `PATCH /batches/:id/status`

## 🔄 API Changes

### Filter batches
```javascript
// Trước
GET /batches?status=expired

// Sau (vẫn hoạt động, filter theo items.date_status hoặc items.status)
GET /batches?status=expired       // Filter theo date_status
GET /batches?status=instock       // Filter theo status
```

### Change status
```javascript
// Trước: Đổi status của batch
PATCH /batches/:id/status
Body: { status: "instock" }

// Sau: Đổi status của TẤT CẢ items trong batch
PATCH /batches/:id/status
Body: { status: "instock" }
// → Set status="instock" cho tất cả items
```

## ⚠️ Breaking Changes

### Backend
- ❌ `batch.status` không còn tồn tại
- ✅ Dùng `batch.items[0].status` hoặc `batch.items[0].date_status`

### Frontend
Cần update:
1. Hiển thị status của từng item thay vì batch
2. Filter theo item status
3. UI để quản lý status từng item

## 🧪 Testing

### Test Cases
```javascript
// 1. Import batch mới
// Expected: items có date_status="active", status="instock"

// 2. Item hết hạn
// Expected: date_status="expired" (tự động)

// 3. Change status
// Expected: Tất cả items có status mới

// 4. Reject batch
// Expected: Tất cả items có status="rejected"
```

## 📞 Support

Nếu gặp vấn đề:
1. Check logs trong console khi chạy migration
2. Verify data với MongoDB queries ở trên
3. Rollback bằng backup nếu cần

---

**Migration Date**: 2026-02-25  
**Version**: 2.0.0
