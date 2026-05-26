import QRCode from "qrcode";

const encodeUpiValue = (value) => encodeURIComponent(String(value ?? "").trim());

export const generateUpiPaymentString = ({
  upiId,
  merchantName,
  amount,
  transactionNote,
  transactionRef,
}) => {
  const cleanUpiId = String(upiId || "").trim();
  const cleanMerchantName = String(merchantName || "AgroMitra").trim();
  const cleanAmount = Number(amount || 0).toFixed(2);

  if (!cleanUpiId) {
    const error = new Error("Merchant UPI ID is not configured");
    error.statusCode = 500;
    throw error;
  }

  return [
    "upi://pay?",
    `pa=${encodeUpiValue(cleanUpiId)}`,
    `pn=${encodeUpiValue(cleanMerchantName)}`,
    `am=${encodeUpiValue(cleanAmount)}`,
    `tn=${encodeUpiValue(transactionNote || "CollectivePayment")}`,
    `tr=${encodeUpiValue(transactionRef)}`,
    "cu=INR",
  ].join("&").replace("?&", "?");
};

export const generateUpiQrCode = async (upiPaymentString) =>
  QRCode.toDataURL(upiPaymentString, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
  });

export const getMerchantUpiConfig = () => ({
  merchantUpiId: process.env.MERCHANT_UPI_ID || process.env.VITE_MERCHANT_UPI_ID || "",
  merchantName: process.env.MERCHANT_NAME || "AgroMitra",
});
