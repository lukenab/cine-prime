import axios from "axios";
import { handleMockRequest } from "./mockShowtime";

const axiosClient = axios.create({
  baseURL: "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
});

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

// ── Request interceptor — attach Bearer token ─────────────────────────────────
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

// ── Response interceptor — silent refresh on 401 ──────────────────────────────
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

function clearAuthAndRedirect() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("role");
  window.location.href = "/login";
}

axiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    const url: string = originalRequest?.url ?? "";

    // Never try to refresh on public auth endpoints
    const isPublicAuthCall = ["auth/login", "auth/register", "auth/resend", "auth/refresh"].some(
      (s) => url.includes(s)
    );

    if (error?.response?.status === 401 && !isPublicAuthCall && !originalRequest._retry) {
      originalRequest._retry = true;

      const currentToken = localStorage.getItem("accessToken");
      if (!currentToken) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      // If another refresh is already in flight, queue this request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosClient(originalRequest);
        });
      }

      isRefreshing = true;

      try {
        // Call refresh — backend accepts the (possibly expired) access token
        // and returns a new one (token rotation pattern)
        const res: any = await axiosClient.post("/api/auth/refresh", { token: currentToken });
        const newToken: string = res?.result?.token ?? res?.token;

        if (!newToken) throw new Error("No token in refresh response");

        localStorage.setItem("accessToken", newToken);
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
