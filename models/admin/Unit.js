const mongoose = require("mongoose");

const unitSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    name: {
      type: String,
      maxlength: 50,
      required: true,
    },
    abbreviation: {
      type: String,
      maxlength: 10,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Unit", unitSchema);
