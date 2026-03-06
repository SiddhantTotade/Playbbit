import "./globals.css";
import { Spline_Sans } from "next/font/google";
import SessionWrapper from "@/components/SessionWrapper";

const spline = Spline_Sans({ subsets: ["latin"], variable: "--font-spline" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spline.variable} dark`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="font-sans">
        {/* SessionWrapper is the bridge for useSession() to work */}
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
