import { apiRequest } from "../lib/mongoClient";

export const getCollectivePreview = (productId) =>
  apiRequest(`/collective-buy/preview/${productId}`);

export const getActiveCollectiveSessionsForProduct = (productId) =>
  apiRequest(`/collective-buy/product/${productId}/active`);

export const sendCollectiveInvite = (payload) =>
  apiRequest("/collective-buy/send-invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const acceptCollectiveInvite = (inviteId) =>
  apiRequest(`/collective-buy/accept/${inviteId}`, {
    method: "POST",
  });

export const rejectCollectiveInvite = (inviteId) =>
  apiRequest(`/collective-buy/reject/${inviteId}`, {
    method: "POST",
  });

export const getCollectiveInvite = (inviteId) =>
  apiRequest(`/collective-buy/invite/${inviteId}`);

export const getCollectiveSession = (sessionId) =>
  apiRequest(`/collective-buy/session/${sessionId}`);
