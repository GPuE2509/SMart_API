var createError = require("http-errors");
require("dotenv").config();
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
const passport = require("./config/passport");
const authRouter = require("./routes/authRouter");
const productUnitRouter = require("./routes/admin/productUnitRouter");
const productRouter = require("./routes/admin/productRouter");
const categoryRouter = require("./routes/admin/categoryRouter");
const userRouter = require("./routes/admin/userRouter");
const attendanceRouter = require("./routes/admin/attendanceRouter");

// Repository staff routes
const productBatchRouter = require("./routes/repository_staff/productBatchRouter");
const sellerPosRouter = require("./routes/seller_staff/posRouter");
const couponRouter = require("./routes/admin/couponRouter");

// Seller staff routes
const sellerStaffOrderRouter = require("./routes/seller_staff/orderRouter");

// Admin payroll routes
const payrollAdminRouter = require("./routes/admin/payrollRouter");

// Staff routes (for both seller_staff and repository_staff)
const staffPayrollRouter = require("./routes/staff/payrollRouter");

// Admin reports and recipe routes
const salesReportRouter = require("./routes/admin/salesReportRouter");
const recipeRouter = require("./routes/admin/recipeRouter");
const orderRouter = require("./routes/admin/orderRouter");

// Customer routes (public/no admin required)
const customerProductRouter = require("./routes/customer/productRouter");
const customerCategoryRouter = require("./routes/customer/categoryRouter");
const customerCouponRouter = require("./routes/customer/couponRouter");
const customerUserCouponRouter = require("./routes/customer/userCouponRouter");
const customerRecipeRouter = require("./routes/customer/recipeRouter");
const customerOrderRouter = require("./routes/customer/orderRouter");
const customerCartRouter = require("./routes/customer/cartRouter");

var app = express();

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:8081",
      "http://172.24.32.1:8081", // Mobile device
      "http://192.168.1.7:8081",
      "http://10.66.162.41:8081",
      "http://10.66.184.222:8081",
      "http://10.66.169.60:8081", // ✅ Current WiFi IP - Updated automatically
      "http://192.168.1.5:8081",
      "http://192.168.3.167:8081",
      "http://192.168.3.188:8081",
      "http://192.168.3.207:8081",
      "http://10.10.10.53:8081",
      "http://10.255.100.24:8081",
      "http://10.10.9.241:8081",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Initialize Passport
app.use(passport.initialize());

// Auth routes
app.use("/api/v1/auth", authRouter);

// Customer routes (public - for mobile app)
app.use("/api/v1/customer/products", customerProductRouter);
app.use("/api/v1/customer/categories", customerCategoryRouter);
app.use("/api/v1/customer/coupons", customerCouponRouter);
app.use("/api/v1/customer/user-coupons", customerUserCouponRouter);
app.use("/api/v1/customer/recipes", customerRecipeRouter);
app.use("/api/v1/customer/orders", customerOrderRouter);
app.use("/api/v1/customer/cart", customerCartRouter);

// Admin routes (require admin role)
app.use("/api/v1/product-units", productUnitRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/attendance", attendanceRouter);

// Repository staff routes (require repository_staff role)
app.use("/api/v1/batches", productBatchRouter);
app.use("/api/v1/coupons", couponRouter);

// Seller staff routes (require seller_staff role)
app.use("/api/v1/seller/pos", sellerPosRouter);

// Admin reports routes
app.use("/api/v1/admin/reports", salesReportRouter);
app.use("/api/v1/admin/orders", orderRouter);
app.use("/api/v1/admin/payroll", payrollAdminRouter);
app.use("/api/v1/recipes", recipeRouter);

// Seller staff routes (require seller_staff role)
app.use("/api/v1/seller-staff/orders", sellerStaffOrderRouter);

// Staff routes (for both seller_staff and repository_staff)
app.use("/api/v1/staff/payroll", staffPayrollRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// ==================== AUTO CRON PAYOS ====================
const orderService = require("./services/customer/orderService");
setInterval(
  () => {
    orderService.autoCancelExpiredPayOSOrders();
  },
  5 * 60 * 1000,
); // Run every 5 minutes

module.exports = app;
