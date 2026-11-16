'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
export default function ForgotPassword(){const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError('');const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});setBusy(false);if(error){setError(error.message);return}setDone(true)}
 return <main className="setup-page"><Link href="/auth" className="back-link"><ArrowLeft size={15}/> BACK TO LOG IN</Link><div className="setup-inner"><span className="section-kicker">LET'S GET YOU BACK IN / ✦</span><h1>Forgot your <em>password?</em></h1><p>Enter the email you used for After Dark. If an account exists, we&apos;ll send a secure reset link.</p>{done?<p className="success-note">If your account exists, check your email for a reset link. The link may take a few minutes to arrive.</p>:<form className="form" onSubmit={submit}><label>EMAIL ADDRESS<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="button primary full" disabled={busy}>{busy?'SENDING…':'SEND RESET LINK'} <ArrowUpRight size={17}/></button></form>}</div></main>}
