import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'After Dark — A little mystery. A lot to say.', description: 'A more beautiful place for anonymous messages.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
