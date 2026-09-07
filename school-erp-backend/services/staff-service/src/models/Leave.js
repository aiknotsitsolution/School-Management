const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
    leaveType: { type: String, enum: ["Sick", "Casual", "Earned", "Maternity", "Other"], default: "Casual" },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    approvedBy: { type: String },
    remarks: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Leave", leaveSchema);
