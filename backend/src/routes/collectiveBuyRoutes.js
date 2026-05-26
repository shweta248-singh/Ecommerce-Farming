import express from "express";
import {
  acceptCollectiveInvite,
  getActiveCollectiveSessionsForProduct,
  getCollectiveProductPreview,
  getCollectiveInvite,
  getCollectiveSession,
  joinCollectiveBuy,
  listCollectiveBuys,
  listMySellerCollectiveBuys,
  rejectCollectiveInvite,
  sendCollectiveInvite,
  updateCollectiveBuyDeal,
} from "../controllers/collectiveBuyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", listCollectiveBuys);
router.get("/seller/mine", protect, authorizeRoles("seller"), listMySellerCollectiveBuys);
router.get("/preview/:productId", protect, authorizeRoles("buyer"), getCollectiveProductPreview);
router.get("/product/:productId/active", getActiveCollectiveSessionsForProduct);
router.get("/invite/:inviteId", protect, authorizeRoles("buyer"), getCollectiveInvite);
router.get("/session/:id", protect, authorizeRoles("buyer"), getCollectiveSession);
router.post("/send-invite", protect, authorizeRoles("buyer"), sendCollectiveInvite);
router.post("/accept/:inviteId", protect, authorizeRoles("buyer"), acceptCollectiveInvite);
router.post("/reject/:inviteId", protect, authorizeRoles("buyer"), rejectCollectiveInvite);
router.post("/join", protect, authorizeRoles("buyer"), joinCollectiveBuy);
router.patch("/:id", protect, authorizeRoles("seller"), updateCollectiveBuyDeal);

export default router;
