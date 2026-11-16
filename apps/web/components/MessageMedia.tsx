'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
export default function MessageMedia({path,kind}:{path:string;kind:'image'|'voice'}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;setUrl('');setError('');supabase?.storage.from('message-media').createSignedUrl(path,3600).then(({data,error})=>{if(!active)return;if(error||!data)setError('Attachment is unavailable.');else setUrl(data.signedUrl)});return()=>{active=false}},[path]);
 if(error)return <p className="error">{error}</p>;if(!url)return <p className="media-loading">Opening attachment…</p>;
 return kind==='image'?<img className="detail-photo" src={url} alt="Photo attached to the anonymous message"/>:<div className="voice-card"><span className="voice-label">✦ &nbsp; ANONYMOUS VOICE NOTE</span><audio controls preload="metadata" src={url}/></div>;
}
