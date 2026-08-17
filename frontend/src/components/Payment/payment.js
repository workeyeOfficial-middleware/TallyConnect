// import API from "./AxiosInstance";

// export const createOrder = async ({ userId, licenseId, billingCycle, amount }) => {
// const res = await API.post(`/api/payment/create-order`, {
  
//     userId,
//     licenseId,
//     billingCycle,
//     amount,
// });
// return res.data;
// };

// // Verify payment after Razorpay returns handler response
// export const verifyPayment = async (details) => {
// const res = await API.post(`/api/payment/verify-payment`, details);
// return res.data;
// };

// export const getTransactionDetails = async (transactionId) => {
// const res = await API.get(`/api/payment/transaction/${transactionId}`);
// return res.data;
// };

// export const getMyTransactions = async (userId) => {
// const res = await API.get(`/api/payment/my-transactions?userId=${userId}`);
// return res.data;
// };

// export const downloadInvoice = (transactionId) => {
// if (!transactionId) return;
// window.open(
//     `https://dashboard.licentic.org/api/payment/invoice/${transactionId}`,
//     "_blank"
// );
// };

import API from "./AxiosInstance";

// Create Order
export const createOrder = async ({
  transactionId,
  userId,
  licenseId,
  billingCycle,
  amount,
}) => {

  const res = await API.post(`/api/payment/create-order`, {
    transactionId,   // 🔥 MUST BE SENT
    userId,
    licenseId,
    billingCycle,
    amount,
  });

  return res.data;
};


// Verify payment after Razorpay success
export const verifyPayment = async (details) => {
  const res = await API.post(`/api/payment/verify-payment`, details);
  return res.data;
};


export const getTransactionDetails = async (transactionId) => {
  const res = await API.get(`/api/payment/transaction/${transactionId}`);
  return res.data;
};


export const getMyTransactions = async (userId) => {
  const res = await API.get(`/api/payment/my-transactions?userId=${userId}`);
  return res.data;
};


export const downloadInvoice = (transactionId) => {
  if (!transactionId) return;
  window.open(
    `https://dashboard.licentic.org/api/payment/invoice/${transactionId}`,
    "_blank"
  );
};