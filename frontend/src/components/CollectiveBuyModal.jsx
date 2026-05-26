import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCollectivePreview,
  sendCollectiveInvite,
} from "../services/collectiveBuyService";

export default function CollectiveBuyModal({ product, onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", userId: "" });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      try {
        const productId = product.id || product._id;
        const payload = await getCollectivePreview(productId);
        if (isMounted) setPreview(payload);
      } catch (error) {
        if (isMounted) setMessage(error.message || "Could not load collective buy details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPreview();
    return () => {
      isMounted = false;
    };
  }, [product.id, product._id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSending(true);
    setMessage("");

    try {
      if (!localStorage.getItem("token")) {
        setMessage("Please login before sending a collective buying invite.");
        navigate("/buyer-login");
        return;
      }

      if (!form.username.trim() && !form.email.trim() && !form.userId.trim()) {
        setMessage("Enter a username, email, or user ID to invite.");
        return;
      }

      const payload = await sendCollectiveInvite({
        productId: product.id || product._id,
        username: form.username.trim() || undefined,
        email: form.email.trim() || undefined,
        userId: form.userId.trim() || undefined,
      });

      setMessage("Invite sent successfully.");

      if (payload.session?.id) {
        setTimeout(() => navigate(`/collective/session/${payload.session.id}`), 600);
      }
    } catch (error) {
      setMessage(error.message || "Invite failed.");
    } finally {
      setSending(false);
    }
  }

  const next = preview?.nextMilestone;

  return (
    <div className="cb-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cb-modal">
        <div className="cb-modal-head">
          <div>
            <span>Buy Together & Save Up To 25%</span>
            <h2>Collective Buy</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close collective buy modal">
            x
          </button>
        </div>

        {loading ? (
          <div className="cb-muted">Loading collective details...</div>
        ) : (
          <div className="cb-metrics">
            <div>
              <span>Current Discount</span>
              <strong>{preview?.currentDiscount || 0}%</strong>
            </div>
            <div>
              <span>Members</span>
              <strong>{preview?.totalMembers || 1}</strong>
            </div>
            <div>
              <span>Estimated Split</span>
              <strong>₹{preview?.estimatedSplitAmount || Number(product.price || 0)}</strong>
            </div>
          </div>
        )}

        {next && (
          <p className="cb-next">
            {next.membersNeeded > 0
              ? `${next.membersNeeded} more user${next.membersNeeded === 1 ? "" : "s"} needed to unlock ${next.nextDiscount}%`
              : "Maximum discount unlocked"}
          </p>
        )}

        <form onSubmit={handleSubmit} className="cb-form">
          <label>
            Username
            <input
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="Invite by username"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="buyer@example.com"
            />
          </label>
          <label>
            User ID
            <input
              value={form.userId}
              onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
              placeholder="Mongo user id"
            />
          </label>

          {message && <div className="cb-message">{message}</div>}

          <div className="cb-actions">
            <button type="button" className="cb-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
