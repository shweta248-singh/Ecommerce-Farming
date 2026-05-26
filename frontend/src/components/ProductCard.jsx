import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/mongoClient'
import { useLanguage } from '../context/LanguageContext'
import CollectiveBuyModal from './CollectiveBuyModal'
import './landing.css'

const escapeSvgText = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const getProductFallbackImage = (name = 'Product') => {
  const label = escapeSvgText(name)

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#ecfdf5"/>
      <circle cx="400" cy="230" r="110" fill="#ffffff" opacity="0.9"/>
      <path d="M400 150 C455 185 465 265 400 315 C335 265 345 185 400 150Z" fill="#166534" opacity="0.82"/>
      <path d="M400 300 C440 265 490 275 535 320 C485 340 430 338 400 300Z" fill="#16a34a" opacity="0.58"/>
      <path d="M400 300 C360 265 310 275 265 320 C315 340 370 338 400 300Z" fill="#16a34a" opacity="0.58"/>
      <text x="400" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#111827">${label}</text>
      <text x="400" y="470" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="#166534">AgroMitra Product</text>
    </svg>
  `)}`
}

export default function ProductCard({ product }) {
  const [adding, setAdding] = useState(false)
  const [showCollectiveModal, setShowCollectiveModal] = useState(false)
  const navigate = useNavigate()
  const { t } = useLanguage()

  const image =
    product?.image ||
    product?.image_url ||
    getProductFallbackImage(product?.name)

  const unit = product?.unit || 'piece'
  const price = Number(product?.price || 0)
  const stock = Number(product?.stock ?? product?.stock_quantity ?? 0)
  const ratingCount = Number(product?.rating_count || product?.reviews_count || 0)
  const ratingAverage = Number(product?.rating_average || product?.rating || 0)
  const hasRating = ratingCount > 0 && ratingAverage > 0

  async function requireBuyerLogin() {
    const { data: userData, error: userError } = await db.auth.currentUser()
    if (userError) throw userError

    const user = userData?.user
    if (!user) {
      alert('Please login as buyer first.')
      navigate('/buyer-login')
      return null
    }

    return user
  }

  async function handleAddToCart(e) {
    e.stopPropagation()
    if (adding) return

    setAdding(true)

    try {
      const user = await requireBuyerLogin()
      if (!user) return

      const { data: existingItem, error: fetchError } = await db
        .from('cart')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (existingItem) {
        const nextQuantity = Number(existingItem.quantity || 0) + 1

        if (nextQuantity > stock) {
          alert(`Only ${stock} item${stock === 1 ? '' : 's'} available in stock`)
          return
        }

        const { error: updateError } = await db
          .from('cart')
          .update({ quantity: nextQuantity })
          .eq('id', existingItem.id)

        if (updateError) throw updateError
      } else {
        if (stock < 1) {
          alert(t('productsPage.outOfStock'))
          return
        }

        const { error: insertError } = await db.from('cart').insert({
          user_id: user.id,
          product_id: product.id,
          product_name: product.name,
          price,
          quantity: 1,
          image,
        })

        if (insertError) throw insertError
      }

      window.dispatchEvent(new Event('cartUpdated'))
      alert('Added to cart')
    } catch (error) {
      console.error('Add to cart error:', error)
      alert(error.message || 'Add to cart failed')
    } finally {
      setAdding(false)
    }
  }

  async function handleCollectiveBuy(e) {
    e.stopPropagation()

    try {
      const user = await requireBuyerLogin()
      if (user) setShowCollectiveModal(true)
    } catch (error) {
      alert(error.message || 'Please login to start a collective buy.')
    }
  }

  function handleProductClick() {
    navigate(`/product/${product.id}`)
  }

  return (
    <>
      <div className="shop-card" onClick={handleProductClick} style={{ cursor: 'pointer' }}>
        <div className="shop-img-box">
          <img
            src={image}
            alt={product?.name || 'Product'}
            onError={(event) => {
              event.currentTarget.onerror = null
              event.currentTarget.src = getProductFallbackImage(product?.name)
            }}
          />

          <button type="button" onClick={handleAddToCart} disabled={adding || stock < 1}>
            {adding ? 'Adding...' : t('productsPage.addToCart') || 'Add to Cart'}
          </button>
        </div>

        <div className="shop-info">
          <div className="shop-price">
            <span>
              Rs.{price} / {t(`common.units.${unit}`)}
            </span>
          </div>

          <h3>{product?.name}</h3>

          <p className="shop-pack">
            1 {t('product.pack')} ({stock} {t('product.in_stock')})
          </p>

          <span className="shop-tag">{product?.category || 'Agriculture'}</span>

          {hasRating && (
            <p className="shop-rating">Rating {ratingAverage.toFixed(1)} ({ratingCount})</p>
          )}

          <p className="cb-product-summary">
            <strong>Buy Together & Save Up To 25%</strong>
          </p>

          <button type="button" className="cb-card-button" onClick={handleCollectiveBuy}>
            Collective Buy
          </button>
        </div>
      </div>

      {showCollectiveModal && (
        <CollectiveBuyModal
          product={product}
          onClose={() => setShowCollectiveModal(false)}
        />
      )}
    </>
  )
}
