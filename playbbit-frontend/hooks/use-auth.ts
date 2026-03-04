import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const fetcher = async (endpoint: string, body: object) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Extract JSON safely
      const contentType = response.headers.get("content-type");
      let data = {};
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        // Logic: Use the backend message if it exists, otherwise fallback to status text
        const errorMessage =
          (data as any).message ||
          (data as any).error ||
          `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (err: any) {
      // This is where "Invalid Email or Password" will be caught and set to state
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 1. Register Hook
  const register = async (userData: object) => {
    const data = await fetcher("/api/auth/register", userData);
    if (data) router.push("/confirm-account");
  };

  // 2. Login Hook
  const login = async (credentials: object) => {
    const data = await fetcher("/api/auth/login", credentials);
    if (data) {
      // Save token to localStorage or Cookie here
      router.push("/dashboard");
    }
  };

  // 3. Forgot Password
  const forgotPassword = async (email: string) => {
    await fetcher("/api/auth/forgot-password", { email });
  };

  // 4. Reset Password
  const resetPassword = async (passwordData: object) => {
    const data = await fetcher("/api/auth/reset-password", passwordData);
    if (data) router.push("/login");
  };

  // 5. Verify OTP
  const verifyEmail = async (email: string, code: string) => {
    const data = await fetcher("/api/auth/verify-email", { email, code });
    if (data) router.push("/login");
  };

  return {
    register,
    login,
    forgotPassword,
    resetPassword,
    verifyEmail,
    loading,
    error,
    success,
  };
}
