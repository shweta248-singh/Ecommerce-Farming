import { sendMail } from "../config/mailer.js";

const getEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
};

const extractEmailAddress = (value = "") => {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
};

const getBrevoApiKey = () => getEnv("BREVO_API_KEY", "SENDINBLUE_API_KEY");
const getResendApiKey = () => getEnv("RESEND_API_KEY");
const getSendGridApiKey = () => getEnv("SENDGRID_API_KEY");

const buildOtpEmail = (otp) => ({
  subject: "AgroMitra OTP Verification",
  text: `Your AgroMitra OTP is ${otp}. It is valid for 5 minutes.`,
  html: `
    <div style="font-family: Arial, sans-serif;">
      <h2>AgroMitra OTP Verification</h2>
      <p>Your OTP for registration is:</p>
      <h1 style="letter-spacing: 5px;">${otp}</h1>
      <p>This OTP is valid for 5 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `,
});

const sendViaResend = async ({ to, subject, html, text }) => {
  const apiKey = getResendApiKey();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || process.env.SMTP_FROM || "AgroMitra <onboarding@resend.dev>",
      to,
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Resend email API failed");
  }

  return data;
};

const sendViaBrevo = async ({ to, subject, html, text }) => {
  const apiKey = getBrevoApiKey();
  const senderEmail = extractEmailAddress(
    getEnv("BREVO_SENDER_EMAIL", "EMAIL_FROM", "SMTP_FROM", "SMTP_USER")
  );
  const senderName = getEnv("BREVO_SENDER_NAME", "EMAIL_FROM_NAME") || "AgroMitra";

  if (!senderEmail) {
    throw new Error("Brevo sender email is missing. Set BREVO_SENDER_EMAIL or EMAIL_FROM.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Brevo email API failed");
  }

  return data;
};

const sendViaSendGrid = async ({ to, subject, html, text }) => {
  const senderEmail = extractEmailAddress(
    getEnv("SENDGRID_FROM_EMAIL", "EMAIL_FROM", "SMTP_FROM", "SMTP_USER")
  );
  const senderName = getEnv("SENDGRID_FROM_NAME", "EMAIL_FROM_NAME") || "AgroMitra";

  if (!senderEmail) {
    throw new Error("SendGrid sender email is missing. Set SENDGRID_FROM_EMAIL or EMAIL_FROM.");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSendGridApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: senderEmail, name: senderName },
      subject,
      content: [
        { type: "text/plain", value: text || "" },
        { type: "text/html", value: html || text || "" },
      ],
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message =
      data?.errors?.map((error) => error.message).join("; ") ||
      data?.message ||
      "SendGrid email API failed";
    throw new Error(message);
  }

  return { id: response.headers.get("x-message-id") || "sendgrid-success" };
};

export const sendTransactionalEmail = async (payload) => {
  if (getSendGridApiKey()) {
    return sendViaSendGrid(payload);
  }

  if (getResendApiKey()) {
    return sendViaResend(payload);
  }

  if (getBrevoApiKey()) {
    return sendViaBrevo(payload);
  }

  if (process.env.RENDER || process.env.NODE_ENV === "production") {
    throw new Error(
      "No HTTP email provider configured. Set BREVO_API_KEY or RESEND_API_KEY in Render backend environment variables."
    );
  }

  return sendMail(payload);
};

export const sendRegistrationNotification = async ({ email, name, role }) => {
  const displayName = name || "AgroMitra user";
  const displayRole = role === "farmer" || role === "seller" ? "seller" : "buyer";

  return sendTransactionalEmail({
    to: email,
    subject: "Welcome to AgroMitra",
    text: `Hi ${displayName}, your AgroMitra ${displayRole} account has been created successfully.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="color: #15803d;">Welcome to AgroMitra</h2>
        <p>Hi ${displayName},</p>
        <p>Your AgroMitra ${displayRole} account has been created successfully.</p>
        <p>You can now login and continue your farming marketplace journey.</p>
        <p style="color: #64748b;">If you did not create this account, please contact AgroMitra support.</p>
      </div>
    `,
  });
};

export const sendCollectiveInviteEmail = async ({
  email,
  receiverName,
  senderName,
  productName,
  productPrice,
  frontendUrl,
  inviteId,
}) => {
  const displayReceiver = receiverName || "AgroMitra user";
  const displaySender = senderName || "A buyer";
  const displayProduct = productName || "an AgroMitra product";
  const appOrigin =
    String(frontendUrl || "").replace(/\/$/, "") ||
    "https://ecommerce-farming-frontend.onrender.com";
  const inviteQuery = inviteId ? `&invite=${encodeURIComponent(inviteId.toString())}` : "";
  const appUrl = `${appOrigin}/?open=notifications${inviteQuery}`;

  return sendTransactionalEmail({
    to: email,
    subject: "You have been invited for collective buying",
    text: `${displaySender} invited you for collective buying on AgroMitra for ${displayProduct}. Login to accept or reject the invite: ${appUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="color: #15803d;">Collective Buying Invite</h2>
        <p>Hi ${displayReceiver},</p>
        <p><strong>${displaySender}</strong> invited you for collective buying on AgroMitra.</p>
        <p><strong>Product:</strong> ${displayProduct}</p>
        ${productPrice !== undefined && productPrice !== null ? `<p><strong>Price:</strong> Rs.${productPrice}</p>` : ""}
        <p>Login to AgroMitra to accept or reject this invite.</p>
        <p>
          <a href="${appUrl}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;">
            View Notification
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">Discount and equal split amount will be calculated securely by AgroMitra after members join.</p>
      </div>
    `,
  });
};

export const sendCollectiveOrderConfirmedEmail = async ({
  email,
  name,
  productName,
  paidAmount,
  orderId,
  frontendUrl,
}) => {
  const displayName = name || "AgroMitra user";
  const displayProduct = productName || "your collective product";
  const appOrigin =
    String(frontendUrl || "").replace(/\/$/, "") ||
    "https://ecommerce-farming-frontend.onrender.com";
  const orderUrl = `${appOrigin}/my-orders`;

  return sendTransactionalEmail({
    to: email,
    subject: "Collective buying order confirmed",
    text: `Hi ${displayName}, your collective buying order for ${displayProduct} has been confirmed. Order ID: ${orderId}.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="color: #15803d;">Collective Order Confirmed</h2>
        <p>Hi ${displayName},</p>
        <p>All members have paid. Your collective buying order has been confirmed.</p>
        <p><strong>Product:</strong> ${displayProduct}</p>
        ${paidAmount !== undefined && paidAmount !== null ? `<p><strong>Your paid amount:</strong> Rs.${paidAmount}</p>` : ""}
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p>
          <a href="${orderUrl}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;">
            View Orders
          </a>
        </p>
      </div>
    `,
  });
};

export const sendEmail = async (email, otp) => {
  try {
    const emailContent = buildOtpEmail(otp);
    const info = await sendTransactionalEmail({
      to: email,
      ...emailContent,
    });

    console.log("OTP email sent:", info.messageId || info.id || "email-api-success");
    return info;
  } catch (error) {
    console.error("Email sending failed actual error:", error);
    throw new Error(error.message || "Failed to send OTP email");
  }
};

export const sendOtpEmail = sendEmail;
