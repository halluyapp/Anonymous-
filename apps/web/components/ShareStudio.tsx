'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Download, Share2 } from 'lucide-react';
import { wrapText } from '../lib/wrap.mjs';

const themes = [
  { name: 'Midnight', background: '#100b15', panel: '#211322', ink: '#fff7fc', accent: '#ed80b7' },
  { name: 'After Dark Neon', background: '#180719', panel: '#2a1028', ink: '#fff7fc', accent: '#fa42ad' },
  { name: 'Minimal', background: '#f6f1ee', panel: '#ebe3e3', ink: '#241b22', accent: '#ad427b' },
  { name: 'Violet Dream', background: '#1b112b', panel: '#2f2043', ink: '#fff7fc', accent: '#c1a1ff' },
  { name: 'Pink Confession', background: '#4b1534', panel: '#72254c', ink: '#fff7fc', accent: '#ffb8d9' },
  { name: 'Pure Black', background: '#080808', panel: '#181818', ink: '#ffffff', accent: '#d9d9d9' },
];
export default function ShareStudio({ body, reply, username, onClose }: {body:string;reply:string|null;username:string;onClose:()=>void}) {
 const [theme,setTheme]=useState(0), [includeReply,setIncludeReply]=useState(Boolean(reply)), [includeName,setIncludeName]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const el=canvas.current;if(!el)return;const c=el.getContext('2d');if(!c)return;
  const t=themes[theme]; c.font='44px Georgia, serif';const text=wrapText(body,840,value=>c.measureText(value).width);c.font='36px Georgia, serif';const response=includeReply && reply ? wrapText(reply,840,value=>c.measureText(value).width) : [];
  const height=Math.max(1350, 420 + text.length*64 + (response.length ? 150 + response.length*54 : 0) + 150); const scale=Math.min(1,15000/height); el.width=Math.floor(1080*scale);el.height=Math.floor(height*scale);c.setTransform(scale,0,0,scale,0,0);
  c.fillStyle=t.background;c.fillRect(0,0,1080,height);c.fillStyle=t.panel;c.fillRect(48,48,984,height-96);
  c.strokeStyle=t.accent;c.lineWidth=2;c.strokeRect(74,74,932,height-148);
  c.fillStyle=t.accent;c.beginPath();c.arc(915,185,90,0,Math.PI*2);c.fill();c.fillStyle=t.panel;c.beginPath();c.arc(946,156,76,0,Math.PI*2);c.fill();
  c.fillStyle=t.ink;c.font='bold 25px sans-serif';c.fillText('AFTER',115,145);c.fillText('DARK ✦',115,174);c.fillStyle=t.accent;c.font='bold 18px sans-serif';c.fillText('AN ANONYMOUS NOTE',115,305);
  c.fillStyle=t.ink;c.font='44px Georgia, serif';let y=390;for(const line of text){c.fillText(line,115,y);y+=64;}
  if(response.length){y+=40;c.strokeStyle=t.accent;c.beginPath();c.moveTo(115,y);c.lineTo(965,y);c.stroke();y+=70;c.fillStyle=t.accent;c.font='bold 18px sans-serif';c.fillText('THE REPLY',115,y);y+=65;c.fillStyle=t.ink;c.font='36px Georgia, serif';for(const line of response){c.fillText(line,115,y);y+=54;}}
  c.fillStyle=t.accent;c.font='18px sans-serif';c.fillText(includeName ? `@${username}  ·  AFTER DARK` : 'A LITTLE MYSTERY. A LOT TO SAY.',115,height-125);
 },[body,reply,theme,includeReply,includeName,username]);
 const blob=()=>new Promise<Blob>((resolve,reject)=>canvas.current?.toBlob(b=>b?resolve(b):reject(new Error('Image generation failed.')),'image/png'));
 async function save(){try{setBusy(true);setError('');const b=await blob();const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download='after-dark-message.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}catch{setError('Could not generate your image. Please try again.')}finally{setBusy(false)}}
 async function share(){try{setBusy(true);setError('');const b=await blob();const file=new File([b],'after-dark-message.png',{type:'image/png'});if(!navigator.share || !navigator.canShare?.({files:[file]})){setError('Image sharing is not supported here. Save the image instead.');return}await navigator.share({files:[file],title:'After Dark'})}catch(e){if(e instanceof Error&&e.name!=='AbortError')setError('Could not share the image. Try saving it instead.')}finally{setBusy(false)}}
 return <div className="studio-overlay" role="dialog" aria-modal="true" aria-labelledby="studio-title"><div className="studio"><header><div><span className="section-kicker">MAKE IT A MOMENT / ✦</span><h2 id="studio-title">Share <em>Studio.</em></h2></div><button className="round-button" aria-label="Close Share Studio" onClick={onClose}><X size={18}/></button></header><div className="studio-layout"><div className="studio-preview"><canvas ref={canvas} aria-label="Preview of your share card"/></div><div className="studio-tools"><span className="section-kicker">CHOOSE YOUR LOOK</span><div className="studio-themes">{themes.map((t,i)=><button key={t.name} aria-pressed={theme===i} onClick={()=>setTheme(i)} className={theme===i?'chosen':''}><i style={{background:t.background,borderColor:t.accent}}/>{t.name}</button>)}</div>{reply&&<label className="studio-check"><input type="checkbox" checked={includeReply} onChange={e=>setIncludeReply(e.target.checked)}/> Include your saved reply</label>}<label className="studio-check"><input type="checkbox" checked={includeName} onChange={e=>setIncludeName(e.target.checked)}/> Include @{username}</label>{error&&<p className="error" role="alert">{error}</p>}<button className="button primary full" disabled={busy} onClick={save}>SAVE IMAGE <Download size={17}/></button><button className="button outline full" disabled={busy} onClick={share}>SHARE IMAGE <Share2 size={17}/></button><p className="studio-note">Your card is generated on this device. Check it before sharing.</p></div></div></div></div>
}
