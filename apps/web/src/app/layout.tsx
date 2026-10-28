import type { Metadata } from 'next';
import { Lato } from 'next/font/google';
import { UiProvider } from '@/components/ui/provider';
import './globals.css';

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-lato',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ForgePath — AI job hunting',
  description:
    'Upload your CV, discover permitted job sources, and prepare applications with honest match explanations.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={lato.variable}>
      <body>
        <UiProvider>{children}</UiProvider>
      </body>
    </html>
  );
}
