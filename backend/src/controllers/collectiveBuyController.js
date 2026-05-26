import CollectiveBuy from "../models/CollectiveBuy.js";
import CollectiveInvite from "../models/CollectiveInvite.js";
import CollectiveSession from "../models/CollectiveSession.js";
import Notification from "../models/Notification.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { getNextDiscountMilestone } from "../services/discountService.js";
import { calculateSplitPayment } from "../services/splitPaymentService.js";

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
