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

const sendTransactionalEmail = async (payload) => {
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
