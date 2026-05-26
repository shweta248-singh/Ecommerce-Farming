import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CollectiveBuyModal from '../components/CollectiveBuyModal'
import ProductCard from '../components/ProductCard'
import { db } from '../lib/mongoClient'
import { getActiveCollectiveSessionsForProduct } from '../services/collectiveBuyService'
import '../components/landing.css'

const getImage = (product) =>
  product?.image ||
  product?.image_url ||
  'https://via.placeholder.com/600x400?text=AgroMitra'

export default function CollectiveBuying() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [sessions, setSessions] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (selectedProductId) loadActiveSessions(selectedProductId)
  }, [selectedProductId])

  async function loadProducts() {
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await db
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const nextProducts = data || []
      setProducts(nextProducts)
      setSelectedProductId(nextProducts[0]?.id || '')
    } catch (error) {
      setMessage(error.message || 'Could not load collective buying products.')
    } finally {
      setLoading(false)
    }
  }

  async function loadActiveSessions(productId) {
    setSessionLoading(true)

    try {
      const payload = await getActiveCollectiveSessionsForProduct(productId)
      setSessions(payload.sessions || [])
    } catch {
      setSessions([])
    } finally {
      setSessionLoading(false)
    }
  }

  async function handleInviteClick() {
    const { data: userData } = await db.auth.currentUser()
    if (!userData?.user) {
      alert('Please login as buyer first.')
      navigate('/buyer-login')
      return
    }

    setShowInvite(true)
  }

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  )

  if (loading) {
    return (
      <section className="products-page-pro">
        <div className="products-container-pro">
          <div className="products-loading">
            <div className="loader-spinner"></div>
            <p>Loading collective buying...</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="products-page-pro">
      <div className="products-container-pro">
        <div className="products-hero-mini">
          <div>
            <span>Invite-based collective buying</span>
            <h1>Buy Together & Save Up To 25%</h1>
            <p>
              Choose a product, invite another AgroMitra user by username, email, or user ID, and let the backend unlock discounts as members join.
            </p>
          </div>
        </div>

        {message && (
          <div className="products-error-pro" style={{ marginBottom: 24 }}>
            <p>{message}</p>
          </div>
        )}

        <div className="category-product-section">
          <div className="category-section-head">
            <h2>Start an Invite</h2>
            <span>{selectedProduct ? selectedProduct.name : 'Select a product'}</span>
          </div>

          {products.length === 0 ? (
            <div className="products-empty-pro">
              <h2>No products available</h2>
              <p>Collective buying starts from a product listing.</p>
              <Link to="/products" className="orders-shop-btn">Browse Products</Link>
            </div>
          ) : (
            <div className="cb-product-picker">
              <label>
                Product
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - Rs.{product.price}/{product.unit || 'piece'}
                    </option>
                  ))}
                </select>
              </label>

              {selectedProduct && (
                <div className="cb-selected-product">
                  <img src={getImage(selectedProduct)} alt={selectedProduct.name} />
                  <div>
                    <strong>{selectedProduct.name}</strong>
                    <span>Rs.{selectedProduct.price} / {selectedProduct.unit || 'piece'}</span>
                    <p>Discount and equal split are calculated only by the backend.</p>
                  </div>
                </div>
              )}

              <button type="button" onClick={handleInviteClick}>
                Collective Buy
              </button>
            </div>
          )}
        </div>

        <div className="category-product-section mt-12">
          <div className="category-section-head">
            <h2>Active Sessions</h2>
            <span>{sessionLoading ? 'Refreshing...' : `${sessions.length} for selected product`}</span>
          </div>

          {sessions.length === 0 ? (
            <div className="products-empty-pro">
              <h2>No active invite sessions yet</h2>
              <p>Send an invite to create the first collective buying session for this product.</p>
            </div>
          ) : (
            <div className="orders-list">
              {sessions.map((session) => {
                const product = session.product || selectedProduct || {}
                const next = session.nextMilestone || {}

                return (
                  <div key={session.id} className="order-card">
                    <div className="order-card-top">
                      <div>
                        <strong>{product.name || product.title}</strong>
                        <p>Current Discount: {session.currentDiscount || 0}%</p>
                        <small>
                          Each User Pays: Rs.{session.perUserAmount || product.price || 0}
                        </small>
                      </div>
                      <span>{session.totalMembers || 1} members</span>
                    </div>
                    <p>
                      {next.membersNeeded > 0
                        ? `Add ${next.membersNeeded} more user${next.membersNeeded === 1 ? '' : 's'} to unlock ${next.nextDiscount}% OFF`
                        : 'Maximum discount unlocked'}
                    </p>
                    <Link className="orders-shop-btn" to={`/collective/session/${session.id}`}>
                      View Session
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="category-product-section mt-12">
          <div className="category-section-head">
            <h2>Products Ready For Collective Buy</h2>
            <span>{products.length} items</span>
          </div>

          <div className="shop-products-row">
            {products.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>

      {showInvite && selectedProduct && (
        <CollectiveBuyModal
          product={selectedProduct}
          onClose={() => {
            setShowInvite(false)
            loadActiveSessions(selectedProduct.id)
          }}
        />
      )}
    </section>
  )
}
