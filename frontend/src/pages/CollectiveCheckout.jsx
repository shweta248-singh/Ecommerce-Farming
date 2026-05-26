import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getCollectiveCheckout,
  payCollectiveCheckout,
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

export default function CollectiveCheckout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [checkout, setCheckout] = useState(null);
  const [address, setAddress] = useState(emptyAddress);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
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

  async function handlePayment(event) {
    event.preventDefault();
    setPaying(true);
    setMessage("");

    try {
      const payload = await payCollectiveCheckout(id, {
        deliveryAddress: address,
        paymentMethod,
      });

      setCheckout(payload.checkout);
      setMessage(payload.message || "Payment recorded successfully");
      window.dispatchEvent(new Event("notificationsUpdated"));

      if (payload.completed) {
        setTimeout(() => navigate(`/collective/session/${id}`), 900);
      }
    } catch (error) {
      setMessage(error.message || "Payment could not be recorded.");
    } finally {
      setPaying(false);
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
  const alreadyPaid = checkout.currentUserPaymentStatus === "paid";

  return (
    <section className="orders-page">
      <div className="orders-container">
        <div className="orders-header">
          <span>Collective Checkout</span>
          <h1>Collective Checkout</h1>
          <p>Confirm your share for this collective buying session.</p>
        </div>

        {message && (
          <div className={message.toLowerCase().includes("success") || message.toLowerCase().includes("completed") ? "orders-success" : "orders-error"}>
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
              <div className="checkout-total-row"><span>Your Payment Status</span><span className={`cb-pay-badge ${alreadyPaid ? "paid" : ""}`}>{checkout.currentUserPaymentStatus}</span></div>
            </div>
          </div>

          <form className="checkout-card cb-checkout-form" onSubmit={handlePayment}>
            <h2 className="checkout-card-title">Delivery Address</h2>
            <div className="cb-address-grid">
              <input value={address.fullName} onChange={(e) => updateAddress("fullName", e.target.value)} placeholder="Full name" required />
              <input value={address.phone} onChange={(e) => updateAddress("phone", e.target.value)} placeholder="Phone number" required />
              <input value={address.addressLine1} onChange={(e) => updateAddress("addressLine1", e.target.value)} placeholder="Address line 1" required />
              <input value={address.addressLine2} onChange={(e) => updateAddress("addressLine2", e.target.value)} placeholder="Address line 2" />
              <input value={address.city} onChange={(e) => updateAddress("city", e.target.value)} placeholder="City" required />
              <input value={address.state} onChange={(e) => updateAddress("state", e.target.value)} placeholder="State" required />
              <input value={address.pincode} onChange={(e) => updateAddress("pincode", e.target.value)} placeholder="Pincode" required />
              <input value={address.country} onChange={(e) => updateAddress("country", e.target.value)} placeholder="Country" required />
            </div>

            <h2 className="checkout-card-title">Payment Method</h2>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={alreadyPaid}>
              <option value="cod">Cash on Delivery</option>
              <option value="mock_online">Mock Online Payment</option>
            </select>

            <button type="submit" className="checkout-place-btn" disabled={paying || alreadyPaid}>
              {alreadyPaid ? "Payment Already Recorded" : paying ? "Recording Payment..." : "Confirm My Payment"}
            </button>

            {checkout.allMembersPaid && (
              <p className="cb-complete-note">Collective order completed.</p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
