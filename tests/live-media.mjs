// Manual-only smoke test. Run against a dedicated test project; delete the test user afterwards.
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_KEY;
if(!url||!key)throw new Error('Missing Supabase public configuration');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const nonce=randomBytes(6).toString('hex'),username=`mediatest_${nonce}`,email=`afterdarktest${nonce}@example.com`,password=randomBytes(24).toString('base64url');
let userId;const paths=[];
try{
 const auth=await client.auth.signUp({email,password});if(auth.error)throw auth.error;if(!auth.data.session||!auth.data.user)throw new Error('Signup did not return a session');userId=auth.data.user.id;console.log('TEST_USER_ID',userId);
 const p=await client.from('profiles').insert({id:userId,username,display_name:'Media Test'});if(p.error)throw p.error;
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aX8AAAAASUVORK5CYII=','base64');
 const audio=await readFile(process.env.TEST_VOICE_FILE||'/tmp/after-dark-test.webm');
 for(const [kind,bytes,type] of [['image',image,'image/png'],['voice',audio,'audio/webm']]){
  const requestId=randomUUID();const data=()=>{const f=new FormData();f.append('username',username);f.append('body','');f.append('requestId',requestId);f.append('kind',kind);f.append('file',new Blob([bytes],{type}),kind);return f};
  const first=await client.functions.invoke('submit-media',{body:data()});if(first.error){console.error(await first.error.context?.text());throw first.error}
  const retry=await client.functions.invoke('submit-media',{body:data()});if(retry.error)throw retry.error;
  const result=await client.from('messages').select('id,media_kind,media_path').eq('request_id',requestId);if(result.error)throw result.error;assert.equal(result.data.length,1);assert.equal(result.data[0].media_kind,kind);const path=result.data[0].media_path;paths.push(path);
  const signed=await client.storage.from('message-media').createSignedUrl(path,60);if(signed.error)throw signed.error;const fetched=await fetch(signed.data.signedUrl);assert.equal(fetched.status,200);assert.deepEqual(Buffer.from(await fetched.arrayBuffer()),bytes);
 }
 console.log('Image and voice delivered, retries deduplicated, private attachments fetched.');
 if(process.env.RUN_BROWSER_TEST==='true'){
  const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{const page=await browser.newPage({viewport:{width:390,height:844}});const {data:{session}}=await client.auth.getSession();await page.addInitScript(({session})=>localStorage.setItem('sb-bkhldfjqxarnqmcidwog-auth-token',JSON.stringify(session)),{session});
   await page.goto('https://after-dark-one-xi.vercel.app/inbox?studio=1',{waitUntil:'networkidle',timeout:60000});
   await page.locator('.message-row').filter({hasText:'Voice message'}).first().click({timeout:30000});
   await page.getByRole('button',{name:'CREATE VOICE VIDEO'}).click({timeout:30000});
   await page.getByRole('button',{name:'SAVE VIDEO'}).waitFor({timeout:60000});
   const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'SAVE VIDEO'}).click();const download=await downloadPromise;await download.saveAs('/tmp/after-dark-render.webm');
   const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json','/tmp/after-dark-render.webm'],{encoding:'utf8'}));assert.ok(info.streams.some(s=>s.codec_type==='audio'),'export has no audio');assert.ok(info.streams.some(s=>s.codec_type==='video'),'export has no video');console.log('Browser voice export has playable audio and video streams.');
  }finally{await browser.close()}
 }

}finally{
 if(paths.length){const result=await client.storage.from('message-media').remove(paths);if(result.error)console.error('MEDIA_CLEANUP_ERROR',result.error.message)}
 if(userId){const result=await client.from('messages').delete().eq('recipient_id',userId);if(result.error)console.error('MESSAGE_CLEANUP_ERROR',result.error.message);console.log('DELETE_TEST_USER_AFTER_RUN',userId)}
 await client.auth.signOut();
}
