import { useState } from "react";
import "./landing.css";

const formatMoney = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

export default function MockPaymentGatewayModal({
  payment,
  productName,
  onConfirm,
  onCancel,
  confirming,
}) {
  const [copied, setCopied] = useState(false);

  if (!payment) return null;

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(payment.merchantUpiId || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function openUpiApp() {
    if (payment.upiPaymentString) {
      window.location.href = payment.upiPaymentString;
    }
  }

  return (
    <div className="cb-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cb-modal cb-payment-modal">
        <div className="cb-modal-head">
          <div>
            <span>UPI Payment</span>
            <h2>Mock Online Payment</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cancel UPI payment">
            x
          </button>
        </div>

        <div className="cb-upi-amount">
          <span>Amount to Pay</span>
          <strong>{formatMoney(payment.amount)}</strong>
        </div>

        <div className="cb-gateway-box">
          <div className="cb-real-qr-card">
            {payment.qrCodeDataUrl ? (
              <img src={payment.qrCodeDataUrl} alt="UPI QR Code" />
            ) : (
              <div className="cb-qr-missing">QR unavailable</div>
            )}
            <small>Scan with GPay, PhonePe, Paytm, BHIM or any UPI app</small>
          </div>

          <div className="checkout-totals">
            <div className="checkout-total-row">
              <span>Product</span>
              <strong>{productName}</strong>
            </div>
            <div className="checkout-total-row">
              <span>Merchant</span>
              <strong>{payment.merchantName || "AgroMitra"}</strong>
            </div>
            <div className="checkout-total-row">
              <span>UPI ID</span>
              <span>{payment.merchantUpiId}</span>
            </div>
            <div className="checkout-total-row">
              <span>Session ID</span>
              <span>{payment.sessionId}</span>
            </div>
            <div className="checkout-total-row">
              <span>Payment Ref</span>
              <span>{payment.paymentReference}</span>
            </div>
          </div>
        </div>

        <div className="cb-actions cb-upi-actions">
          <button type="button" className="cb-secondary" onClick={copyUpiId}>
            {copied ? "UPI ID Copied" : "Copy UPI ID"}
          </button>
          <button type="button" className="cb-secondary" onClick={openUpiApp}>
            Open UPI App
          </button>
          <button type="button" className="cb-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={confirming}>
            {confirming ? "Confirming..." : "I Have Paid"}
          </button>
        </div>
      </div>
    </div>
  );
}
