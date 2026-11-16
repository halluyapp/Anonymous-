import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { parseAndroidRelease } from './release-check.mjs';

const latestUrl='https://api.github.com/repos/halluyapp/Anonymous-/releases/latest';
async function nativeRelease(){
 if(Platform.OS!=='android')return null;
 const current=Number(Application.nativeBuildVersion);if(!Number.isSafeInteger(current)||current<1)throw new Error('Could not determine the installed Android build.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const response=await fetch(latestUrl,{headers:{Accept:'application/vnd.github+json'},signal:controller.signal});if(response.status===404)return null;if(!response.ok)throw new Error('The Android release service is unavailable.');return parseAndroidRelease(await response.json(),current)}finally{clearTimeout(timer)}
}
function offerNative(release:{code:number;releaseUrl:string}){
 Alert.alert('Android update available',`Build ${release.code} is available. Android will ask you to approve installation. An update must be signed with the same key as your installed app.`,[{text:'Later',style:'cancel'},{text:'Open download',onPress:()=>{void Linking.openURL(release.releaseUrl).catch(()=>Alert.alert('Could not open download','Please try again.'))}}]);
}
// Check native releases on launch; Expo handles compatible signed JS updates at launch.
export function useNativeUpdateCheck(){useEffect(()=>{let active=true;nativeRelease().then(result=>{if(active&&result)offerNative(result)}).catch(()=>{});return()=>{active=false}},[])}
export default function AppUpdates(){
 const [checking,setChecking]=useState(false);
 async function check(){
  if(checking)return;setChecking(true);let ota='';let native='';let release:null|{code:number;releaseUrl:string}=null;
  try{if(!Updates.isEnabled){ota='Automatic design and JavaScript updates are not configured for this build.'}else{const result=await Updates.checkForUpdateAsync();if(result.isAvailable){const fetched=await Updates.fetchUpdateAsync();if(fetched.isNew){setChecking(false);Alert.alert('Update ready','A compatible update has downloaded. Restart After Dark to apply it.',[{text:'Later',style:'cancel'},{text:'Restart now',onPress:()=>{void Updates.reloadAsync().catch(()=>Alert.alert('Could not restart','Close and reopen the app.'))}}]);return}ota='No new design update was downloaded.'}else ota='No compatible design update is available.'}}
  catch{ota='Could not check design updates. Please check your connection.'}
  try{release=await nativeRelease();native=release?`Android build ${release.code} is available.`:'No newer published Android release was found.'}catch{native='Could not check Android releases. Please check your connection.'}
  setChecking(false);
  if(release){Alert.alert('Update check',`${ota}\n\n${native}`, [{text:'Close',style:'cancel'},{text:'Open download',onPress:()=>offerNative(release!)}])}else Alert.alert('Update check',`${ota}\n\n${native}`)
 }
 return <View style={styles.box}><View style={styles.icon}><Ionicons name="cloud-download-outline" size={22} color="#ee76ba"/></View><View style={styles.copy}><Text style={styles.title}>App updates</Text><Text style={styles.description}>Check for design updates and new Android builds.</Text></View><TouchableOpacity disabled={checking} onPress={check} accessibilityRole="button"><Text style={styles.action}>{checking?'CHECKING…':'CHECK ↗'}</Text></TouchableOpacity></View>
}
const styles=StyleSheet.create({box:{marginTop:28,marginBottom:8,padding:16,borderWidth:1,borderColor:'#63485e',borderRadius:14,backgroundColor:'#211621',flexDirection:'row',alignItems:'center',gap:12},icon:{width:40,height:40,borderRadius:20,backgroundColor:'#392134',alignItems:'center',justifyContent:'center'},copy:{flex:1},title:{color:'#fff',fontSize:15,fontWeight:'600'},description:{color:'#ac9ca9',fontSize:11,lineHeight:16,marginTop:4},action:{color:'#f276b9',fontSize:11,fontWeight:'bold'}});
