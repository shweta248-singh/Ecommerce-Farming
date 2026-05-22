import { sendMail } from "../config/mailer.js";

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
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
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
  const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  const senderName = process.env.EMAIL_FROM_NAME || "AgroMitra";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
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
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(payload);
  }

  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo(payload);
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
