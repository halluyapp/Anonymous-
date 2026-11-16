import { supabase } from './supabase';
export function pushSupported(){return typeof window!=='undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window}
function bytes(key:string){const padded=(key+'='.repeat((4-key.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));}
export async function subscribePush(){
 if(!supabase||!pushSupported())throw new Error('This browser does not support web push. On iPhone, add After Dark to your Home Screen first.');
 if(Notification.permission!=='granted')throw new Error('Allow notifications in your browser settings to turn them on.');
 const {data:key,error:keyError}=await supabase.rpc('push_public_key');if(keyError||!key)throw new Error('Notifications are being set up. Please try again in a moment.');
 const registration=await navigator.serviceWorker.register('/push-sw.js',{scope:'/'});
 let subscription=await registration.pushManager.getSubscription();
 if(subscription){const current=subscription.options.applicationServerKey;if(current && btoa(String.fromCharCode(...new Uint8Array(current))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')!==key){await subscription.unsubscribe();subscription=null}}
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(key)});
 const data=subscription.toJSON();if(!data.endpoint||!data.keys?.p256dh||!data.keys?.auth)throw new Error('The browser did not provide a valid subscription.');
 const {error}=await supabase.rpc('push_register',{p_endpoint:data.endpoint,p_p256dh:data.keys.p256dh,p_auth:data.keys.auth});if(error)throw new Error('Could not enable notifications. Please try again.');
}
export async function unsubscribePush(){
 if(!pushSupported())return;
 const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();if(!subscription)return;
 const {error}=await supabase!.rpc('push_unregister',{p_endpoint:subscription.endpoint});if(error)throw new Error('Could not turn off notifications. Please try again.');
 await subscription.unsubscribe();
}
