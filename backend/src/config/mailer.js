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

const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure =
  process.env.SMTP_SECURE === undefined
    ? smtpPort === 465
    : String(process.env.SMTP_SECURE).toLowerCase() === "true";
const smtpRequireTls =
  process.env.SMTP_REQUIRE_TLS === undefined
    ? smtpPort === 587
    : String(process.env.SMTP_REQUIRE_TLS).toLowerCase() === "true";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: smtpPort,
  secure: smtpSecure,
  requireTLS: smtpRequireTls,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  family: 4,
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 15000),
  tls: {
    servername: process.env.SMTP_HOST || "smtp.gmail.com",
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
