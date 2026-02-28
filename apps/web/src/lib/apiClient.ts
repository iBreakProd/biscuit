// This utility wrapper handles the injection of the Authorization header
// for all API calls pointing to the backend Express server.

const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
};

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("biscuit_auth_token");

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiUrl()}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
      // Token is invalid, expired, or rejected by backend
      localStorage.removeItem("biscuit_auth_token");
      
      // Check if we are already on login page to avoid infinite redirect loops
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
  }

  return response;
};
