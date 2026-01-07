import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // <-- add this
import Script from "next/script";

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
        {/* Google Tag Manager */}
        <Script
          id="gtm-head"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-M37FZ9ZX');
            `,
          }}
        />

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
      
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased min-h-screen`}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-M37FZ9ZX"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Providers>{children}</Providers> {/* <-- wrap everything */}
      </body>
    </html>
  );
}
