import CollectiveBuy from "../models/CollectiveBuy.js";
import CollectiveInvite from "../models/CollectiveInvite.js";
import CollectiveSession from "../models/CollectiveSession.js";
import Notification from "../models/Notification.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { getNextDiscountMilestone } from "../services/discountService.js";
import { calculateSplitPayment } from "../services/splitPaymentService.js";
import {
  sendCollectiveInviteEmail,
  sendCollectiveOrderConfirmedEmail,
} from "../utils/sendEmail.js";

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const shapeCollectiveBuy = (doc) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj._id?.toString?.() || obj.id;
  obj.product_id = obj.productId?._id?.toString?.() || obj.productId?.toString?.() || obj.productId;
  obj.product = obj.productId && typeof obj.productId === "object" ? obj.productId : null;
  obj.seller_id = obj.sellerId;
  return obj;
};

const INVITE_EXPIRY_HOURS = 48;
const SESSION_EXPIRY_DAYS = 7;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const shapeSession = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj._id?.toString?.() || obj.id;
  obj.product_id = obj.productId?._id?.toString?.() || obj.productId?.toString?.() || obj.productId;
  obj.product = obj.productId && typeof obj.productId === "object" ? obj.productId : null;
  obj.created_by = obj.createdBy?.toString?.() || obj.createdBy;
  obj.originalPrice = obj.originalPrice ?? obj.totalOriginalPrice ?? 0;
  obj.discountedPrice = obj.discountedPrice ?? obj.totalDiscountedPrice ?? 0;
  obj.nextMilestone = getNextDiscountMilestone(obj.totalMembers || obj.members?.length || 1);
  obj.allMembersPaid = (obj.members || []).length > 0 && (obj.members || []).every((member) => member.paymentStatus === "paid");
  return obj;
};

const recalculateSession = async (session) => {
  await session.populate("productId");

  const product = session.productId;
  const totalMembers = session.members.length;
  const split = calculateSplitPayment({
    productPrice: Number(product?.price || 0),
    totalMembers,
  });

  session.totalMembers = totalMembers;
  session.currentDiscount = split.discountPercentage;
  session.discountTier = split.discountTier;
  session.originalPrice = split.originalPrice;
  session.discountedPrice = split.finalDiscountedPrice;
  session.perUserAmount = split.perUserAmount;

  const paidCount = session.members.filter((member) => member.paymentStatus === "paid").length;
  session.paymentStatus =
    paidCount === 0
      ? "pending"
      : paidCount === session.members.length
        ? "paid"
        : "partially_paid";

  await session.save();
  return session;
};

const getOrCreateActiveSession = async ({ productId, createdBy }) => {
  let session = await CollectiveSession.findOne({
    productId,
    status: "active",
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    session = await CollectiveSession.create({
      productId,
      createdBy,
      members: [{ userId: createdBy, quantity: 1 }],
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });
  }

  return recalculateSession(session);
};

const addMemberIfMissing = (session, userId) => {
  const exists = session.members.some((member) => member.userId.toString() === userId.toString());
  if (!exists) {
    session.members.push({ userId, quantity: 1, joinedAt: new Date() });
  }
};

const shapeInvite = (doc) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj._id?.toString?.() || obj.id;
  obj.sender = obj.senderId && typeof obj.senderId === "object" ? obj.senderId : null;
  obj.receiver = obj.receiverId && typeof obj.receiverId === "object" ? obj.receiverId : null;
  obj.product = obj.productId && typeof obj.productId === "object" ? obj.productId : null;
  obj.session_id = obj.sessionId?._id?.toString?.() || obj.sessionId?.toString?.() || obj.sessionId;
  return obj;
};

