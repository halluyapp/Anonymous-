import Link from 'next/link';
export default function Home() {
 return <main className="welcome-screen">
  <div className="welcome-texture" aria-hidden="true"/>
  <div className="welcome-shell">
   <header className="welcome-brand">AFTER<br/>DARK</header>
   <div className="welcome-stage">
    <div className="welcome-copy"><h1>A little mystery.<br/>A lot to say.</h1><p><strong>Share your link.</strong><br/>Get honest messages,<br/>anonymously.</p></div>
    <img className="welcome-art" src="/envelope-art.png" alt="" />
   </div>
   <div className="welcome-buttons"><Link className="welcome-primary" href="/auth?mode=signup">Create account</Link><Link className="welcome-login" href="/auth">Log in</Link></div>
  </div>
 </main>
}
