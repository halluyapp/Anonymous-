import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const respond = (status:number, message:string) => new Response(JSON.stringify({message}), {status, headers:cors});
const MAX_FILE = 2 * 1024 * 1024, MAX_REQUEST = MAX_FILE + 32000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function format(bytes:Uint8Array):{kind:'image'|'voice';mime:string;ext:string}|null {
 const eq=(at:number,values:number[])=>values.every((v,i)=>bytes[at+i]===v);
 if(eq(0,[255,216,255]))return {kind:'image',mime:'image/jpeg',ext:'jpg'};
 if(eq(0,[137,80,78,71,13,10,26,10]))return {kind:'image',mime:'image/png',ext:'png'};
 if(eq(0,[82,73,70,70])&&eq(8,[87,69,66,80]))return {kind:'image',mime:'image/webp',ext:'webp'};
 if(eq(0,[26,69,223,163]))return {kind:'voice',mime:'audio/webm',ext:'webm'};
 if(eq(0,[79,103,103,83]))return {kind:'voice',mime:'audio/ogg',ext:'ogg'};
 if(eq(4,[102,116,121,112]))return {kind:'voice',mime:'audio/mp4',ext:'m4a'};
 return null;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return respond(405,'Method not allowed.');
 if(Number(req.headers.get('content-length')||0)>MAX_REQUEST)return respond(413,'Attachment is too large (maximum 2 MB).');
 try{
  if(!req.body)return respond(400,'Missing attachment.');
  const reader=req.body.getReader();const parts:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_REQUEST){await reader.cancel();return respond(413,'Attachment is too large (maximum 2 MB).')}parts.push(value)}
  const data=new Uint8Array(total);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length}
  const form=await new Request(req.url,{method:'POST',headers:{'content-type':req.headers.get('content-type')||''},body:data}).formData();
  const username=String(form.get('username')||'').toLowerCase(), body=String(form.get('body')||''), requestId=String(form.get('requestId')||''), kind=String(form.get('kind')||''), file=form.get('file');
  if(!/^[a-z0-9_]{3,24}$/.test(username)||!uuid.test(requestId)||Array.from(body).length>5000||!(file instanceof File)||file.size<12||file.size>MAX_FILE)return respond(400,'Please check your message and attachment.');
  const bytes=new Uint8Array(await file.arrayBuffer()), detected=format(bytes);
  if(!detected||detected.kind!==kind)return respond(400,'Unsupported attachment. Use a JPEG, PNG, WebP, or a supported voice recording.');
  const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),secret=Deno.env.get('SUBMISSION_HASH_SECRET');
  if(!ip||!secret)return respond(503,'Sending is temporarily unavailable.');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const hash=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const reservation=await client.rpc('reserve_media_upload',{p_username:username,p_request_id:requestId,p_sender_hash:hash,p_kind:kind});
  if(reservation.error)return respond(500,'Could not prepare the upload. Please try again.');
  if(reservation.data==='duplicate')return respond(200,'Your message was delivered.');
  if(reservation.data==='rate_limited')return respond(429,'Too many messages. Please try again later.');
  if(reservation.data==='not_found')return respond(404,'This page is unavailable.');
  if(reservation.data!=='ok')return respond(400,'Please check your message.');
  const path=`${requestId.toLowerCase()}/${crypto.randomUUID()}.${detected.ext}`;
  const upload=await client.storage.from('message-media').upload(path,bytes,{contentType:detected.mime,upsert:false});
  if(upload.error)return respond(500,'Could not upload your attachment. Please try again.');
  const {data:result,error}=await client.rpc('deliver_media',{p_username:username,p_body:body,p_request_id:requestId,p_sender_hash:hash,p_media_kind:kind,p_media_path:path});
  // On an ambiguous RPC error, do not delete: the transaction may have committed.
  if(error)return respond(500,'Could not confirm delivery. Please retry.');
  if(result!=='ok'){
   await client.storage.from('message-media').remove([path]);
   if(result==='duplicate')return respond(200,'Your message was delivered.');
   if(result==='rate_limited')return respond(429,'Too many messages. Please try again later.');
   if(result==='not_found')return respond(404,'This page is unavailable.');
   return respond(400,'Could not deliver your message. Please try again.');
  }
  return respond(200,'Your message was delivered.');
 }catch{return respond(400,'Could not process your attachment.');}
});
