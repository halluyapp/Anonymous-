'use client';
import Link from 'next/link';
import { Home, Mail, Palette, UserRound } from 'lucide-react';
export default function AppNav({active}:{active:'home'|'inbox'|'profile'|'studio'}){return <nav className="app-nav" aria-label="Main navigation"><Link className={active==='home'?'current':''} href="/home"><Home/><span>Home</span></Link><Link className={active==='inbox'?'current':''} href="/inbox"><Mail/><span>Inbox</span></Link><Link className={active==='studio'?'current':''} href="/inbox?studio=1"><Palette/><span>Studio</span></Link><Link className={active==='profile'?'current':''} href="/settings"><UserRound/><span>Profile</span></Link></nav>}
