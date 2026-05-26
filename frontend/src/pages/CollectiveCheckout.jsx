import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MockPaymentGatewayModal from "../components/MockPaymentGatewayModal";
import {
  confirmCollectiveCod,
  confirmCollectiveOnlinePayment,
  getCollectiveCheckout,
  startCollectiveOnlinePayment,
} from "../services/collectiveBuyService";
import "../components/landing.css";

const emptyAddress = {
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
};

const formatMoney = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const statusLabel = (status) => {
  if (status === "paid") return "Paid";
  if (status === "cod_confirmed") return "COD Confirmed";
  return "Pending";
};

export default function CollectiveCheckout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [checkout, setCheckout] = useState(null);
  const [address, setAddress] = useState(emptyAddress);
  const [paymentMethod, setPaymentMethod] = useState("mock_online");
  const [mockPayment, setMockPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadCheckout();
  }, [id]);

  async function loadCheckout() {
    setLoading(true);
    setMessage("");

    try {
      const payload = await getCollectiveCheckout(id);
      const nextCheckout = payload.checkout;
      setCheckout(nextCheckout);

      if (nextCheckout?.deliveryAddress) {
        setAddress((prev) => ({ ...prev, ...nextCheckout.deliveryAddress }));
      }
    } catch (error) {
      setMessage(error.message || "Could not load collective checkout.");
    } finally {
      setLoading(false);
    }
  }

  function updateAddress(field, value) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  function validateAddress() {
    const required = ["fullName", "phone", "addressLine1", "city", "state", "pincode"];
    const missing = required.find((field) => !String(address[field] || "").trim());
    if (missing) {
      setMessage("Complete delivery address is required.");
      return false;
    }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!validateAddress()) return;

    if (paymentMethod === "cash_on_delivery") {
      const ok = window.confirm(`Are you sure you want to confirm Cash on Delivery for ${formatMoney(checkout.perUserAmount)}?`);
      if (!ok) return;
      await confirmCod();
      return;
    }

    await openMockGateway();
  }

  async function openMockGateway() {
    setProcessing(true);
    try {
      const payload = await startCollectiveOnlinePayment(id);
      if (payload.alreadyConfirmed) {
        await loadCheckout();
        setMessage("Payment Already Recorded");
        return;
      }
      setMockPayment(payload);
    } catch (error) {
      setMessage(error.message || "Could not start mock online payment.");
    } finally {
      setProcessing(false);
    }
  }

  async function confirmOnlinePayment() {
    setProcessing(true);
    setMessage("");

    try {
      const payload = await confirmCollectiveOnlinePayment(id, {
        deliveryAddress: address,
        paymentReference: mockPayment?.paymentReference,
      });

      setMockPayment(null);
      setCheckout(payload.checkout);
      window.dispatchEvent(new Event("notificationsUpdated"));

      if (payload.completed && payload.order?.id) {
        navigate(`/collective/order/${payload.order.id}`);
        return;
      }

      setMessage(payload.message || "Online payment confirmed successfully");
    } catch (error) {
      setMessage(error.message || "Online payment could not be confirmed.");
    } finally {
      setProcessing(false);
    }
  }

  async function confirmCod() {
    setProcessing(true);
    setMessage("");

    try {
      const payload = await confirmCollectiveCod(id, { deliveryAddress: address });
      setCheckout(payload.checkout);
      window.dispatchEvent(new Event("notificationsUpdated"));

      if (payload.completed && payload.order?.id) {
        navigate(`/collective/order/${payload.order.id}`);
        return;
      }

      setMessage(payload.message || "COD confirmed. Your share will be collected on delivery.");
    } catch (error) {
      setMessage(error.message || "COD could not be confirmed.");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <div className="orders-loading">Loading collective checkout...</div>;

  if (!checkout) {
    return (
      <section className="orders-page">
        <div className="orders-container">
          {message && <div className="orders-error">{message}</div>}
          <Link to="/collective-buying" className="orders-shop-btn">Back to Collective Buying</Link>
        </div>
      </section>
    );
  }

  const product = checkout.product || checkout.session?.product || {};
  const status = checkout.currentUserPaymentStatus || "pending";
  const isConfirmed = status === "paid" || status === "cod_confirmed";

  return (
    <section className="orders-page">
      <div className="orders-container">
        <div className="orders-header">
          <span>Collective Checkout</span>
          <h1>Collective Checkout</h1>
          <p>Confirm your share for this collective buying session.</p>
        </div>

        {message && (
          <div className={message.toLowerCase().includes("confirmed") || message.toLowerCase().includes("recorded") ? "orders-success" : "orders-error"}>
            {message}
          </div>
        )}

        <div className="cb-checkout-grid">
          <div className="checkout-card">
            <h2 className="checkout-card-title">Product Summary</h2>
            <div className="cb-checkout-product">
              <img
                src={product.image || product.image_url || "https://via.placeholder.com/500x400?text=AgroMitra"}
                alt={product.name || product.title || "Product"}
              />
              <div>
                <strong>{product.name || product.title}</strong>
                <span>{formatMoney(product.price)} / {product.unit || "piece"}</span>
              </div>
            </div>
          </div>

          <div className="checkout-card">
            <h2 className="checkout-card-title">Discount Summary</h2>
            <div className="checkout-totals">
              <div className="checkout-total-row"><span>Original Price</span><span>{formatMoney(checkout.originalPrice)}</span></div>
              <div className="checkout-total-row"><span>Discount %</span><span>{checkout.currentDiscount}%</span></div>
              <div className="checkout-total-row checkout-grand"><span>Discounted Price</span><strong>{formatMoney(checkout.discountedPrice)}</strong></div>
            </div>
          </div>

          <div className="checkout-card">
            <h2 className="checkout-card-title">Payment Split Summary</h2>
            <div className="checkout-totals">
              <div className="checkout-total-row"><span>Total Members</span><span>{checkout.totalMembers}</span></div>
              <div className="checkout-total-row checkout-grand"><span>Each User Pays</span><strong>{formatMoney(checkout.perUserAmount)}</strong></div>
              <div className="checkout-total-row">
                <span>Your Payment Status</span>
                <span className={`cb-pay-badge ${isConfirmed ? "paid" : ""}`}>{statusLabel(status)}</span>
              </div>
            </div>
          </div>

          <div className="checkout-card">
            <h2 className="checkout-card-title">Members Payment Status</h2>
            <div className="cb-member-status-list">
              {(checkout.members || []).map((member) => (
                <div key={member.userId} className="checkout-total-row">
                  <span>{member.name}</span>
                  <strong>{statusLabel(member.paymentStatus)}</strong>
                </div>
              ))}
            </div>
          </div>

          <form className="checkout-card cb-checkout-form" onSubmit={handleSubmit}>
            <h2 className="checkout-card-title">Delivery Address</h2>
            <div className="cb-address-grid">
              <input value={address.fullName} onChange={(e) => updateAddress("fullName", e.target.value)} placeholder="Full name" required disabled={isConfirmed} />
              <input value={address.phone} onChange={(e) => updateAddress("phone", e.target.value)} placeholder="Phone number" required disabled={isConfirmed} />
              <input value={address.addressLine1} onChange={(e) => updateAddress("addressLine1", e.target.value)} placeholder="Address line 1" required disabled={isConfirmed} />
              <input value={address.addressLine2} onChange={(e) => updateAddress("addressLine2", e.target.value)} placeholder="Address line 2" disabled={isConfirmed} />
              <input value={address.city} onChange={(e) => updateAddress("city", e.target.value)} placeholder="City" required disabled={isConfirmed} />
              <input value={address.state} onChange={(e) => updateAddress("state", e.target.value)} placeholder="State" required disabled={isConfirmed} />
              <input value={address.pincode} onChange={(e) => updateAddress("pincode", e.target.value)} placeholder="Pincode" required disabled={isConfirmed} />
              <input value={address.country} onChange={(e) => updateAddress("country", e.target.value)} placeholder="Country" required disabled={isConfirmed} />
            </div>

            <h2 className="checkout-card-title">Payment Method</h2>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={isConfirmed}>
              <option value="mock_online">Mock Online Payment</option>
              <option value="cash_on_delivery">Cash on Delivery</option>
            </select>

            <button type="submit" className="checkout-place-btn" disabled={processing || isConfirmed}>
              {isConfirmed
                ? "Payment Already Recorded"
                : processing
                  ? "Please wait..."
                  : paymentMethod === "mock_online"
                    ? "Proceed to Online Payment"
                    : "Confirm COD Order"}
            </button>

            {status === "cod_confirmed" && (
              <p className="cb-complete-note">COD confirmed. Your share will be collected on delivery.</p>
            )}
            {checkout.allMembersConfirmed && (
              <p className="cb-complete-note">All members have confirmed. Collective order is ready.</p>
            )}
          </form>
        </div>
      </div>

      <MockPaymentGatewayModal
        payment={mockPayment}
        productName={product.name || product.title}
        confirming={processing}
        onCancel={() => setMockPayment(null)}
        onConfirm={confirmOnlinePayment}
      />
    </section>
  );
}
