import "./landing.css";

const formatMoney = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

export default function MockPaymentGatewayModal({
  payment,
  productName,
  onConfirm,
  onCancel,
  confirming,
}) {
  if (!payment) return null;

  return (
    <div className="cb-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cb-modal cb-payment-modal">
        <div className="cb-modal-head">
          <div>
            <span>Mock Online Payment</span>
            <h2>Mock Online Payment</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cancel mock payment">
            x
          </button>
        </div>

        <div className="cb-gateway-box">
          <div className="cb-qr-placeholder">
            <span />
            <strong>SCAN</strong>
            <small>Mock QR</small>
          </div>

          <div className="checkout-totals">
            <div className="checkout-total-row">
              <span>Product</span>
              <strong>{productName}</strong>
            </div>
            <div className="checkout-total-row checkout-grand">
              <span>Amount</span>
              <strong>{formatMoney(payment.amount)}</strong>
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

        <div className="cb-actions">
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
