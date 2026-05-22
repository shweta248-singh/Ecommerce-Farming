// const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '')

// const parseResponse = async (res, fallbackMessage) => {
//   const text = await res.text()
//   let data = {}

//   try {
//     data = text ? JSON.parse(text) : {}
//   } catch {
//     data = { message: text }
//   }

//   if (!res.ok) {
//     throw new Error(data?.message || fallbackMessage)
//   }

//   return data
// }

// export const sendRegisterOtp = async ({ email }) => {
//   const normalizedEmail = email?.trim().toLowerCase()

//   if (!normalizedEmail) {
//     throw new Error('Email is required')
//   }

//   const res = await fetch(`${API_BASE_URL}/auth/register/send-otp`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({ email: normalizedEmail }),
//   })

//   return parseResponse(res, 'OTP send failed')
// }

// export const verifyRegisterOtp = async (payload) => {
//   const res = await fetch(`${API_BASE_URL}/auth/register/verify-otp`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(payload),
//   })

//   return parseResponse(res, 'OTP verification failed')
// }

// export const verifyGst = async ({ gst_number }) => {
//   const formattedGst = gst_number?.trim().toUpperCase()

//   if (!formattedGst) {
//     throw new Error('GST number is required')
//   }

//   const res = await fetch(`${API_BASE_URL}/auth/seller/verify-gst`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({ gst_number: formattedGst }),
//   })

//   return parseResponse(res, 'GST verification failed')
// }


const rawApiBaseUrl = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ""
).replace(/\/$/, "");

const API_BASE_URL = rawApiBaseUrl.endsWith("/api")
  ? rawApiBaseUrl
  : `${rawApiBaseUrl}/api`;

const parseResponse = async (res, fallbackMessage) => {
  const text = await res.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    throw new Error(data?.message || fallbackMessage);
  }

  return data;
};

export const sendRegisterOtp = async ({ email }) => {
  if (!rawApiBaseUrl) {
    throw new Error("Backend API URL is not configured");
  }

  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const res = await fetch(`${API_BASE_URL}/auth/otp/register/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  return parseResponse(res, "OTP send failed");
};

export const verifyRegisterOtp = async (payload) => {
  if (!rawApiBaseUrl) {
    throw new Error("Backend API URL is not configured");
  }

  const res = await fetch(`${API_BASE_URL}/auth/otp/register/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(res, "OTP verification failed");
};
