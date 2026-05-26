import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { db } from '../lib/mongoClient'
import { validateEmail, normalizeEmail } from '../utils/authUtils'
import { useLanguage } from '../context/LanguageContext'
import '../components/landing.css'

export default function BuyerLogin() {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return; // Prevent duplicate requests

    const normalizedEmail = normalizeEmail(email);
    if (!validateEmail(normalizedEmail)) {
      setError(t('auth.error_invalid_email'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 2. Authenticate with db
      const { data: authData, error: authError } = await db.auth.loginWithPassword({
        email: normalizedEmail,
        password,
        role: 'buyer',
      });

      // Proper error message for invalid credentials
      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          throw new Error(t('auth.error_invalid_credentials'));
        }
        throw authError;
      }

      // 3. Login ke baad authenticated user safely fetch karo
      const { data: { user }, error: userFetchError } = await db.auth.currentUser();
      if (userFetchError || !user) throw new Error(t('auth.error_auth_failed'));

      // Fetch profile to check role
      const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const userRole = profile?.role || 'buyer';
      const allowedRoles = ['buyer', 'both', 'admin'];

      // If user has a valid role for buyer login, proceed
      if (!allowedRoles.includes(userRole)) {
        // If they are a farmer but not "both", we could auto-upgrade or just allow if they came from buyer login
        // But the task says: "buyer login should allow roles: buyer, both, admin"
        throw new Error("You are not registered as a Buyer. Please register first.");
      }

      // Profiles table sync (upsert) - Use only 'role'
      const { error: upsertError } = await db
        .from('profiles')
        .upsert({ 
          id: user.id, 
          role: userRole,
          email: user.email,
          updated_at: new Date().toISOString()
        });
      
      if (upsertError) console.error("Profile sync error:", upsertError.message);

      // Store role as 'buyer' for this session
      localStorage.setItem('role', 'buyer');
      localStorage.setItem('user', JSON.stringify(user));
      if (authData.session) {
        localStorage.setItem('token', authData.session.access_token);
      }

      console.log("LOGIN SUCCESS. Navigating to: /");
      window.dispatchEvent(new Event('authChange'));
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirect');
      const safeRedirect =
        redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
          ? redirectTo
          : '/';
      navigate(safeRedirect);
    } catch (err) {
      setError(err.message || t('auth.error_generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="buyer-login-page">
      <div className="buyer-login-layout">
        <div className="buyer-login-visual">
          <img
            src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1600&q=80"
            alt="Buyer login"
            className="buyer-login-image"
          />
          <div className="buyer-login-overlay" />

          <div className="buyer-login-visual-content">
            <span className="buyer-login-badge">{t('auth.buyerLogin')}</span>
            <h1>{t('auth.shop_smarter')}</h1>
            <p>
              {t('auth.buyer_login_p')}
            </p>

            <div className="buyer-login-highlights">
              <div className="highlight-card">
                <h3>{t('auth.trusted_products')}</h3>
                <p>{t('auth.trusted_products_p')}</p>
              </div>

              <div className="highlight-card">
                <h3>{t('auth.fast_shopping')}</h3>
                <p>{t('auth.fast_shopping_p')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="buyer-login-form-side">
          <div className="buyer-login-card">
            <div className="buyer-login-top">
              <div className="buyer-login-icon">🛒</div>
              <span className="buyer-login-small-badge">{t('auth.welcome')}</span>
              <h2>{t('auth.buyerLogin')}</h2>
              <p>{t('auth.buyer_login_subtitle')}</p>
            </div>

            {error && <div className="buyer-login-error">{error}</div>}

            <form onSubmit={handleSubmit} className="buyer-login-form">
              <div className="buyer-form-group">
                <label>{t('auth.email')}</label>
                <input
                  type="email"
                  placeholder="buyer@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="buyer-form-group">
                <label>{t('auth.password')}</label>
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.password')}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? t('auth.hide') : t('auth.show')}
                  </button>
                </div>
              </div>

              <div className="buyer-login-row">
                <label className="remember-box">
                  <input type="checkbox" />
                  <span>{t('auth.rememberMe')}</span>
                </label>

                <Link to="/register" className="buyer-login-link">
                  {t('auth.createAccount')}
                </Link>

                <Link to="/forgot-password" title="Recover Password" style={{ color: '#10b981', fontSize: '14px', textDecoration: 'none', fontWeight: '500' }}>
                  {t('auth.forgotPassword') || 'Forgot Password?'}
                </Link>
              </div>

              <button type="submit" className="buyer-login-btn" disabled={loading}>
                {loading ? (
                  <div className="btn-loader-wrapper">
                    <div className="spinner mini"></div>
                    <span>{t('auth.loggingIn')}</span>
                  </div>
                ) : (
                  t('auth.login')
                )}
              </button>
            </form>

            <div className="buyer-login-bottom">
              <p>
                {t('auth.wantToSell')}{' '}
                <Link to="/seller-login">{t('auth.sellerLogin')}</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
