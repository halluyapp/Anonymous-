import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import webpush from 'npm:web-push@3.6.7';
const response=(status:number)=>new Response(null,{status});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return response(405);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 try{
  const config=await client.rpc('push_worker_config').single();if(config.error||!config.data)return response(503);
  const provided=req.headers.get('x-push-secret')||'';
  // Constant-time comparison avoids leaking the worker secret through timing.
  const expected=new TextEncoder().encode(config.data.worker_secret),actual=new TextEncoder().encode(provided);
  let difference=expected.length^actual.length;for(let i=0;i<expected.length;i++)difference|=expected[i]^(actual[i]||0);if(difference!==0)return response(403);
  if(!config.data.vapid_public){const keys=webpush.generateVAPIDKeys();const init=await client.rpc('push_init_keys',{p_public:keys.publicKey,p_private:keys.privateKey});if(init.error)return response(503);}
  const fresh=await client.rpc('push_worker_config').single();if(fresh.error||!fresh.data?.vapid_private)return response(503);
  webpush.setVapidDetails('https://after-dark-one-xi.vercel.app',fresh.data.vapid_public,fresh.data.vapid_private);
  const batch=await client.rpc('push_claim');if(batch.error)return response(503);
  await Promise.all((batch.data||[]).map(async(job:{id:string;endpoint:string;p256dh:string;auth:string})=>{
   let status='sent';try{await webpush.sendNotification({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth}},JSON.stringify({title:'After Dark',body:'You have a new anonymous message.',url:'/inbox'}),{TTL:86400,timeout:10000})}catch(error){const code=(error as {statusCode?:number}).statusCode;status=code===404||code===410?'gone':'retry'}
   await client.rpc('push_finish',{p_id:job.id,p_status:status});
  }));
  return response(204);
 }catch{return response(503)}
});
