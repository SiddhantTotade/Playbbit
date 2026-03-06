import React from "react";

export function Logo({ className = "" }: { className?: string }) {
    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg
                className="w-full h-full"
                viewBox="0 0 160 80"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    className="text-[#2500c4] opacity-40"
                    d="M125 15 C 135 15, 135 65, 125 65 C 115 65, 85 45, 85 40 C 85 35, 115 15, 125 15 Z"
                    fill="currentColor"
                />
                <path
                    className="text-[#3713ec] opacity-70"
                    d="M100 10 C 112 10, 112 70, 100 70 C 88 70, 50 45, 50 40 C 50 35, 88 10, 100 10 Z"
                    fill="currentColor"
                />
                <path
                    className="text-[#6366f1]"
                    d="M75 5 C 90 5, 90 75, 75 75 C 60 75, 15 45, 15 40 C 15 35, 60 5, 75 5 Z"
                    fill="currentColor"
                />
            </svg>
        </div>
    );
}
