import express from "express";
import {
  acceptCollectiveInvite,
  completeCollectiveCheckout,
  confirmCollectiveCod,
  confirmCollectiveOnlinePayment,
  getActiveCollectiveSessionsForProduct,
  getCollectiveCheckout,
  getCollectiveProductPreview,
  getCollectiveInvite,
  getCollectiveOrder,
  getCollectiveSession,
  getMyCollectiveSessions,
  joinCollectiveBuy,
  listCollectiveBuys,
  listMySellerCollectiveBuys,
  rejectCollectiveInvite,
  payCollectiveCheckout,
  sendCollectiveInvite,
  startCollectiveOnlinePayment,
  updateCollectiveBuyDeal,
} from "../controllers/collectiveBuyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", listCollectiveBuys);
router.get("/seller/mine", protect, authorizeRoles("seller"), listMySellerCollectiveBuys);
router.get("/my-sessions", protect, authorizeRoles("buyer"), getMyCollectiveSessions);
router.get("/preview/:productId", protect, authorizeRoles("buyer"), getCollectiveProductPreview);
router.get("/product/:productId/active", getActiveCollectiveSessionsForProduct);
router.get("/invite/:inviteId", protect, authorizeRoles("buyer"), getCollectiveInvite);
router.get("/order/:orderId", protect, authorizeRoles("buyer", "admin"), getCollectiveOrder);
router.get("/session/:id", protect, authorizeRoles("buyer"), getCollectiveSession);
router.get("/checkout/:sessionId", protect, authorizeRoles("buyer"), getCollectiveCheckout);
router.post("/send-invite", protect, authorizeRoles("buyer"), sendCollectiveInvite);
router.post("/accept/:inviteId", protect, authorizeRoles("buyer"), acceptCollectiveInvite);
router.post("/reject/:inviteId", protect, authorizeRoles("buyer"), rejectCollectiveInvite);
router.post("/checkout/:sessionId/start-online-payment", protect, authorizeRoles("buyer"), startCollectiveOnlinePayment);
router.post("/checkout/:sessionId/confirm-online-payment", protect, authorizeRoles("buyer"), confirmCollectiveOnlinePayment);
router.post("/checkout/:sessionId/confirm-cod", protect, authorizeRoles("buyer"), confirmCollectiveCod);
router.post("/checkout/:sessionId/pay", protect, authorizeRoles("buyer"), payCollectiveCheckout);
router.post("/checkout/:sessionId/complete", protect, authorizeRoles("buyer", "admin"), completeCollectiveCheckout);
router.post("/join", protect, authorizeRoles("buyer"), joinCollectiveBuy);
router.patch("/:id", protect, authorizeRoles("seller"), updateCollectiveBuyDeal);

export default router;
