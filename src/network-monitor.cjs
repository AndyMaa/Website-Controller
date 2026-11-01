const { createHash } = require('node:crypto');
const MAX_BODY = 262144;
const MESSAGE_PATH = /(?:message|messaging|notification|notice|unread|inbox|chat|conversation|privateletter|\/im\/)/i;
const keyOf = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const plainText = value => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 400) : '';
function decodePayload(input) {
  if (typeof input !== 'string' || input.length > MAX_BODY) return null;
  try { return JSON.parse(input); } catch {}
  // Socket.IO text event envelope. Binary/protobuf data is intentionally left to DOM fallback.
  const start = input.indexOf('[');
  if (/^\d+(?:\/[^,]*,)?/.test(input) && start >= 0) { try { return JSON.parse(input.slice(start)); } catch {} }
  return null;
}
function classifyPayload(payload, url = '', transport = 'http') {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.success === false || [401,403,429].includes(Number(payload.code ?? payload.status))) return null;
  const counts = [], messages = [];
  let visited = 0;
  function walk(value, path = [], depth = 0, inheritedEvent = '', inheritedExcluded = false) {
    if (!value || typeof value !== 'object' || depth > 7 || ++visited > 2000) return;
    if (Array.isArray(value)) { value.slice(0, 50).forEach((v, index) => walk(v, [...path, String(index)], depth+1,inheritedEvent,inheritedExcluded)); return; }
    const normalized = Object.fromEntries(Object.entries(value).map(([k,v]) => [keyOf(k), v]));
    const event = String(normalized.event ?? normalized.type ?? normalized.cmd ?? normalized.action ?? inheritedEvent);
    const excluded = inheritedExcluded || /history|receipt|typing|ack|read|deleted|sent|outgoing/i.test(event) || normalized.isfromself === true || normalized.isself === true || /outgoing|sent/i.test(String(normalized.direction || ''));
    for (const [key, raw] of Object.entries(value)) {
      const normalizedKey = keyOf(key);
      const strong = /^(?:(?:total|all)?unread(?:message|msg|notice|notification|chat)?(?:count|num|number|total)?|(?:message|msg|notice|notification|chat)unread(?:count|num|number)?|new(?:message|msg)count)$/.test(normalizedKey);
      const contextual = /^(?:count|num|number|total)$/.test(normalizedKey) && (path.some(p => /unread/i.test(p)) || /unread/i.test(new URL(url || 'https://local.invalid').pathname));
      const number = typeof raw === 'number' || (typeof raw === 'string' && /^\d{1,5}$/.test(raw)) ? Number(raw) : NaN;
      if ((strong || contextual) && Number.isInteger(number) && number >= 0 && number <= 99999) counts.push({ value:number, field:[...path,key].join('.'), priority:/total|all/.test(normalizedKey) ? 2 : 1 });
      if (typeof raw === 'object') walk(raw, [...path,key], depth+1,event,excluded);
    }
    const preview = plainText(normalized.content || normalized.text || normalized.body || normalized.messagecontent);
    const messageId = normalized.messageid ?? normalized.msgid ?? normalized.id;
    const context = `${path.join('.')} ${event} ${Array.isArray(payload) ? payload[0] : ''}`;
    const incoming = /(?:new[._-]?(?:message|msg)|(?:message|msg)[._-]?(?:new|received)|receive[._-]?(?:message|msg)|chat\.message)/i.test(context);
    if (preview && messageId != null && !excluded && incoming && transport !== 'http') messages.push({ preview, messageId:String(messageId).slice(0,120) });
  }
  walk(payload);
  counts.sort((a,b) => b.priority-a.priority || b.value-a.value);
  if (!counts.length && !messages.length) return null;
  return { unread:counts[0]?.value ?? null, field:counts[0]?.field || 'message event', preview:messages[0]?.preview || '', messageId:messages[0]?.messageId || '', incoming:messages.length > 0 };
}
function canPoll(url, method, pageUrl) {
  try {
    const target = new URL(url), page = new URL(pageUrl);
    if (method !== 'GET' || target.origin !== page.origin || !['https:', 'http:'].includes(target.protocol) || target.username || target.password) return false;
    // Only replay observed, successful, numeric unread-counter GETs, never arbitrary APIs.
    if (!/unread/i.test(target.pathname) || !/(?:count|num|number|status|unread\/?$)/i.test(target.pathname)) return false;
    if (/send|delete|remove|mark|reset|clear|ack|consume|update|write|create|logout|login|token|readall/i.test(target.pathname)) return false;
    for (const [key,value] of target.searchParams) if (/token|auth|session|password|secret|sign|action|method|operation|callback/i.test(key) || /delete|markread|clear|send/i.test(value)) return false;
    return true;
  } catch { return false; }
}
function displayEndpoint(url) {
  try { const u = new URL(url); return `${u.host}${u.pathname.replace(/\b[0-9a-f-]{20,}\b/gi, ':id')}`.slice(0,180); } catch { return '推送通道'; }
}
class NetworkMonitor {
  constructor(contents, options) {
    this.contents=contents; this.options=options; this.requests=new Map(); this.sockets=new Map(); this.endpoints=new Map(); this.ids=new Map();
    this.mode='discovering'; this.analyzed=0; this.lastSignalAt=0; this.processingMs=null; this.stopped=false; this.pollTimer=null; this.owned=false;
    this.observedRequests=0;
    this.handler=(_e,method,params)=>this.handle(method,params).catch(error=>{if(process.env.RELAY_E2E==='1')console.error('Network monitor:',method,error.message);});
    this.detachHandler=()=>{this.mode='page'; this.options.changed();};
    try {
      if (contents.debugger.isAttached()) { this.mode='page'; return; }
      contents.debugger.attach('1.3'); this.owned=true;
      contents.debugger.on('message',this.handler); contents.debugger.on('detach',this.detachHandler);
      contents.debugger.sendCommand('Network.enable',{maxTotalBufferSize:2097152,maxResourceBufferSize:MAX_BODY}).catch(()=>{this.mode='page';this.options.changed();});
    } catch { this.mode='page'; }
    this.pollTimer=setInterval(()=>this.poll(),1000); this.pollTimer.unref?.();
  }
  snapshot() { return { mode:this.mode, observedRequests:this.observedRequests, analyzed:this.analyzed, lastSignalAt:this.lastSignalAt, processingMs:this.processingMs, endpoints:[...this.endpoints.values()].map(e=>({ address:displayEndpoint(e.url), transport:e.transport, field:e.field, lastSeen:e.lastSeen, polling:e.polling, interval:e.interval, note:e.note||'' })).slice(-20) }; }
  async handle(method,p) {
    if(this.stopped)return;
    if(method==='Network.requestWillBeSent') {
      this.observedRequests++;
      if(this.requests.size>300)this.requests.delete(this.requests.keys().next().value);
      if(['XHR','Fetch','EventSource'].includes(p.type)) this.requests.set(p.requestId,{url:p.request.url,method:p.request.method,started:Date.now()});
    } else if(method==='Network.responseReceived') {
      const request=this.requests.get(p.requestId); if(!request)return;
      request.ok=p.response.status>=200&&p.response.status<300;
      request.json=/json/i.test(p.response.mimeType) || MESSAGE_PATH.test(new URL(request.url).pathname);
    } else if(method==='Network.loadingFinished') {
      const request=this.requests.get(p.requestId);this.requests.delete(p.requestId);
      if(!request?.ok||!request.json||p.encodedDataLength>MAX_BODY)return;
      const began=Date.now();
      const result=await this.contents.debugger.sendCommand('Network.getResponseBody',{requestId:p.requestId});
      if(result.body.length>MAX_BODY)return;
      this.observe(result.base64Encoded?Buffer.from(result.body,'base64').toString('utf8'):result.body,request.url,'http',request.method,began);
    } else if(method==='Network.loadingFailed') this.requests.delete(p.requestId);
    else if(method==='Network.webSocketCreated'){if(this.sockets.size<50)this.sockets.set(p.requestId,p.url);}
    else if(method==='Network.webSocketFrameReceived'&&p.response.opcode===1) this.observe(p.response.payloadData,this.sockets.get(p.requestId)||'', 'websocket','',Date.now());
    else if(method==='Network.webSocketClosed') { const url=this.sockets.get(p.requestId);this.sockets.delete(p.requestId);for(const endpoint of this.endpoints.values())if(endpoint.url===url)endpoint.note='推送连接已关闭，页面监测继续';this.options.changed(); }
    else if(method==='Network.eventSourceMessageReceived') this.observe(p.data,this.requests.get(p.requestId)?.url||this.contents.getURL(),'sse','',Date.now());
  }
  observe(body,url,transport,method,began=Date.now(),passive=true) {
    if(this.stopped)return;
    const payload=decodePayload(body); if(!payload)return;
    this.analyzed++;
    const signal=classifyPayload(payload,url,transport); if(!signal)return;
    const key=createHash('sha256').update(`${url.split('?')[0]}:${transport}:${signal.field}`).digest('hex');
    let endpoint=this.endpoints.get(key);
    if(!endpoint){if(this.endpoints.size>=30)return;endpoint={url,transport,field:signal.field,polling:false,interval:3000,nextPoll:Date.now()+3000,seen:0};this.endpoints.set(key,endpoint);}
    endpoint.seen++; endpoint.lastSeen=Date.now(); endpoint.url=url;
    if(passive&&transport==='http'){endpoint.suspended=false;endpoint.note='';}
    const counterIncreased=signal.unread!==null&&endpoint.lastCount!=null&&signal.unread>endpoint.lastCount;
    if(signal.unread!==null)endpoint.lastCount=signal.unread;
    if(transport==='http'&&signal.unread!==null&&this.options.pollEnabled()&&canPoll(url,method,this.contents.getURL())&&!endpoint.suspended) endpoint.polling=true;
    this.lastSignalAt=Date.now();this.processingMs=Date.now()-began;this.mode=transport==='http'?'api':'push';
    if(signal.incoming){const identity=`${url.split('?')[0]}:${signal.messageId}`;if(this.ids.has(identity)){this.options.changed();return;}this.ids.set(identity,Date.now());if(this.ids.size>500)this.ids.delete(this.ids.keys().next().value);}
    const counts=[...this.endpoints.values()].filter(e=>e.lastCount!=null&&Date.now()-e.lastSeen<60000).map(e=>e.lastCount);
    this.options.signal({...signal,unread:signal.unread===null?null:Math.max(...counts),counterIncreased,source:transport==='http'?'消息接口':transport==='sse'?'实时推送 · SSE':'实时推送 · WebSocket',at:this.lastSignalAt});
    this.options.changed();
  }
  async poll() {
    if(this.stopped||this.busy||!this.options.pollEnabled()||this.contents.isDestroyed()||!this.options.canPoll())return;
    const now=Date.now();
    const entry=[...this.endpoints.values()].filter(e=>e.polling&&!e.suspended&&now>=e.nextPoll&&canPoll(e.url,'GET',this.contents.getURL())).sort((a,b)=>a.nextPoll-b.nextPoll)[0];
    if(!entry)return;
    this.busy=true;entry.nextPoll=now+entry.interval;this.abort=new AbortController();const timeout=setTimeout(()=>this.abort?.abort(),7000);
    try {
      const response=await this.contents.session.fetch(entry.url,{method:'GET',credentials:'include',cache:'no-store',redirect:'error',signal:this.abort.signal});
      if([401,403].includes(response.status)){entry.polling=false;entry.suspended=true;entry.note='等待网站重新验证登录';this.options.changed();return;}
      if(response.status===429){const retry=response.headers.get('retry-after');const seconds=Number(retry);const until=Number.isFinite(seconds)?now+seconds*1000:Date.parse(retry);entry.nextPoll=Math.max(now+60000,Number.isFinite(until)?until:0);entry.note='按网站要求降低检查频率';return;}
      if(!response.ok)throw new Error('response');
      const reader=response.body.getReader();const chunks=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw new Error('large');}chunks.push(Buffer.from(value));}
      const body=Buffer.concat(chunks).toString('utf8');
      if(!classifyPayload(decodePayload(body),entry.url)){entry.polling=false;entry.note='返回结构变化，继续自动识别';return;}
      entry.interval=3000;entry.note='';this.observe(body,entry.url,'http','GET',Date.now(),false);
    } catch {entry.interval=Math.min(entry.interval*2,60000);entry.nextPoll=Date.now()+entry.interval;entry.note='接口暂缓检查，页面监测继续';}
    finally{clearTimeout(timeout);this.busy=false;this.abort=null;this.options.changed();}
  }
  close(){this.stopped=true;clearInterval(this.pollTimer);this.abort?.abort();if(this.owned&&!this.contents.isDestroyed()){this.contents.debugger.removeListener('message',this.handler);this.contents.debugger.removeListener('detach',this.detachHandler);if(this.contents.debugger.isAttached())this.contents.debugger.detach();}this.endpoints.clear();this.requests.clear();this.sockets.clear();}
}
module.exports={NetworkMonitor,classifyPayload,decodePayload,canPoll,displayEndpoint};
