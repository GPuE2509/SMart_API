const mongoose = require('mongoose');

const staffAttendanceSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  check_in_time: {
    type: Date
  },
  check_out_time: {
    type: Date
  },
  work_shift: {
    type: String,
    maxlength: 50
  },
  note: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('StaffAttendance', staffAttendanceSchema);
