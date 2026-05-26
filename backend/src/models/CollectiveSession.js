import mongoose from "mongoose";

const collectiveMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    quantity: { type: Number, min: 1, default: 1 },
    joinedAt: { type: Date, default: Date.now },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paidAmount: { type: Number, default: 0 },
    paidAt: Date,
    deliveryAddress: {
      fullName: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },
  },
  { _id: false }
);

const collectiveSessionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    members: [collectiveMemberSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["active", "completed", "expired"],
      default: "active",
    },
    currentDiscount: { type: Number, default: 0 },
    totalMembers: { type: Number, default: 0 },
    discountTier: { type: Number, default: 1 },
    originalPrice: { type: Number, default: 0 },
    discountedPrice: { type: Number, default: 0 },
    perUserAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "partially_paid", "paid"],
      default: "pending",
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    completedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  }
);

collectiveSessionSchema.index({ productId: 1, status: 1 });
collectiveSessionSchema.index({ "members.userId": 1, status: 1 });

collectiveSessionSchema.virtual("id").get(function () {
  return this._id.toString();
});

export default mongoose.model("CollectiveSession", collectiveSessionSchema);