const getSessionForMember = async (sessionId, userId) => {
  if (!isValidObjectId(sessionId)) {
    const error = new Error("Invalid input");
    error.statusCode = 400;
    throw error;
  }

  const session = await CollectiveSession.findById(sessionId)
    .populate("productId")
    .populate("members.userId", "name full_name email avatar role");

  if (!session) {
    const error = new Error("Collective session not found");
    error.statusCode = 404;
    throw error;
  }

  const member = session.members.find((item) => item.userId?._id?.toString() === userId || item.userId?.toString?.() === userId);
  if (!member) {
    const error = new Error("You are not a member of this collective session");
    error.statusCode = 403;
    throw error;
  }

  return { session, member };
};

const ensureSessionCheckoutable = (session) => {
  if (session.status !== "active") {
    const error = new Error("This collective session is not active");
    error.statusCode = 400;
    throw error;
  }

  if (session.expiresAt < new Date()) {
    session.status = "expired";
    const error = new Error("This collective session has expired");
    error.statusCode = 400;
    throw error;
  }
};

const getStockValue = (product) => Number(product?.stock ?? product?.stock_quantity ?? 0);

const shapeCheckout = (session, member) => {
  const product = session.productId && typeof session.productId === "object" ? session.productId : {};
  return {
    session: shapeSession(session),
    product,
    originalPrice: roundMoney(session.originalPrice),
    currentDiscount: session.currentDiscount,
    discountPercentage: session.currentDiscount,
    discountedPrice: roundMoney(session.discountedPrice),
    totalMembers: session.totalMembers,
    perUserAmount: roundMoney(session.perUserAmount),
    currentUserPaymentStatus: member.paymentStatus || "pending",
    paidAmount: roundMoney(member.paidAmount),
    paidAt: member.paidAt,
    deliveryAddress: member.deliveryAddress || null,
    paymentStatus: session.paymentStatus,
    allMembersPaid: session.members.every((item) => item.paymentStatus === "paid"),
    orderId: session.orderId,
  };
};

const notifyUsers = async (notifications) => {
  if (!notifications.length) return;
  await Notification.insertMany(notifications);
};

