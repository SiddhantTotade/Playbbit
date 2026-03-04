"use client";

import React, { useState, useRef, useEffect } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ConfirmAccountPage() {
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Handle typing logic
  const handleChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return; // Only allow numbers

    const newOtp = [...otp];
    newOtp[index] = element.value.substring(element.value.length - 1);
    setOtp(newOtp);

    // Move to next input if value is entered
    if (element.value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace logic
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = otp.join("");
    if (finalCode.length < 6) return;

    setLoading(true);
    // Add your API call here
    console.log("Verifying code:", finalCode);
    setLoading(false);
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Verify Email"
        description="Enter the 6-digit code sent to your inbox"
      >
        <form
          onSubmit={handleVerify}
          className="w-full space-y-8 flex flex-col items-center"
        >
          {/* OTP Box Grid */}
          <div className="flex gap-2 sm:gap-3 justify-center">
            {otp.map((data, index) => (
              <Input
                key={index}
                type="text"
                maxLength={1}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                value={data}
                onChange={(e) => handleChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold bg-white/5 border-white/10 text-white focus-visible:ring-[#3713ec] focus-visible:border-[#3713ec] transition-all"
              />
            ))}
          </div>

          <Button
            disabled={loading || otp.join("").length < 6}
            className="w-full bg-[#3713ec] hover:bg-[#2500c4] text-white font-bold h-10 shadow-lg shadow-[#3713ec]/20"
          >
            {loading ? "Verifying..." : "Verify Account"}
            <span className="material-symbols-outlined ml-2 text-sm">
              verified_user
            </span>
          </Button>

          <div className="text-center space-y-2">
            <p className="text-[11px] text-slate-500">
              Didn't receive the code?
            </p>
            <button
              type="button"
              className="text-white text-[11px] font-bold hover:underline transition-all"
            >
              Resend New Code
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
