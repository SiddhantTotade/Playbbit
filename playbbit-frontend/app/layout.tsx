import "./globals.css";
import { Spline_Sans } from "next/font/google";

const spline = Spline_Sans({ subsets: ["latin"], variable: "--font-spline" });

export default function RootLayout({ children }: any) {
  return (
    <html lang="en" className={`${spline.variable} dark`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=login,mail,person,person_add,vpn_key"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
