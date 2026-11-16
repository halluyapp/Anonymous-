import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAndroidRelease } from '../apps/mobile/release-check.mjs';
const valid={draft:false,prerelease:false,tag_name:'android-v3',html_url:'https://github.com/halluyapp/Anonymous-/releases/tag/android-v3',assets:[{name:'after-dark.apk',state:'uploaded',browser_download_url:'https://github.com/halluyapp/Anonymous-/releases/download/android-v3/after-dark.apk'}]};
test('only proposes newer official APK releases',()=>{assert.deepEqual(parseAndroidRelease(valid,2),{code:3,releaseUrl:valid.html_url});assert.equal(parseAndroidRelease(valid,3),null);assert.equal(parseAndroidRelease({...valid,prerelease:true},2),null);assert.equal(parseAndroidRelease({...valid,html_url:'https://evil.invalid'},2),null);assert.equal(parseAndroidRelease({...valid,assets:[]},2),null);assert.equal(parseAndroidRelease({...valid,tag_name:'android-v3.1'},2),null);assert.equal(parseAndroidRelease(valid,NaN),null)});
