import bcrypt from "bcryptjs";
import { sendOtpEmail } from "../utils/sendEmail.js";
import User from "../models/User.js";
import OtpVerification from "../models/OtpVerification.js";
import LoginLog from "../models/LoginLog.js";

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeRole(role) {
  const value = String(role || "buyer").trim().toLowerCase();
  return value === "seller" ? "farmer" : value;
}

export async function sendRegisterOtp(req, res) {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpVerification.updateMany(
      { email: normalizedEmail, purpose: "register", is_used: false },
      { is_used: true }
    );

    await OtpVerification.create({
      email: normalizedEmail,
      otp_code: await bcrypt.hash(otp, 10),
      purpose: "register",
      expires_at: expiresAt,
      is_used: false,
    });

    await sendOtpEmail(normalizedEmail, otp);

    return res.json({
      message: "OTP sent successfully",
      ...(process.env.OTP_DEBUG_RESPONSE === "true" ? { otp } : {}),
    });
  } catch (error) {
    console.error("REGISTER OTP SEND ERROR:", error);
    return res.status(502).json({
      message: error.message || "OTP email send failed",
    });
  }
}

export async function verifyRegisterOtp(req, res) {
  try {
    const {
      full_name,
      name,
      email,
      phone,
      password,
      role,
      otp,
      gst_number,
      gst_verified,
      business_name,
    } = req.body;

    const normalizedEmail = email?.trim().toLowerCase();
    const displayName = full_name || name;

    if (!displayName || !normalizedEmail || !password || !role || !otp) {
      return res.status(400).json({ message: "All required fields are missing" });
    }

    const otpRecords = await OtpVerification.find({
      email: normalizedEmail,
      purpose: "register",
      is_used: false,
    }).sort({ created_at: -1 });

    let otpRecord = null;
    for (const record of otpRecords) {
      if (await bcrypt.compare(otp, record.otp_code)) {
        otpRecord = record;
        break;
      }
    }

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    if (otpRecord.expires_at < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const finalRole = normalizeRole(role);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: displayName,
      full_name: displayName,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      role: finalRole,
      is_verified: true,
      is_active: true,
      gst_number: finalRole === "farmer" ? gst_number || null : null,
      gst_verified: Boolean(gst_verified),
      business_name: business_name || null,
    });

    otpRecord.is_used = true;
    await otpRecord.save();

    return res.status(201).json({
      message: "Registration successful",
      user: { id: user.id, email: normalizedEmail, role: user.role },
    });
  } catch (error) {
    console.error("REGISTRATION FLOW ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
}

export async function saveLoginLog(req, res) {
  try {
    const { user_id, email, role } = req.body;

    if (!user_id || !email || !role) {
      return res.status(400).json({ message: "Login log data missing" });
    }

    await LoginLog.create({ user_id, email, role });

    return res.json({ message: "Login saved" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Login log failed" });
  }
}