const createOrGetCollectiveOrder = async (session) => {
  await session.populate([
    { path: "productId" },
    { path: "members.userId", select: "name full_name email avatar role" },
  ]);

  const existingOrder = session.orderId
    ? await Order.findById(session.orderId)
    : await Order.findOne({ orderType: "collective", sessionId: session._id });

  if (existingOrder) {
    session.status = "completed";
    session.paymentStatus = "paid";
    session.orderId = existingOrder._id;
    session.completedAt = session.completedAt || existingOrder.created_at || new Date();
    await session.save();
    return existingOrder;
  }

  if (!session.members.length || !session.members.every((member) => member.paymentStatus === "paid")) {
    const error = new Error("All members must pay before completing this collective order");
    error.statusCode = 400;
    throw error;
  }

  const product = session.productId;
  const availableStock = getStockValue(product);
  if (availableStock < 1) {
    const error = new Error(`${product.name || product.title} is out of stock`);
    error.statusCode = 400;
    throw error;
  }

  const updatedProduct = await Product.findOneAndUpdate(
    {
      _id: product._id,
      stock: { $gte: 1 },
      stock_quantity: { $gte: 1 },
    },
    {
      $inc: {
        stock: -1,
        stock_quantity: -1,
      },
    },
    { new: true }
  );

  if (!updatedProduct) {
    const error = new Error(`${product.name || product.title} stock changed. Please try again.`);
    error.statusCode = 400;
    throw error;
  }

  const firstMember = session.members[0]?.userId?._id || session.members[0]?.userId;
  let order;
  try {
    order = await Order.create({
    orderType: "collective",
    sessionId: session._id,
    productId: product._id,
    userId: firstMember,
    user_id: firstMember,
    buyer_id: firstMember,
    items: [
      {
        product_id: product._id,
        product_name: product.name || product.title,
        price: roundMoney(session.discountedPrice),
        quantity: 1,
      },
    ],
    order_items: [
      {
        product_id: product._id,
        product_name: product.name || product.title,
        price: roundMoney(session.discountedPrice),
        quantity: 1,
      },
    ],
    members: session.members.map((member) => ({
      userId: member.userId?._id || member.userId,
      quantity: member.quantity || 1,
      paidAmount: roundMoney(member.paidAmount),
      paidAt: member.paidAt,
      deliveryAddress: member.deliveryAddress,
    })),
    originalPrice: roundMoney(session.originalPrice),
    discountPercentage: session.currentDiscount,
    discountedPrice: roundMoney(session.discountedPrice),
    totalAmount: roundMoney(session.discountedPrice),
    total: roundMoney(session.discountedPrice),
    total_amount: roundMoney(session.discountedPrice),
    paymentStatus: "paid",
    payment_status: "paid",
    payment_method: "collective_split",
    status: "confirmed",
    });
  } catch (error) {
    if (error?.code === 11000) {
      order = await Order.findOne({ orderType: "collective", sessionId: session._id });
      if (order) {
        session.status = "completed";
        session.paymentStatus = "paid";
        session.orderId = order._id;
        session.completedAt = session.completedAt || new Date();
        await session.save();
        return order;
      }
    }

    await Product.findByIdAndUpdate(product._id, {
      $inc: {
        stock: 1,
        stock_quantity: 1,
      },
    }).catch(() => {});
    throw error;
  }

  session.status = "completed";
  session.paymentStatus = "paid";
  session.orderId = order._id;
  session.completedAt = new Date();
  await session.save();

  const productName = product.name || product.title;
  await notifyUsers([
    ...session.members.map((member) => ({
      userId: member.userId?._id || member.userId,
      type: "collective_order_confirmed",
      message: "Collective buying order has been confirmed.",
      relatedSessionId: session._id,
      isRead: false,
    })),
    ...(
      product.farmer_id
        ? [{
            userId: product.farmer_id,
            type: "collective_order_received",
            message: "New collective order received.",
            relatedSessionId: session._id,
            isRead: false,
          }]
        : []
    ),
    ...(
      product.sellerId && isValidObjectId(product.sellerId)
        ? [{
            userId: product.sellerId,
            type: "collective_order_received",
            message: "New collective order received.",
            relatedSessionId: session._id,
            isRead: false,
          }]
        : []
    ),
  ]);

  const admins = await User.find({ role: "admin" }).select("_id");
  if (admins.length) {
    await notifyUsers(admins.map((admin) => ({
      userId: admin._id,
      type: "collective_order_received",
      message: "New collective order received.",
      relatedSessionId: session._id,
      isRead: false,
    })));
  }

  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.CORS_ORIGIN;
  session.members.forEach((member) => {
    const user = member.userId;
    if (!user?.email) return;
    sendCollectiveOrderConfirmedEmail({
      email: user.email,
      name: user.name || user.full_name || user.email,
      productName,
      paidAmount: roundMoney(member.paidAmount),
      orderId: order._id,
      frontendUrl,
    }).catch((emailError) => {
      console.error("Collective order confirmation email failed:", emailError.message);
    });
  });

  return order;
};

