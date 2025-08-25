// api/axiosInstance.ts
import axios from "axios";

// endpoints where the token should NOT be attached
const noAuthEndpoints = [
  "/auth/connect",
  "/auth/callback",
  "/auth/status",
  "/auth/connections",
  "/qbo/auth/connect",
  "/qbo/auth/callback",
];


const axiosInstance = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1`,
  timeout: 30000,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("qb_access_token");
    const realmId = localStorage.getItem("qb_realm_id");

    // Check if the current request URL is in the "noAuthEndpoints" list
    const isNoAuthEndpoint = noAuthEndpoints?.some((endpoint) =>
      config.url?.includes(endpoint)
    );

    if (accessToken && realmId && !isNoAuthEndpoint && accessToken !== 'authenticated') {
      config.headers.Authorization = `Bearer ${accessToken}`;
      config.headers['realm-id'] = realmId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // Only clear auth and redirect if it's not a QBO auth endpoint
        if (!error.config.url?.includes("/qbo/auth/")) {
          localStorage.removeItem("qb_access_token");
          localStorage.removeItem("qb_realm_id");
          localStorage.removeItem("qb_connection_id");
          localStorage.removeItem("qb_company_name");
          window.location.href = "/";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;