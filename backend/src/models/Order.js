import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    product_name: String,
    price: Number,
    quantity: Number,
  },
  { _id: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

orderItemSchema.virtual("id").get(function () {
  return this._id.toString();
});

const paymentSchema = new mongoose.Schema(
  {
    transaction_id: String,
    payment_method: String,
    payment_status: String,
    paid_at: Date,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    buyer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [orderItemSchema],
    order_items: [orderItemSchema],
    total: Number,
    total_amount: Number,
    status: { type: String, default: "placed" },
    paymentStatus: { type: String, default: "pending" },
    payment_status: { type: String, default: "pending" },
    payment_method: { type: String, default: "COD" },
    transaction_id: String,
    address_id: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    address: Object,
    payments: [paymentSchema],
    orderType: { type: String, enum: ["standard", "collective"], default: "standard" },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "CollectiveSession" },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        quantity: Number,
        paidAmount: Number,
        paidAt: Date,
        deliveryAddress: Object,
      },
    ],
    originalPrice: Number,
    discountPercentage: Number,
    discountedPrice: Number,
    totalAmount: Number,
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  }
);

orderSchema.index(
  { sessionId: 1, orderType: 1 },
  { unique: true, partialFilterExpression: { orderType: "collective" } }
);

orderSchema.virtual("id").get(function () {
  return this._id.toString();
});

export default mongoose.model("Order", orderSchema);
