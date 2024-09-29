'use client';

import localFont from "next/font/local";
import "./globals.css";
import { useEffect, useRef } from 'react';
import axios from 'axios';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isQueueSetupRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isQueueSetupRef.current) {
      const setupQueue = async () => {
        try {
          const response = await axios.post('/api/setupQueue');
          console.log('Push queue setup response:', response.data);
          isQueueSetupRef.current = true;
        } catch (error) {
          console.error('Failed to setup push queue:', error);
        }
      };

      setupQueue();
    }
  }, []);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
