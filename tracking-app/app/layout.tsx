import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // <-- add this

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Goldstar • Tracking App",
  description: "Gestão e acompanhamento de pedidos Goldstar em tempo real",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head>
        {/* Google site verification */}
        <meta name="google-site-verification" content="wcCbqLyIRxWhIAZl_DNja7RH57Kc2UQI1tmNsIlFd8A" />
        {/* CookieYes banner */}
        <script
          id="cookieyes"
          type="text/javascript"
          src="https://cdn-cookieyes.com/client_data/278ef3f1a4d4621e4570f6c6924289e9/script.js"
          defer
        ></script>
        {/* ReCAPTCHA banner */}
        <script
          src="https://www.google.com/recaptcha/api.js?render=6LcDChosAAAAAI3VgEEG-0WA0VHG7JYi8Y7wqvFd"
          async
          defer
        ></script>
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-MFH89KRGJW"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-MFH89KRGJW');
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased min-h-screen`}>
        <Providers>{children}</Providers> {/* <-- wrap everything */}
      </body>
    </html>
  );
}
