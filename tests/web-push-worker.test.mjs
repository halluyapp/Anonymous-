import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(){const handlers={};let shown,opened;const self={location:{origin:'https://example.test'},registration:{showNotification:async(title,options)=>{shown={title,options}}},clients:{matchAll:async()=>[],openWindow:async url=>{opened=url}},addEventListener:(event,fn)=>{handlers[event]=fn}};vm.runInNewContext(readFileSync('apps/web/public/push-sw.js','utf8'),{self,URL});return {handlers,get shown(){return shown},get opened(){return opened}}}
test('push hides message text and click opens same-origin inbox',async()=>{const worker=setup();let operation;worker.handlers.push({data:{text:()=> 'private message'},waitUntil:p=>{operation=p}});await operation;assert.equal(worker.shown.title,'After Dark');assert.equal(worker.shown.options.body,'You have a new anonymous message.');worker.handlers.notificationclick({notification:{close(){}},waitUntil:p=>{operation=p}});await operation;assert.equal(worker.opened,'https://example.test/inbox')});
