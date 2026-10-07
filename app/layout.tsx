import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cursor Pet — You brought a friend.',
  description: 'A tiny digital companion that reacts to the way you move, wait, and work.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
