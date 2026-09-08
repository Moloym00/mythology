import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '真名之火 · 最后的火塘',
  description: '与朋友共守最后的火塘。3–6人在线桌游。',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