export const getCollectiveProductPreview = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.productId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const session = await CollectiveSession.findOne({
      productId: product._id,
      status: "active",
      expiresAt: { $gt: new Date() },
    }).populate("productId");

    if (session) {
      await recalculateSession(session);
    }

    const totalMembers = session?.totalMembers || 1;
    const split = calculateSplitPayment({
      productPrice: Number(product.price || 0),
      totalMembers,
    });

    return res.json({
      success: true,
      productId: product.id,
      totalMembers,
      currentDiscount: split.discountPercentage,
      estimatedSplitAmount: split.perUserAmount,
      nextMilestone: split.nextMilestone,
      session: session ? shapeSession(session) : null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getActiveCollectiveSessionsForProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.productId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const sessions = await CollectiveSession.find({
      productId: product._id,
      status: "active",
      expiresAt: { $gt: new Date() },
    })
      .populate("productId", "name title image image_url price unit")
      .sort({ totalMembers: -1, updated_at: -1 })
      .limit(10);

    const shapedSessions = [];
    for (const session of sessions) {
      await recalculateSession(session);
      shapedSessions.push(shapeSession(session));
    }

    return res.json({
      success: true,
      productId: product.id,
      count: shapedSessions.length,
      totalMembers: shapedSessions.reduce((sum, session) => sum + Number(session.totalMembers || 0), 0),
      sessions: shapedSessions,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const sendCollectiveInvite = async (req, res) => {
  try {
    const { productId, product_id, receiverId, userId, email, username } = req.body;
    const normalizedProductId = productId || product_id;
    const normalizedReceiverId = receiverId || userId;

    if (!normalizedProductId || !isValidObjectId(normalizedProductId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const product = await Product.findById(normalizedProductId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (normalizedReceiverId && !isValidObjectId(normalizedReceiverId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const receiverQuery = normalizedReceiverId
      ? { _id: normalizedReceiverId }
      : {
          $or: [
            ...(email ? [{ email: String(email).trim().toLowerCase() }] : []),
            ...(username ? [{ name: username }, { full_name: username }] : []),
          ],
        };

    if (!normalizedReceiverId && !email && !username) {
      return res.status(400).json({ message: "Receiver user ID, email, or username is required" });
    }

    const receiver = await User.findOne(receiverQuery);
    if (!receiver) return res.status(404).json({ message: "Invited user not found" });

    if (receiver.id === req.user.id) {
      return res.status(400).json({ message: "You cannot invite yourself" });
    }

    const existingInvite = await CollectiveInvite.findOne({
      senderId: req.user.id,
      receiverId: receiver._id,
      productId: product._id,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (existingInvite) {
      return res.status(400).json({ message: "A pending invite already exists for this user and product" });
    }

    const session = await getOrCreateActiveSession({
      productId: product._id,
      createdBy: req.user.id,
    });

    const invite = await CollectiveInvite.create({
      senderId: req.user.id,
      receiverId: receiver._id,
      productId: product._id,
      sessionId: session._id,
      status: "pending",
      expiresAt: new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000),
    });

    const senderName = req.user.name || req.user.full_name || req.user.email || "A buyer";
    await Notification.create({
      userId: receiver._id,
      senderId: req.user.id,
      type: "collective_invite",
      message: "You have been invited for collective buying",
      relatedInviteId: invite._id,
      relatedSessionId: session._id,
    });

    sendCollectiveInviteEmail({
      email: receiver.email,
      receiverName: receiver.name || receiver.full_name || receiver.email,
      senderName,
      productName: product.name || product.title,
      productPrice: product.price,
      frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.CORS_ORIGIN,
      inviteId: invite._id,
    }).catch((emailError) => {
      console.error("Collective invite email failed:", emailError.message);
    });

    await invite.populate(["senderId", "receiverId", "productId", "sessionId"]);

    return res.status(201).json({
      success: true,
      message: "Invite sent successfully",
      invite,
      session: shapeSession(session),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "A pending invite already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

export const getCollectiveInvite = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.inviteId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const invite = await CollectiveInvite.findById(req.params.inviteId)
      .populate("senderId", "name full_name email avatar")
      .populate("receiverId", "name full_name email avatar")
      .populate("productId", "name title image image_url price unit")
      .populate("sessionId");

    if (!invite) return res.status(404).json({ message: "Invite not found" });

    const isReceiver = invite.receiverId?._id?.toString() === req.user.id;
    const isSender = invite.senderId?._id?.toString() === req.user.id;

    if (!isReceiver && !isSender) {
      return res.status(403).json({
        message: `This invite belongs to ${invite.receiverId?.email || "another user"}. Please login with the invited account.`,
      });
    }

    return res.json({
      success: true,
      invite: shapeInvite(invite),
      notification: isReceiver
        ? {
            id: `invite-${invite._id}`,
            type: "collective_invite",
            message: "You have been invited for collective buying",
            invite: shapeInvite(invite),
            sender: invite.senderId,
            relatedInviteId: invite._id,
            relatedSessionId: invite.sessionId?._id || invite.sessionId,
            isRead: false,
            created_at: invite.created_at,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const acceptCollectiveInvite = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.inviteId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const invite = await CollectiveInvite.findById(req.params.inviteId)
      .populate("productId")
      .populate("senderId");

    if (!invite) return res.status(404).json({ message: "Invite not found" });
    if (invite.receiverId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only accept invites sent to you" });
    }
    if (invite.status !== "pending") {
      return res.status(400).json({ message: `Invite is already ${invite.status}` });
    }
    if (invite.expiresAt < new Date()) {
      invite.status = "expired";
      await invite.save();
      return res.status(400).json({ message: "Invite has expired" });
    }

    let session = invite.sessionId
      ? await CollectiveSession.findById(invite.sessionId)
      : null;

    if (!session || session.status !== "active" || session.expiresAt < new Date()) {
      session = await getOrCreateActiveSession({
        productId: invite.productId._id,
        createdBy: invite.senderId._id,
      });
    }

    addMemberIfMissing(session, invite.senderId._id);
    addMemberIfMissing(session, invite.receiverId);
    await recalculateSession(session);

    invite.status = "accepted";
    invite.sessionId = session._id;
    await invite.save();

    await Notification.updateMany(
      { relatedInviteId: invite._id, userId: req.user.id },
      { isRead: true, relatedSessionId: session._id }
    );

    await Notification.create({
      userId: invite.senderId._id,
      senderId: req.user.id,
      type: "collective_invite_accepted",
      message: `${req.user.name || req.user.full_name || req.user.email} accepted your collective buying invite`,
      relatedInviteId: invite._id,
      relatedSessionId: session._id,
    });

    return res.json({
      success: true,
      message: "Invite accepted",
      session: shapeSession(await session.populate(["productId", "members.userId"])),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const rejectCollectiveInvite = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.inviteId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const invite = await CollectiveInvite.findById(req.params.inviteId).populate("senderId");

    if (!invite) return res.status(404).json({ message: "Invite not found" });
    if (invite.receiverId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only reject invites sent to you" });
    }
    if (invite.status !== "pending") {
      return res.status(400).json({ message: `Invite is already ${invite.status}` });
    }

    invite.status = "rejected";
    await invite.save();

    await Notification.updateMany(
      { relatedInviteId: invite._id, userId: req.user.id },
      { isRead: true }
    );

    await Notification.create({
      userId: invite.senderId._id,
      senderId: req.user.id,
      type: "collective_invite_rejected",
      message: `${req.user.name || req.user.full_name || req.user.email} rejected your collective buying invite`,
      relatedInviteId: invite._id,
      relatedSessionId: invite.sessionId,
    });

    return res.json({ success: true, message: "Invite rejected" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getCollectiveSession = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const session = await CollectiveSession.findById(req.params.id)
      .populate("productId")
      .populate("members.userId", "name full_name email avatar");

    if (!session) return res.status(404).json({ message: "Collective session not found" });
    if (session.expiresAt < new Date() && session.status === "active") {
      session.status = "expired";
      await session.save();
    }

    if (session.status === "active") await recalculateSession(session);

    return res.json({
      success: true,
      session: shapeSession(session),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMyCollectiveSessions = async (req, res) => {
  try {
    const sessions = await CollectiveSession.find({
      "members.userId": req.user.id,
    })
      .populate("productId", "name title image image_url price unit")
      .populate("members.userId", "name full_name email avatar")
      .populate("orderId")
      .sort({ updated_at: -1 })
      .limit(50);

    return res.json({
      success: true,
      sessions: sessions.map(shapeSession),
    });
  } catch (error) {
    console.error("Get my collective sessions failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getCollectiveCheckout = async (req, res) => {
  try {
    const { session, member } = await getSessionForMember(req.params.sessionId, req.user.id);
    ensureSessionCheckoutable(session);
    await recalculateSession(session);

    const product = session.productId;
    if (getStockValue(product) < 1) {
      return res.status(400).json({ message: `${product.name || product.title} is out of stock` });
    }

    return res.json({
      success: true,
      checkout: shapeCheckout(session, member),
    });
  } catch (error) {
    if (error.message === "This collective session has expired" && error.statusCode === 400) {
      await CollectiveSession.findByIdAndUpdate(req.params.sessionId, { status: "expired" }).catch(() => {});
    }
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Server error" });
  }
};

export const payCollectiveCheckout = async (req, res) => {
  try {
    const { session, member } = await getSessionForMember(req.params.sessionId, req.user.id);
    ensureSessionCheckoutable(session);
    await recalculateSession(session);

    if (member.paymentStatus === "paid") {
      return res.status(400).json({ message: "You have already paid for this collective checkout" });
    }

    const product = session.productId;
    if (getStockValue(product) < 1) {
      return res.status(400).json({ message: `${product.name || product.title} is out of stock` });
    }

    const { deliveryAddress = {}, paymentMethod = "cod" } = req.body;
    const requiredAddress = ["fullName", "phone", "addressLine1", "city", "state", "pincode"];
    const missingAddressField = requiredAddress.find((field) => !String(deliveryAddress[field] || "").trim());

    if (missingAddressField) {
      return res.status(400).json({ message: "Complete delivery address is required" });
    }

    if (!["cod", "mock_online"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    member.paymentStatus = "paid";
    member.paidAmount = roundMoney(session.perUserAmount);
    member.paidAt = new Date();
    member.deliveryAddress = {
      fullName: String(deliveryAddress.fullName).trim(),
      phone: String(deliveryAddress.phone).trim(),
      addressLine1: String(deliveryAddress.addressLine1).trim(),
      addressLine2: String(deliveryAddress.addressLine2 || "").trim(),
      city: String(deliveryAddress.city).trim(),
      state: String(deliveryAddress.state).trim(),
      pincode: String(deliveryAddress.pincode).trim(),
      country: String(deliveryAddress.country || "India").trim(),
    };

    const paidCount = session.members.filter((item) => item.paymentStatus === "paid").length;
    session.paymentStatus =
      paidCount === session.members.length
        ? "paid"
        : paidCount > 0
          ? "partially_paid"
          : "pending";

    await session.save();

    await Notification.create({
      userId: req.user.id,
      type: "collective_payment_recorded",
      message: "Your collective-buy payment has been recorded.",
      relatedSessionId: session._id,
      isRead: false,
    });

    let order = null;
    if (session.members.every((item) => item.paymentStatus === "paid")) {
      order = await createOrGetCollectiveOrder(session);
    }

    await session.populate([
      { path: "productId" },
      { path: "members.userId", select: "name full_name email avatar" },
      { path: "orderId" },
    ]);

    return res.json({
      success: true,
      message: order ? "Collective order completed" : "Payment recorded successfully",
      checkout: shapeCheckout(session, member),
      session: shapeSession(session),
      order,
      completed: Boolean(order),
    });
  } catch (error) {
    console.error("Collective checkout payment failed:", error);
    if (error.message === "This collective session has expired" && error.statusCode === 400) {
      await CollectiveSession.findByIdAndUpdate(req.params.sessionId, { status: "expired" }).catch(() => {});
    }
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Server error" });
  }
};

export const completeCollectiveCheckout = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const session = await CollectiveSession.findById(req.params.sessionId)
      .populate("productId")
      .populate("members.userId", "name full_name email avatar role");

    if (!session) return res.status(404).json({ message: "Collective session not found" });

    const isAdmin = req.user.role === "admin" || req.user.roles?.includes("admin");
    const isMember = session.members.some((member) => (member.userId?._id || member.userId).toString() === req.user.id);

    if (!isAdmin && !isMember) {
      return res.status(403).json({ message: "Not allowed to complete this session" });
    }

    if (!session.members.every((member) => member.paymentStatus === "paid")) {
      return res.status(400).json({ message: "All members must pay before completing this collective order" });
    }

    const order = await createOrGetCollectiveOrder(session);

    return res.json({
      success: true,
      message: "Collective order completed",
      order,
      session: shapeSession(session),
    });
  } catch (error) {
    console.error("Complete collective checkout failed:", error);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Server error" });
  }
};

export const listCollectiveBuys = async (req, res) => {
  try {
    const query = {};

    if (req.query.productId) query.productId = req.query.productId;
    if (req.query.area) query.area = new RegExp(`^${escapeRegex(req.query.area.trim())}$`, "i");
    if (req.query.status) query.status = req.query.status;
    if (req.query.sellerId) query.sellerId = req.query.sellerId;

    const groups = await CollectiveBuy.find(query)
      .populate("productId")
      .sort({ updated_at: -1 });

    return res.json({
      success: true,
      collectiveBuys: groups.map(shapeCollectiveBuy),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listMySellerCollectiveBuys = async (req, res) => {
  try {
    const groups = await CollectiveBuy.find({ sellerId: req.user.id })
      .populate("productId")
      .sort({ updated_at: -1 });

    return res.json({
      success: true,
      collectiveBuys: groups.map(shapeCollectiveBuy),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const joinCollectiveBuy = async (req, res) => {
  try {
    const { productId, product_id, area, quantity, targetQuantity } = req.body;
    const normalizedProductId = productId || product_id;
    const normalizedArea = String(area || "").trim();
    const qty = Number(quantity);

    if (!normalizedProductId || !normalizedArea || !qty || qty <= 0) {
      return res.status(400).json({
        message: "Product, area, and valid quantity are required",
      });
    }

    const product = await Product.findById(normalizedProductId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let group = await CollectiveBuy.findOne({
      productId: product._id,
      area: new RegExp(`^${escapeRegex(normalizedArea)}$`, "i"),
      status: { $ne: "closed" },
    });

    if (!group) {
      group = new CollectiveBuy({
        productId: product._id,
        productName: product.name || product.title,
        sellerId: product.sellerId || product.farmer_id?.toString?.() || "",
        area: normalizedArea,
        targetQuantity: Number(targetQuantity || product.min_order_quantity || 10),
        dealPrice: Number(product.price || 0) > 0 ? Math.round(Number(product.price) * 0.9) : 0,
        participants: [],
      });
    }

    const existing = group.participants.find(
      (participant) => participant.buyerId.toString() === req.user.id
    );

    if (existing) {
      existing.quantity += qty;
      existing.area = normalizedArea;
      existing.joinedAt = new Date();
    } else {
      group.participants.push({
        buyerId: req.user.id,
        buyerName: req.user.name || req.user.full_name || req.user.email,
        quantity: qty,
        area: normalizedArea,
      });
    }

    await group.save();
    await group.populate("productId");

    return res.status(201).json({
      success: true,
      message: "Collective buying request joined successfully",
      collectiveBuy: shapeCollectiveBuy(group),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateCollectiveBuyDeal = async (req, res) => {
  try {
    const { dealPrice, status } = req.body;
    const group = await CollectiveBuy.findOne({
      _id: req.params.id,
      sellerId: req.user.id,
    });

    if (!group) {
      return res.status(404).json({ message: "Collective buying group not found" });
    }

    if (dealPrice !== undefined) group.dealPrice = Number(dealPrice);
    if (status) group.status = status;

    await group.save();
    await group.populate("productId");

    return res.json({
      success: true,
      collectiveBuy: shapeCollectiveBuy(group),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
