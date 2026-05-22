import nodemailer from "nodemailer";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

dns.setDefaultResultOrder("ipv4first");

const requiredEnv = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`Missing email env: ${key}`);
  }
}

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",

  port: Number(process.env.SMTP_PORT || 587),

  secure: false,

  requireTLS: true,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  family: 4,

  tls: {
    rejectUnauthorized: false,
  },
});

export const verifyMailer = async () => {
  try {
    await transporter.verify();
    console.log("SMTP SERVER IS READY");
  } catch (error) {
    console.error("SMTP ERROR:", error.message);
  }
};

verifyMailer();

export const sendMail = async ({ to, subject, html, text }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP_USER or SMTP_PASS missing in backend .env");
  }

  return transporter.sendMail({
    from: `"AgroMitra" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
};