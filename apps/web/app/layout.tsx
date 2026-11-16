import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'After Dark — A little mystery. A lot to say.', description: 'A more beautiful place for anonymous messages.', manifest:'/manifest.webmanifest', appleWebApp:{capable:true,title:'After Dark',statusBarStyle:'black-translucent'} };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
