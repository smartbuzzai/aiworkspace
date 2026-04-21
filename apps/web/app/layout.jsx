export const metadata = {
  title: "Workspace",
  description: "Your AI-managed workspace",
  manifest: "/manifest.json",
  themeColor: "#0a0f1e",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workspace"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f1e"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{
        margin: 0,
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        background: "#f8fafc",
        color: "#1e293b",
        WebkitFontSmoothing: "antialiased"
      }}>
        {children}
      </body>
    </html>
  );
}
