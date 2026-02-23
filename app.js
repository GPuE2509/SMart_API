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
const productBatchRouter = require("./routes/admin/productBatchRouter");

// Customer routes (public/no admin required)
const customerProductRouter = require("./routes/customer/productRouter");
const customerCategoryRouter = require("./routes/customer/categoryRouter");

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

// Admin routes (require admin role)
app.use("/api/v1/product-units", productUnitRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/users", userRouter);

// Repository staff routes (require repository_staff role)
app.use("/api/v1/batches", productBatchRouter);

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

module.exports = app;
