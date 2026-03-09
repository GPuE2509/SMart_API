const ProductBatch = require("../models/ProductBatch");
const Product = require("../models/Product");
const User = require("../models/User");
const emailService = require("./emailService");

/**
 * Calculate rescue discount percentage based on remaining shelf life percentage
 * Uses: (expiry - now) / (expiry - manufacture) to calculate remaining life percentage
 * This works for both long-life products (months) and short-life products (days)
 * 
 * @param {Date} manufactureDate - Production date
 * @param {Date} expiryDate - Expiration date
 * @param {Date} now - Current date (default: new Date())
 * @returns {number} - Discount percentage (0-50)
 * 
 * Discount tiers based on remaining shelf life:
 * - > 40 remaining: 0% discount (still fresh)
 * - 20-40% remaining: 10% discount
 * - 10-20% remaining: 25% discount
 * - < 10% remaining: 50% discount (urgent sale)
 */
const calculateRescueDiscount = (manufactureDate, expiryDate, now = new Date()) => {
  if (!manufactureDate || !expiryDate) return 0;

  const mfgDate = new Date(manufactureDate);
  const expDate = new Date(expiryDate);
  const currentDate = new Date(now);

  // Total shelf life in milliseconds
  const totalShelfLife = expDate - mfgDate;
  
  // Remaining shelf life in milliseconds
  const remainingShelfLife = expDate - currentDate;

  // If expired or invalid dates
  if (remainingShelfLife <= 0 || totalShelfLife <= 0) return 0;

  // Calculate percentage of remaining shelf life
  const remainingPercentage = (remainingShelfLife / totalShelfLife) * 100;

  // Apply discount based on remaining percentage
  if (remainingPercentage > 40) return 0;   // Still fresh
  if (remainingPercentage > 20) return 10;  // Minor discount
  if (remainingPercentage > 10) return 25;  // Significant discount
  return 50;                                 // Maximum discount (urgent)
};

/**
 * Check all batches for rescue pricing eligibility and send notifications
 * Runs daily at midnight
 */
exports.checkAndNotifyRescuePricing = async () => {
  try {
    console.log("🔍 Starting rescue pricing check...");

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find all active batches
    const batches = await ProductBatch.find({
      is_deleted: false,
    }).populate("items.product_id items.unit_id");

    let notificationCount = 0;
    const notifications = [];

    for (const batch of batches) {
      let batchUpdated = false;

      for (const item of batch.items) {
        // Skip if item is sold, rejected, or expired
        if (["sold", "rejected", "outdate"].includes(item.status)) {
          continue;
        }

        // Skip if rescue pricing is disabled for this item
        if (!item.rescue_pricing_enabled) {
          continue;
        }

        const manufactureDate = new Date(item.manufacture_date);
        const expiryDate = new Date(item.expiry_date);
        const daysUntilExpiry = Math.ceil(
          (expiryDate - now) / (1000 * 60 * 60 * 24)
        );

        // Calculate discount based on shelf life percentage
        const discountPercentage = calculateRescueDiscount(
          manufactureDate,
          expiryDate,
          now
        );

        // Apply rescue pricing if there's a discount (remaining shelf life <= 80%)
        if (discountPercentage > 0 && daysUntilExpiry >= 0) {
          // Update rescue pricing info
          const previousDiscount = item.rescue_discount_percentage || 0;
          item.rescue_discount_percentage = discountPercentage;
          item.rescue_pricing_active = true;

          // Send notification if discount has increased or first time activating
          if (
            discountPercentage > previousDiscount ||
            !item.rescue_notification_sent
          ) {
            const productName = item.product_id?.name || "Unknown";
            const unitName = item.unit_id?.name || "";

            notifications.push({
              batchCode: batch._id,
              productName,
              unitName,
              daysUntilExpiry,
              discountPercentage,
              expiryDate: expiryDate.toLocaleDateString("vi-VN"),
            });

            item.rescue_notification_sent = true;
            item.rescue_notification_date = now;
            notificationCount++;
          }

          batchUpdated = true;
        } else if (daysUntilExpiry < 1) {
          // Item has expired, deactivate rescue pricing
          if (item.rescue_pricing_active) {
            item.rescue_pricing_active = false;
            item.rescue_discount_percentage = 0;
            batchUpdated = true;
          }
        }
      }

      // Save batch if any item was updated
      if (batchUpdated) {
        await batch.save();
      }
    }

    // Send email notification to all repository staff if there are notifications
    if (notifications.length > 0) {
      await this.sendRescuePricingNotifications(notifications);
    }

    console.log(
      `✅ Rescue pricing check completed. ${notificationCount} notifications generated.`
    );

    return {
      success: true,
      notificationCount,
      notifications,
    };
  } catch (error) {
    console.error("❌ Error in rescue pricing check:", error);
    throw error;
  }
};

