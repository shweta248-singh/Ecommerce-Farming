import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CollectiveBuyModal from "../components/CollectiveBuyModal";
import { getCollectiveSession } from "../services/collectiveBuyService";
import "../components/landing.css";

export default function CollectiveSession() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const payload = await getCollectiveSession(id);
        if (isMounted) setSession(payload.session);
      } catch (err) {
        if (isMounted) setError(err.message || "Could not load collective session.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSession();
    const timer = setInterval(loadSession, 30000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [id]);

  if (loading) return <div className="orders-loading">Loading collective session...</div>;
  if (error) return <div className="orders-error">{error}</div>;
  if (!session) return null;

  const product = session.product || {};
  const members = session.members || [];
  const next = session.nextMilestone || {};
  const nextTarget = next.nextMembers || 10;
  const progress = Math.min(100, Math.round((Number(session.totalMembers || 1) / nextTarget) * 100));

  return (
    <section className="products-page-pro">
      <div className="products-container-pro">
        <div className="cb-session-layout">
          <div className="cb-session-media">
            <img src={product.image || product.image_url || "https://via.placeholder.com/800x600?text=AgroMitra"} alt={product.name || "Product"} />
          </div>

          <div className="cb-session-main">
            <span className="shop-tag">{session.status}</span>
            <h1>{product.name || product.title}</h1>
            <p>Buy Together & Save Up To 25%</p>

            <div className="cb-metrics cb-session-metrics">
              <div><span>Total Members</span><strong>{session.totalMembers}</strong></div>
              <div><span>Current Discount</span><strong>{session.currentDiscount}%</strong></div>
              <div><span>Original Price</span><strong>Rs.{session.originalPrice}</strong></div>
              <div><span>Discounted Price</span><strong>Rs.{session.discountedPrice}</strong></div>
              <div><span>Each User Pays</span><strong>Rs.{session.perUserAmount}</strong></div>
            </div>

            <div className="cb-progress">
              <div className="cb-progress-bar">
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>
                {next.membersNeeded > 0
                  ? `${next.membersNeeded} more user${next.membersNeeded === 1 ? "" : "s"} needed to unlock ${next.nextDiscount}%`
                  : "Maximum discount unlocked"}
              </p>
            </div>

            <div className="cb-member-row">
              {members.map((member) => {
                const name = member.userId?.name || member.userId?.full_name || member.userId?.email || "U";
                return (
                  <span key={member.userId?.id || member.userId?._id || name} title={name}>
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                );
              })}
            </div>

            <div className="cb-actions cb-session-actions">
              <button type="button" onClick={() => setShowInvite(true)}>Invite More</button>
              <Link className="cb-secondary" to="/products">Back to Products</Link>
            </div>
          </div>
        </div>
      </div>

      {showInvite && (
        <CollectiveBuyModal product={product} onClose={() => setShowInvite(false)} />
      )}
    </section>
  );
}
