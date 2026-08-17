import API from "./AxiosInstance";


export const fetchUser = async () => {
const token = localStorage.getItem("token");
const res = await API.get(`/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
});
return res.data.data;
};

// Login user
export const loginUser = async (email, password) => {
const res = await API.post(`/api/auth/login`, { email, password });
if (res.data.token) {
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("userData", JSON.stringify(res.data.user));
}
return res.data;
};

// Register user
export const registerUser = async (name, email, password, orgName) => {
const res = await API.post(`/api/auth/register`, { name, email, password, orgName });
if (res.data.token) {
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("userData", JSON.stringify(res.data.user));
}
return res.data;
};

// Logout user
export const logoutUser = () => {
localStorage.removeItem("token");
localStorage.removeItem("userData");
window.location.href = "/login";
};

// Check if user is authenticated
export const isAuthenticated = () => {
const token = localStorage.getItem("token");
return !!token;
};

// Get user from localStorage (no API call)
export const getStoredUser = () => {
const userDataStr = localStorage.getItem("userData");
if (!userDataStr) return null;
try {
    return JSON.parse(userDataStr);
} catch (error) {
    console.error("Failed to parse user data:", error);
    return null;
}
};

// Send OTP
export const sendOtp = async (email) => {
  const res = await API.post(`api/auth/send-otp`, {
    email,
  });

  return res.data;
};

// Verify OTP + Update Password
export const verifyOtpAndReset = async (email, otp, newPassword) => {
  const res = await API.post(`api/auth/verify-otp`, {
    email,
    otp,
    newPassword,
  });

  return res.data;
};