const {test}=require('node:test');const assert=require('node:assert/strict');
const {classifyPayload,decodePayload,canPoll,displayEndpoint,NetworkMonitor}=require('../src/network-monitor.cjs');
test('detects common unread JSON fields without counting products or history',()=>{
 for(const payload of [{data:{unreadCount:3}},{data:{totalUnread:3}},{data:{message_unread_num:'3'}},{unread:{count:3}}]) assert.equal(classifyPayload(payload,'https://site.test/api').unread,3);
 assert.equal(classifyPayload({count:23,total:80,items:[{id:1,content:'product'}]},'https://site.test/products'),null);
 assert.equal(classifyPayload({data:{count:3}},'https://site.test/api/message/list'),null);
 assert.equal(classifyPayload({data:{count:3}},'https://site.test/api/message/unread-count').unread,3);
 assert.equal(classifyPayload({success:false,unreadCount:3}),null);
});
test('push classification distinguishes new incoming messages from receipts and history',()=>{
 const incoming={type:'message.new',data:{messageId:'a1',content:'新的消息'}};
 assert.equal(classifyPayload(incoming,'wss://site.test/chat','websocket').incoming,true);
 assert.equal(classifyPayload(incoming,'https://site.test/history','http'),null);
 for(const type of ['typing','receipt','history','sent','outgoing','read'])assert.equal(classifyPayload({type,messageId:'x',content:'old'},'wss://site.test/chat','websocket'),null);
 assert.equal(classifyPayload({type:'message.new',isSelf:true,messageId:'x',content:'self'},'wss://site.test/chat','websocket'),null);
});
test('Socket.IO decoding and limits',()=>{
 assert.deepEqual(decodePayload('42["message.new",{"messageId":"x","content":"hello"}]'),['message.new',{messageId:'x',content:'hello'}]);
 assert.equal(decodePayload('x'.repeat(300000)),null);assert.equal(decodePayload('invalid'),null);
});
test('accelerated polling only allows same-origin observed counter GETs',()=>{
 const page='https://site.test/messages';assert.equal(canPoll('https://site.test/api/messages/unread-count','GET',page),true);
 for(const [url,method] of [['https://site.test/api/messages/unread-count','POST'],['https://evil.test/api/unread-count','GET'],['https://site.test/message/send','GET'],['https://site.test/unread/reset-count','GET'],['https://site.test/unread/count?token=secret','GET'],['https://site.test/unread/count?action=clear','GET'],['https://site.test/message/list','GET']])assert.equal(canPoll(url,method,page),false);
});
test('display metadata removes query strings and credentials',()=>{assert.equal(displayEndpoint('https://user:pass@site.test/api/unread?token=secret'),'site.test/api/unread');});
test('multiple counter streams cannot oscillate and generate repeat alerts',()=>{
 const signals=[];const monitor=new NetworkMonitor({debugger:{isAttached:()=>true}},{signal:s=>signals.push(s),changed:()=>{},pollEnabled:()=>false});
 for(const value of [2,2,2]){monitor.observe(JSON.stringify({unreadCount:value}),'https://site.test/direct','http','GET');monitor.observe(JSON.stringify({unreadCount:8}),'https://site.test/notice','http','GET');}
 assert.deepEqual(signals.map(s=>s.unread),[2,8,8,8,8,8]);assert.ok(signals.every(s=>!s.counterIncreased));monitor.close();
});
