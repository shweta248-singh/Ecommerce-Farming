import { sendTransactionalEmail } from "../utils/sendEmail.js";

const formatAddress = (address = {}) =>
  [
    address.fullName,
    address.phone,
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");

export const sendCollectiveOrderEmail = async ({
  email,
  name,
  productName,
  orderId,
  originalPrice,
  discount,
  discountedPrice,
  perUserAmount,
  paymentStatus,
  paymentMethod,
  deliveryAddress,
  frontendUrl,
}) => {
  const appOrigin =
    String(frontendUrl || "").replace(/\/$/, "") ||
    "https://ecommerce-farming-frontend.onrender.com";
  const orderUrl = `${appOrigin}/collective/order/${orderId}`;

  return sendTransactionalEmail({
    to: email,
    subject: "AgroMitra Collective Order Confirmed",
    text: `Your collective buying order has been confirmed. Product: ${productName}. Order ID: ${orderId}.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="color:#15803d;">AgroMitra Collective Order Confirmed</h2>
        <p>Hi ${name || "AgroMitra user"},</p>
        <p>Your collective buying order has been confirmed.</p>
        <p><strong>Product:</strong> ${productName}</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Original price:</strong> Rs.${originalPrice}</p>
        <p><strong>Discount:</strong> ${discount}%</p>
        <p><strong>Final discounted price:</strong> Rs.${discountedPrice}</p>
        <p><strong>Each user payable amount:</strong> Rs.${perUserAmount}</p>
        <p><strong>Your payment:</strong> ${paymentStatus} (${paymentMethod})</p>
        <p><strong>Delivery address:</strong> ${formatAddress(deliveryAddress)}</p>
        <p>
          <a href="${orderUrl}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;">
            View Collective Order
          </a>
        </p>
      </div>
    `,
  });
};