/**
 * Send rescue pricing notifications to repository staff via email
 */
exports.sendRescuePricingNotifications = async (notifications) => {
  try {
    // Get all repository staff users
    const repositoryStaff = await User.find({
      role: "repository_staff",
      status: "active",
    }).select("email full_name");

    if (repositoryStaff.length === 0) {
      console.log("⚠️ No repository staff found to send notifications");
      return;
    }

    // Build email content
    let notificationRows = notifications
      .map(
        (notif) => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; border: 1px solid #ddd;">${notif.batchCode}</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${notif.productName} ${notif.unitName}</td>
          <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${notif.daysUntilExpiry} ngày</td>
          <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
            <strong style="color: #ff4d4f;">${notif.discountPercentage}%</strong>
          </td>
          <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${notif.expiryDate}</td>
        </tr>
      `
      )
      .join("");

    // Send email to each repository staff member
    for (const staff of repositoryStaff) {
      await emailService.sendRescuePricingNotification(
        staff.email,
        staff.full_name,
        notifications,
        notificationRows
      );
    }

    console.log(
      `📧 Rescue pricing notifications sent to ${repositoryStaff.length} repository staff members`
    );
  } catch (error) {
    console.error("❌ Error sending rescue pricing notifications:", error);
    throw error;
  }
};

/**
 * Toggle rescue pricing for a specific batch item
 */
exports.toggleRescuePricing = async (batchId, itemId, enabled) => {
  try {
    const batch = await ProductBatch.findById(batchId).populate(
      "items.product_id items.unit_id"
    );

    if (!batch) {
      throw new Error("Không tìm thấy lô hàng");
    }

    const item = batch.items.id(itemId);

    if (!item) {
      throw new Error("Không tìm thấy sản phẩm trong lô hàng");
    }

    item.rescue_pricing_enabled = enabled;

    // If disabling, also deactivate current pricing
    if (!enabled) {
      item.rescue_pricing_active = false;
      item.rescue_discount_percentage = 0;
      item.rescue_notification_sent = false;
    } else {
      // If enabling, immediately calculate and apply rescue pricing
      const now = new Date();
      const manufactureDate = new Date(item.manufacture_date);
      const expiryDate = new Date(item.expiry_date);
      const daysUntilExpiry = Math.ceil(
        (expiryDate - now) / (1000 * 60 * 60 * 24)
      );

      // Calculate discount based on shelf life percentage
      const discountPercentage = calculateRescueDiscount(
        manufactureDate,
        expiryDate,
        now
      );

      // Apply rescue pricing if there's a discount
      if (discountPercentage > 0 && daysUntilExpiry >= 0) {
        item.rescue_discount_percentage = discountPercentage;
        item.rescue_pricing_active = true;
        item.rescue_notification_sent = true;
        item.rescue_notification_date = now;
      } else if (daysUntilExpiry < 0) {
        // Item has expired
        item.rescue_pricing_active = false;
        item.rescue_discount_percentage = 0;
      } else {
        // Item is still very fresh (> 80% shelf life remaining)
        item.rescue_pricing_active = false;
        item.rescue_discount_percentage = 0;
      }
    }

    await batch.save();

    return {
      success: true,
      message: enabled
        ? "Đã bật giảm giá cứu hộ"
        : "Đã tắt giảm giá cứu hộ",
      item,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get rescue pricing information for a batch item
 */
exports.getRescuePricingInfo = async (batchId, itemId) => {
  try {
    const batch = await ProductBatch.findById(batchId).populate(
      "items.product_id items.unit_id"
    );

    if (!batch) {
      throw new Error("Không tìm thấy lô hàng");
    }

    const item = batch.items.id(itemId);

    if (!item) {
      throw new Error("Không tìm thấy sản phẩm trong lô hàng");
    }

    const now = new Date();
    const manufactureDate = new Date(item.manufacture_date);
    const expiryDate = new Date(item.expiry_date);
    const daysUntilExpiry = Math.ceil(
      (expiryDate - now) / (1000 * 60 * 60 * 24)
    );

    // Calculate remaining shelf life percentage
    const totalShelfLife = expiryDate - manufactureDate;
    const remainingShelfLife = expiryDate - now;
    const remainingPercentage = totalShelfLife > 0 
      ? Math.max(0, (remainingShelfLife / totalShelfLife) * 100)
      : 0;

    return {
      enabled: item.rescue_pricing_enabled,
      active: item.rescue_pricing_active,
      discountPercentage: item.rescue_discount_percentage || 0,
      daysUntilExpiry,
      remainingShelfLifePercentage: Math.round(remainingPercentage),
      expiryDate: item.expiry_date,
      manufactureDate: item.manufacture_date,
      notificationSent: item.rescue_notification_sent,
      notificationDate: item.rescue_notification_date,
    };
  } catch (error) {
    throw error;
  }
};

module.exports = exports;
