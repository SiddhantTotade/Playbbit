import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/auth-context";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export function useAuth() {
  const { setAuth } = useAuthContext();
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

      const contentType = response.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        const errorMessage =
          data.message ||
          data.error ||
          `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Login Hook: Now correctly updates Global State
  const login = async (credentials: object) => {
    const data = (await fetcher("/api/auth/login", credentials)) as {
      token: string;
      user: any;
      message?: string;
    };

    if (data && data.token) {
      // 1. Tell the whole app we are logged in
      setAuth(data.token, data.user);
      // 2. Move to dashboard (root)
      router.push("/");
    }
  };

  // Other hooks remain the same...
  const register = async (userData: object) => {
    const data = await fetcher("/api/auth/register", userData);
    if (data) router.push("/confirm-account");
  };

  const forgotPassword = async (email: string) => {
    await fetcher("/api/auth/forgot-password", { email });
  };

  const resetPassword = async (passwordData: object) => {
    const data = await fetcher("/api/auth/reset-password", passwordData);
    if (data) router.push("/login");
  };

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
