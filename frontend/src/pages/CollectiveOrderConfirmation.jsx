import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCollectiveOrder } from "../services/collectiveBuyService";
import "../components/landing.css";

const formatMoney = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const statusText = (member) => {
  if (member.paymentStatus === "paid") return "Paid Online";
  if (member.paymentStatus === "cod_confirmed") return "COD Confirmed";
  return "Pending";
};

const addressText = (address = {}) =>
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

export default function CollectiveOrderConfirmation() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrder() {
      try {
        const payload = await getCollectiveOrder(orderId);
        setOrder(payload.order);
      } catch (err) {
        setError(err.message || "Could not load collective order.");
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  if (loading) return <div className="orders-loading">Loading collective order...</div>;
  if (error) return <div className="orders-error">{error}</div>;
  if (!order) return null;

  const product = order.productId || {};

  return (
    <section className="orders-page">
      <div className="orders-container">
        <div className="orders-header">
          <span>Order confirmed</span>
          <h1>Collective Order Confirmed</h1>
          <p>Your collective buying order has been confirmed.</p>
        </div>

        <div className="cb-order-confirm-grid">
          <div className="checkout-card">
            <h2 className="checkout-card-title">Product</h2>
            <div className="cb-checkout-product">
              <img
                src={product.image || product.image_url || "https://via.placeholder.com/500x400?text=AgroMitra"}
                alt={product.name || product.title || "Product"}
              />
              <div>
                <strong>{product.name || product.title}</strong>
                <span>Order ID: {order.id || order._id}</span>
              </div>
            </div>
          </div>

          <div className="checkout-card">
            <h2 className="checkout-card-title">Order Summary</h2>
            <div className="checkout-totals">
              <div className="checkout-total-row"><span>Original Price</span><span>{formatMoney(order.originalPrice)}</span></div>
              <div className="checkout-total-row"><span>Discount</span><span>{order.discountPercentage}%</span></div>
              <div className="checkout-total-row"><span>Total Amount</span><span>{formatMoney(order.totalAmount || order.total_amount)}</span></div>
              <div className="checkout-total-row checkout-grand"><span>Order Payment Status</span><strong>{order.paymentStatus || order.payment_status}</strong></div>
            </div>
          </div>

          <div className="checkout-card cb-checkout-form">
            <h2 className="checkout-card-title">Members</h2>
            <div className="orders-list">
              {(order.members || []).map((member) => (
                <div key={member.userId?.id || member.userId?._id || member.userId} className="order-card">
                  <div className="order-card-top">
                    <div>
                      <strong>{member.userId?.name || member.userId?.full_name || member.userId?.email || "Member"}</strong>
                      <p>{statusText(member)} · Payable {formatMoney(member.payableAmount)}</p>
                      <small>{addressText(member.deliveryAddress)}</small>
                    </div>
                    <span>{member.paymentMethod || "pending"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link to="/collective-buying" className="orders-shop-btn">Back to Collective Buying</Link>
      </div>
    </section>
  );
}
