import API from "./AxiosInstance";

export const purchaseLicense = async (payload) => {
    const res = await API.post('/api/lms/purchase-license', payload);
    return res.data
};