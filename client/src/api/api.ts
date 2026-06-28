import axios from "axios";

const axiosClient = axios.create({
  baseURL: "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
});

import { handleMockRequest } from "./mockShowtime";

const USE_MOCK = true; // Toggle to false when backend is ready to bypass mock

const shouldMock = (url: string | undefined): boolean => {
  if (!url) return false;
  if (url.includes("api/auth/login")) {
    return true;
  }
  if (
    url === "/api/showtimes" ||
    url === "/api/showtimes/assign" ||
    url.match(/^\/api\/showtimes\/\d+$/)
  ) {
    return true;
  }
  if (url === "/api/cinemas" || url.match(/^\/api\/cinemas\/\d+\/rooms$/)) {
    return true;
  }
  if (url === "/api/movies") {
    return true;
  }
  
  return false;
};

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (USE_MOCK && shouldMock(config.url)) {
      config.adapter = () => handleMockRequest(config);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export default axiosClient;
