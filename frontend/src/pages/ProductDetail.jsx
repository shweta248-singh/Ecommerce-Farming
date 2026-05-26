import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/mongoClient';
import { useLanguage } from '../context/LanguageContext';
import CollectiveBuyModal from '../components/CollectiveBuyModal';
import { getCollectivePreview } from '../services/collectiveBuyService';
import '../components/landing.css';

const escapeSvgText = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getProductFallbackImage = (name = 'Product') => {
  const label = escapeSvgText(name);

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
  `)}`;
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showCollectiveModal, setShowCollectiveModal] = useState(false);
  const [collectivePreview, setCollectivePreview] = useState(null);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  async function fetchProduct() {
    setLoading(true);
    try {
      const { data, error } = await db
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      console.log("Product ID:", id);
      console.log("Product Data:", data);
      
      if (data) {
        setProduct(data);
        try {
          const preview = await getCollectivePreview(data.id);
          setCollectivePreview(preview);
        } catch {
          setCollectivePreview(null);
        }
      } else if (error) {
        console.error("Error fetching product:", error.message);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCart() {
    if (!product) return; // Cart Logic Fix
    const availableStock = Number(product.stock ?? product.stock_quantity ?? 0);

    if (availableStock < 1) {
      alert(t('productsPage.outOfStock'));
      return;
    }

    setAdding(true);

    try {
      const { data: userData } = await db.auth.currentUser();
      const user = userData?.user;

      if (!user) {
        alert(t('product.login_buyer'));
        return;
      }

      const { data: existingItem } = await db
        .from('cart')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existingItem) {
        const nextQuantity = Number(existingItem.quantity || 0) + 1;

        if (nextQuantity > availableStock) {
          alert(`Only ${availableStock} item${availableStock === 1 ? '' : 's'} available in stock`);
          return;
        }

        await db
          .from('cart')
          .update({ quantity: nextQuantity })
          .eq('id', existingItem.id);
      } else {
        await db.from('cart').insert({
          user_id: user.id,
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: 1,
          image: image,
        });
      }

      window.dispatchEvent(new Event('cartUpdated'));
      alert(t('product.added_cart'));
    } catch (error) {
      alert(error.message || t('product.add_failed'));
    } finally {
      setAdding(false);
    }
  }

  // Conditional Rendering Fix
  if (loading) return <div>{t('productsPage.loading')}</div>;
  if (!product) return <div className="products-empty-pro"><h2>{t('productsPage.not_found')}</h2></div>;

  const image =
    product?.image ||
    product?.image_url ||
    getProductFallbackImage(product?.name);
  const stock = Number(product.stock ?? product.stock_quantity ?? 0);

  return (
    <section className="products-page-pro">
      <div className="products-container-pro" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '40px', background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <div style={{ flex: '1' }}>
            <img 
              src={image} 
              alt={product.name} 
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = getProductFallbackImage(product?.name);
              }}
              style={{ width: '100%', borderRadius: '8px', objectFit: 'cover', aspectRatio: '1/1' }} 
            />
          </div>
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span className="shop-tag" style={{ display: 'inline-block', marginBottom: '10px' }}>
              {product.category || 'Agriculture'}
            </span>
            <h1 style={{ fontSize: '28px', color: '#1f2937', marginBottom: '15px' }}>{product.name}</h1>
            
            <div className="shop-price" style={{ fontSize: '24px', marginBottom: '20px' }}>
              <span>₹{product.price} / {t(`common.units.${product.unit || 'piece'}`)}</span>
            </div>
            
            <p style={{ color: '#4b5563', marginBottom: '25px', lineHeight: '1.6' }}>
              {product.description || t('product.default_desc')}
            </p>
            
            <p className="shop-pack" style={{ marginBottom: '30px' }}>
              {t('product.in_stock')}: {stock}
            </p>
            
            <button 
              onClick={handleAddToCart} 
              disabled={adding || stock < 1}
              style={{ 
                background: '#10b981', 
                color: 'white', 
                padding: '12px 24px', 
                border: 'none', 
                borderRadius: '6px', 
                fontSize: '16px', 
                fontWeight: 'bold',
                cursor: adding || stock < 1 ? 'not-allowed' : 'pointer',
                opacity: adding || stock < 1 ? 0.7 : 1
              }}
            >
              {adding ? t('productsPage.loading') : t('productsPage.addToCart')}
            </button>
            <button
              type="button"
              onClick={async () => {
                const { data: userData } = await db.auth.currentUser();
                if (!userData?.user) {
                  alert(t('product.login_buyer'));
                  navigate('/buyer-login');
                  return;
                }
                setShowCollectiveModal(true);
              }}
              style={{
                marginTop: '12px',
                background: '#f59e0b',
                color: '#111827',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Collective Buy
            </button>
            <p style={{ marginTop: '8px', color: '#92400e', fontWeight: 700 }}>
              Buy Together & Save Up To 25%
            </p>
            {collectivePreview && (
              <div className="cb-product-summary">
                <strong>Current Discount: {collectivePreview.currentDiscount || 0}%</strong>
                <span>
                  {collectivePreview.nextMilestone?.membersNeeded > 0
                    ? `${collectivePreview.nextMilestone.membersNeeded} more user${collectivePreview.nextMilestone.membersNeeded === 1 ? '' : 's'} needed to unlock ${collectivePreview.nextMilestone.nextDiscount}%`
                    : 'Maximum discount unlocked'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {showCollectiveModal && (
        <CollectiveBuyModal
          product={product}
          onClose={() => setShowCollectiveModal(false)}
        />
      )}
    </section>
  );
}
