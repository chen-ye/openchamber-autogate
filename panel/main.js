(()=>{var I="openchamber.sdk",x=1;var Rt=`
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [data-oc-scrolling] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [data-oc-scrolling] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [data-oc-scrolling]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [data-oc-scrolling] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;function ht(e){let r=e.documentElement;if(r.hasAttribute("data-oc-scrollbar-activity"))return;r.setAttribute("data-oc-scrollbar-activity","");let t=new WeakMap;e.addEventListener("scroll",(s)=>{let i=s.target===e?r:s.target;if(!(i instanceof Element))return;if(!i.hasAttribute("data-oc-scrolling"))i.setAttribute("data-oc-scrolling","");let l=t.get(i);if(l!==void 0)clearTimeout(l);t.set(i,setTimeout(()=>{t.delete(i),i.removeAttribute("data-oc-scrolling")},1000))},{capture:!0,passive:!0})}var yr=`(${ht.toString()})(document);`;var gt=128,It=65536;var je=128;var Ye=65536;var Lo=/^[a-z][a-z0-9-]{0,39}$/;var vo=(e)=>Object(e)===e&&!Array.isArray(e),xt=(e,r)=>Object.keys(e).every((t)=>r.includes(t)),yo=(e)=>String(e)===e&&e.length>=1&&e.length<=60,No=(e)=>String(e)===e&&e.length>=1&&e.length<=80,Po=(e)=>{if(!Array.isArray(e)||e.length>4)return!1;let r=new Set;for(let t of e){if(!vo(t)||!Lo.test(t.id)||!yo(t.label))return!1;if(t.disabled!==void 0&&t.disabled!==!0&&t.disabled!==!1)return!1;if(r.has(t.id))return!1;if(r.add(t.id),t.kind==="button"){if(!xt(t,["kind","id","label","disabled"]))return!1;continue}if(t.kind!=="select"||!xt(t,["kind","id","label","value","options","disabled"]))return!1;if(!No(t.value)||!Array.isArray(t.options)||t.options.length<1||t.options.length>16)return!1;let s=new Set;for(let i of t.options){if(!vo(i)||!xt(i,["value","label"])||!No(i.value)||!yo(i.label)||s.has(i.value))return!1;s.add(i.value)}if(!s.has(t.value))return!1}return!0};var wo=["{id}","{segment}","{segments+}"];var mn=new Set(wo);var Go=["turn-finished","turn-failed","permission-asked","question-asked","turn-started","session-created","session-archived","session-deleted"];var Rn=new Set(Go);var Je=20000000,Qe=256;var bt=(e)=>("bytes"in e)?e.bytes.byteLength:e.content.length,Do=(e,r)=>{if(e.path!==r.path||e.readOnly!==r.readOnly)return!1;if(e.encoding==="text"||r.encoding==="text")return e.encoding==="text"&&r.encoding==="text"&&e.content===r.content;if(e.bytes.byteLength!==r.bytes.byteLength)return!1;for(let t=0;t<e.bytes.byteLength;t+=1)if(e.bytes[t]!==r.bytes[t])return!1;return!0};var $o=/^[A-Za-z0-9_-]{1,80}$/;var Ho=["left","right","top","bottom"];var Xo=(e,r=0,t={remaining:16000})=>{if(--t.remaining<0||r>=32)return!1;if(e===null)return!0;let s=Array.isArray(e)?e:Object(e)===e?Object.values(e):[];for(let i of s)if(!Xo(i,r+1,t))return!1;return!0},kt=(e)=>{if(e===null||e===!0||e===!1)return!0;if(Array.isArray(e))return Object.keys(e).every((r)=>/^(0|[1-9]\d*)$/.test(r)&&Number(r)<e.length)&&e.every(kt);if(Object(e)===e){let r=Object.getPrototypeOf(e);return(r===null||r===Object.prototype)&&Object.values(e).every(kt)}return String(e)===e||Number.isFinite(e)},Ct=(e)=>{try{if(String(e.id)!==e.id||!$o.test(e.id)||!Number.isFinite(e.anchor.x)||Math.abs(e.anchor.x)>1e5||!Number.isFinite(e.anchor.y)||Math.abs(e.anchor.y)>1e5||!Number.isFinite(e.anchor.width)||!Number.isFinite(e.anchor.height)||e.anchor.width<=0||e.anchor.height<=0||e.anchor.width>1e5||e.anchor.height>1e5||!Number.isInteger(e.width)||e.width<160||e.width>640||!Number.isInteger(e.height)||e.height<48||e.height>480||e.side!==void 0&&!Ho.includes(e.side)||e.focus!==void 0&&e.focus!==!0&&e.focus!==!1||!Xo(e.data)||!kt(e.data))return!1;return JSON.stringify(e.data).length<=16000}catch{return!1}};var Mt=2000;var Bo=["file","directory","other","missing"],vt=(e)=>Boolean(e&&"sessionId"in e),yt=(e)=>Boolean(e&&"sent"in e&&!("sessionId"in e));var Fo=/^[0-9a-f]{7,64}$/i,Nt=(e)=>Fo.test(e),Ze=500,qe=32000,Ko=16000,Wo=128,zo=200,jo=2000,Yo=16000,Jo=80,Qo=200,Zo=16000;var qo=2000;var Lt=20000,et=1024,tt=2000000;var ot=64000,rt=8000,Pt=4000;var wt=960000;var er=999,tr=1e4,De=500,or=["HOST_UNAVAILABLE","HOST_TIMEOUT","HOST_REJECTED","DISCONNECTED","DISABLED","BAD_PATH","NO_INTEGRATION","NO_SERVICE","SERVICE_FAILED","REQUEST_FAILED","RESPONSE_TOO_LARGE","NO_SESSION","SESSION_BUSY","NOT_GRANTED","NO_DIRECTORY","NOT_FOUND","FILE_TOO_LARGE","DENIED","NO_MODEL","MODEL_FAILED","UNSUPPORTED"],rr=["stopped","starting","ready","failed"],Lr=new Set(or),nr=(e)=>Lr.has(e),sr=(e)=>e&&nr(e)?e:"HOST_REJECTED",ge=(e)=>{if(e===void 0)return!1;if(e===null||e===!0||e===!1)return!0;if(String(e)===e)return!0;if(Number(e)===e)return Number.isFinite(e);if(Array.isArray(e))return e.every(ge);if(Object(e)===e)return Object.values(e).every(ge);return!1},ir=(e)=>ge(e)&&JSON.stringify(e).length<=Zo,Vo=(e)=>e?.trim().slice(0,Qo)??"",Ie=(e)=>{let r=e.id.trim().slice(0,Wo),t=e.title.trim().slice(0,zo),s=e.url.trim().slice(0,jo),i=e.text?.trim().slice(0,Yo),l=e.author?.trim().slice(0,Jo),c=e.kind==="pull"?"pull":"issue",p={providerId:e.providerId.trim(),id:r,title:t||r,url:s,kind:c};if(i)p.text=i;if(l)p.author=l;if(c==="pull"){let S=Vo(e.branches?.head),T=Vo(e.branches?.base);if(S&&T)p.branches={head:S,base:T}}if(ir(e.data))p.data=e.data;return p},Gt=(e)=>{let r=Ie(e);if(e.projectId)r.projectId=e.projectId;if(e.navigation)r.navigation=e.navigation;if(e.worktree)r.worktree=e.worktree;return r},Dt=(e)=>{let r={text:e.text.trim().slice(0,Ko)};if(e.send)r.send=!0;return r},$t=(e)=>{if(e===null||!Number.isFinite(e))return null;return Math.min(er,Math.max(0,Math.round(e)))},Ht=(e)=>{if(!Number.isFinite(e))return 0;return Math.min(tr,Math.max(0,Math.ceil(e)))};var xe=(e)=>e.length>0&&e.length<=et&&!e.includes("\x00")&&!e.includes("\\");var nt=(e)=>{if(!e.startsWith("/")||e.includes("\x00")||e.includes("\\")||e.includes("://"))return!1;if(e.length>qo)return!1;return!e.split("/").some((t)=>t==="."||t==="..")},Pr=new Set(rr),Xt=(e)=>Boolean(e&&"status"in e&&Pr.has(String(e.status))&&!("body"in e)),st=(e)=>Boolean(e&&"status"in e&&"body"in e&&Number.isInteger(e.status)),Vt=(e)=>Boolean(e&&"content"in e&&String(e.content)===e.content),Bt=(e)=>Boolean(e&&"written"in e&&e.written===!0),Ft=(e)=>Boolean(e&&"entries"in e&&Array.isArray(e.entries)),wr=new Set(Bo),Kt=(e)=>Boolean(e&&"kind"in e&&"size"in e&&wr.has(String(e.kind))&&Number.isFinite(e.size)),Wt=(e)=>Boolean(e&&"text"in e&&String(e.text)===e.text&&!("status"in e)),Gr=new Set(["workspace","shells","ready","directory","session","connection","settings","session-lifecycle","item","resolve","action","service-event","status-control-event","popover-closed","file-open","file-snapshot","file-saved","generate-late"]),Dr=(e)=>Object(e)===e?e:null,Ut=(e)=>String(e)===e&&e.length>0,$r=(e)=>{if(!Ut(e.id))return null;if(e.ok===!0){let r={channel:I,v:x,type:"result",id:e.id,ok:!0};if(Object(e.payload)===e.payload)r.payload=e.payload;return r}if(e.ok===!1&&Ut(e.error))return{channel:I,v:x,type:"result",id:e.id,ok:!1,error:e.error,code:sr(Ut(e.code)?e.code:void 0)};return null},zt=(e)=>{let r=Dr(e);if(!r||r.channel!==I||r.v!==x)return null;if(r.type==="result")return $r(r);if(!Gr.has(String(r.type))||Object(r.payload)!==r.payload)return null;return r};var ar=(e)=>("key"in e)&&("metaKey"in e)&&("ctrlKey"in e),Hr=(e)=>(e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==="s";class h extends Error{code;constructor(e,r){super(r);this.name="HostRequestError",this.code=e}}var cr=()=>Promise.reject(new h("BAD_PATH",'Request path must start with "/" and stay on the declared origin.')),it=()=>Promise.reject(new h("BAD_PATH",`File path must be 1 to ${et} characters without NUL or backslash.`)),at=(e)=>{if(e===void 0)return;if(Object(e)!==e||Array.isArray(e)||e.scope!==void 0&&e.scope!=="instance"&&e.scope!=="device")throw new h("HOST_REJECTED",'Storage scope must be "instance" or "device".');return e.scope==="device"?"device":void 0},g=(e)=>(e.value+=1,`oc-${e.value}`),jt=(e={})=>{let r=e.target??("window"in globalThis?window:null);if(!r)throw new h("HOST_UNAVAILABLE","No window. connectHost runs in a browser frame.");let t=e.acceptSource??((o)=>o===r.parent),s=e.requestTimeoutMs??Lt,i=new Set,l=new Set,c=new Set,p=new Set,S=new Set,T=new Set,u=new Set,m=new Set,_=new Set,f=new Set,b=new Set,X=new Set,M=[],W=null,te=null,J=new Set,fe=new Set,_e=null,Ee=null,he=!1,oe=new Map,re=new Map,ne=new Map,z=!1,d={value:0},E=null,se=null,we=!1,Ge=!1,mo=null,Oo=(o)=>{if(!o)return null;return{sessionId:o.id,phase:o.busy?"started":"completed"}},j=(o)=>{r.parent.postMessage(o,"*")},Ro=()=>{if(z||r.parent===r||X.size===0||E?.features?.lateGenerateResults!==!0)return;j({channel:I,v:x,type:"generate-late-listen"})},N=(o,n)=>{for(let A of o)try{A(n)}catch(O){console.error(O)}},ho=(o)=>{if(!(o instanceof MessageEvent))return;if(!t(o.source))return;let n=zt(o.data);if(!n)return;if(n.type==="workspace"){let O=re.get(n.payload.subscriptionId);if(O)N([O],n.payload.snapshot);return}if(n.type==="shells"){let O=ne.get(n.payload.subscriptionId);if(O)N([O],n.payload.snapshot);return}if(n.type==="ready"){if(E=n.payload,se=Oo(n.payload.session),N(i,n.payload),N(l,n.payload.directory),N(c,n.payload.session),se)N(p,se);if(N(S,n.payload.connection),N(T,n.payload.settings),N(u,n.payload.item),n.payload.block)N(m,n.payload.block);Ro();return}if(n.type==="service-event"){N(_,n.payload);return}if(n.type==="generate-late"){if(X.size===0)M.push(n.payload);else N(X,n.payload);return}if(n.type==="directory"){if(E)E={...E,directory:n.payload.directory};N(l,n.payload.directory);return}if(n.type==="session"){if(E)E={...E,session:n.payload.session};if(!n.payload.session)se=null;else if(se?.sessionId!==n.payload.session.id)se=Oo(n.payload.session);N(c,n.payload.session);return}if(n.type==="session-lifecycle"){se=n.payload,N(p,n.payload);return}if(n.type==="connection"){if(E)E={...E,connection:n.payload.connection};N(S,n.payload.connection);return}if(n.type==="settings"){if(E)E={...E,settings:n.payload.settings};N(T,n.payload.settings);return}if(n.type==="item"){if(E)E={...E,item:n.payload.item};N(u,n.payload.item);return}if(n.type==="status-control-event"){N(f,n.payload);return}if(n.type==="popover-closed"){N(b,n.payload);return}if(n.type==="action"){let O=(k)=>{if(!z)j({channel:I,v:x,type:"action-result",id:n.id,payload:k})},v=te;if(!v){O({ok:!1,error:"This extension does not handle background actions."});return}Promise.resolve().then(()=>v(n.payload)).then(()=>O({ok:!0}),(k)=>{let H=(k instanceof Error?k.message:String(k)).trim();O({ok:!1,error:(H||"Action failed.").slice(0,De)})});return}if(n.type==="file-open"){let O=n.payload;if(Ee&&Do(Ee,O))return;Ee=O,N(J,n.payload);return}if(n.type==="file-saved"){N(fe,n.payload.version);return}if(n.type==="file-snapshot"){let O=(H)=>{if(!z)j({channel:I,v:x,type:"file-snapshot-result",id:n.id,payload:H})},v=(H)=>O({error:(H.trim()||"Could not read the edited file.").slice(0,De)}),k=_e;if(!k){v("This extension does not edit files.");return}Promise.resolve().then(()=>k(n.payload.purpose)).then((H)=>{if(bt(H)>Je){v(`The file is over ${Je} ${"bytes"in H?"bytes":"characters"}.`);return}if(H.version.length>Qe){v(`The snapshot version is over ${Qe} characters.`);return}O({snapshot:"bytes"in H?{bytes:H.bytes,version:H.version}:{content:H.content,version:H.version}})},(H)=>v(H instanceof Error?H.message:String(H)));return}if(n.type==="resolve"){let O=(k)=>{j({channel:I,v:x,type:"resolve-result",id:n.id,payload:k})},v=W;if(!v){O({error:"This extension does not resolve commands."});return}Promise.resolve().then(()=>v(n.payload)).then((k)=>O({item:k?Ie(k):null}),(k)=>{let H=(k instanceof Error?k.message:String(k)).trim();O({error:(H||"Command failed.").slice(0,De)})});return}let A=oe.get(n.id);if(!A)return;if(clearTimeout(A.timer),oe.delete(n.id),n.ok){A.resolve(n.payload);return}A.reject(new h(n.code,n.error))};r.addEventListener("message",ho),j({channel:I,v:x,type:"hello"});let V=(o,n=s)=>{if(z||r.parent===r)return Promise.reject(new h("HOST_UNAVAILABLE","No host frame. This page is not in an iframe."));return new Promise((A,O)=>{let v=setTimeout(()=>{oe.delete(o.id),O(new h("HOST_TIMEOUT","Host did not answer in time."))},n);oe.set(o.id,{resolve:A,reject:O,timer:v}),j(o)})},w=(o)=>V(o).then(()=>{return}),D={channel:I,v:x},At=(o)=>{if(!z&&r.parent!==r)j(o)},go=()=>At({...D,type:"file-save"}),Io=(o)=>{if(!ar(o)||!Hr(o))return;o.preventDefault(),go()},xo=(o)=>{if(!ar(o)||o.key!=="Escape"||E?.surface!=="popover"||!E.popover)return;o.preventDefault(),Uo(E.popover.id,"escape").catch(()=>{return})},Ke=()=>{let o=E?.surface==="popover"?E.popover:void 0;if(!o)return;let n=we||Ge;if(mo===n)return;mo=n,Mo(o.id,n).catch(()=>{return})},We=()=>{if(E?.surface!=="popover"||we)return;we=!0,Ke()},bo=(o)=>{if(E?.surface!=="popover"||o.relatedTarget!==null||!we)return;we=!1,Ke()},ko=()=>{if(E?.surface!=="popover"||Ge)return;Ge=!0,Ke()},Co=()=>{if(E?.surface!=="popover"||!Ge)return;Ge=!1,Ke()},Q=(o,n=1024)=>{if(!o.trim()||o.length>n)throw new h("HOST_REJECTED",`Identity must contain 1 to ${n} characters.`)},mt=async(o)=>{if(o.kind!=="projects")Q(o.projectId);let n=await V({...D,type:"workspace-read",id:g(d),payload:o});if(!n||!("kind"in n)||!("state"in n)||n.kind!==o.kind)throw new h("HOST_REJECTED","Host did not return workspace data.");return n},Ot=async(o,n)=>{if(o.kind!=="projects")Q(o.projectId);let A=g(d);re.set(A,n);try{await w({...D,type:"workspace-subscribe",id:g(d),payload:{subscriptionId:A,query:o}})}catch(O){if(re.delete(A),!z)j({...D,type:"workspace-unsubscribe",id:g(d),payload:{subscriptionId:A}});throw O}return()=>{if(!re.delete(A)||z)return;j({...D,type:"workspace-unsubscribe",id:g(d),payload:{subscriptionId:A}})}},vr=async(o,n)=>{if(o.kind==="session")Q(o.sessionId);if(o.kind==="project")Q(o.projectId);let A=g(d);ne.set(A,n);try{await w({...D,type:"shells-subscribe",id:g(d),payload:{subscriptionId:A,scope:o}})}catch(O){if(ne.delete(A),!z)j({...D,type:"shells-unsubscribe",id:g(d),payload:{subscriptionId:A}});throw O}return()=>{if(!ne.delete(A)||z)return;j({...D,type:"shells-unsubscribe",id:g(d),payload:{subscriptionId:A}})}},ze=async(o)=>{if("key"in o&&(o.key.length===0||o.key.length>gt))throw new h("HOST_REJECTED","Storage key must contain 1 to 128 characters.");if(o.op==="set"&&!ge(o.value))throw new h("HOST_REJECTED","Storage values must be JSON.");if(o.op==="set"&&new TextEncoder().encode(JSON.stringify(o.value)).length>It)throw new h("HOST_REJECTED","Storage value exceeds 64 KiB.");if(o.scope==="device"&&E?.features?.deviceStorage!==!0)throw new h("UNSUPPORTED","This host does not support device storage.");let n=await V({...D,type:"storage",id:g(d),payload:o});if(!n||!("storage"in n)||n.op!==o.op)throw new h("HOST_REJECTED","Host did not return storage data.");return n},Uo=(o,n)=>E?.features?.popovers!==!0&&!(E?.surface==="popover"&&E.popover?.id===o)?Promise.reject(new h("UNSUPPORTED","This host does not support popovers.")):w({...D,type:"popover-close",id:g(d),payload:n?{id:o,reason:n}:{id:o}}),Mo=(o,n)=>E?.features?.popovers!==!0&&!(E?.surface==="popover"&&E.popover?.id===o)?Promise.reject(new h("UNSUPPORTED","This host does not support popovers.")):w({...D,type:"popover-anchor",id:g(d),payload:{id:o,active:n}});return r.addEventListener("keydown",xo,!0),r.addEventListener("pointerover",We),r.addEventListener("pointermove",We),r.addEventListener("pointerout",bo),r.addEventListener("focus",ko),r.addEventListener("blur",Co),{onAction:(o)=>(te=o,()=>{if(te===o)te=null}),listProjects:async()=>{let o=await mt({kind:"projects"});if(o.kind!=="projects")throw new h("HOST_REJECTED","Expected projects.");return o},listWorktrees:async(o)=>{let n=await mt({kind:"worktrees",projectId:o});if(n.kind!=="worktrees")throw new h("HOST_REJECTED","Expected worktrees.");return n},listSessions:async(o)=>{let n=await mt({kind:"sessions",projectId:o});if(n.kind!=="sessions")throw new h("HOST_REJECTED","Expected sessions.");return n},onProjects:(o)=>Ot({kind:"projects"},(n)=>{if(n.kind==="projects")o(n)}),onWorktrees:(o,n)=>Ot({kind:"worktrees",projectId:o},(A)=>{if(A.kind==="worktrees")n(A)}),onSessions:(o,n)=>Ot({kind:"sessions",projectId:o},(A)=>{if(A.kind==="sessions")n(A)}),onRunningShells:(o,n)=>vr(o,n),readShellOutput:async(o,n)=>{Q(o,je);let A=n?.cursor;if(A!==void 0&&(!Number.isInteger(A)||A<0))throw new h("HOST_REJECTED","Shell output cursor must be a non-negative integer.");let O=n?.tailBytes;if(O!==void 0&&(!Number.isInteger(O)||O<1||O>Ye))throw new h("HOST_REJECTED",`Shell output tailBytes must be an integer between 1 and ${Ye}.`);let k=await V({...D,type:"shell-output",id:g(d),payload:{shellId:o,cursor:A,tailBytes:O}});if(!k||typeof k.output!=="string"||!Number.isFinite(k.cursor))throw new h("HOST_REJECTED","Host did not return shell output.");return k},stopShell:async(o)=>{if(Q(o,je),(await V({...D,type:"shell-stop",id:g(d),payload:{shellId:o}}))?.stopped!==!0)throw new h("HOST_REJECTED","Host did not stop the shell.");return{stopped:!0}},openSession:async(o)=>{Q(o),await w({...D,type:"open-session",id:g(d),payload:{sessionId:o}})},storage:{get:async(o,n)=>{let A=at(n),O={op:"get",key:o};if(A)O.scope=A;let v=await ze(O);return v.op==="get"&&v.found?v.value:void 0},set:async(o,n,A)=>{let O=at(A),v={op:"set",key:o,value:n};if(O)v.scope=O;await ze(v)},delete:async(o,n)=>{let A=at(n),O={op:"delete",key:o};if(A)O.scope=A;await ze(O)},keys:async(o)=>{let n=at(o),A={op:"keys"};if(n)A.scope=n;let O=await ze(A);if(O.op!=="keys")throw new h("HOST_REJECTED","Expected storage keys.");return O.keys}},onReady:(o)=>{if(i.add(o),E)o(E);return()=>{i.delete(o)}},onDirectory:(o)=>{if(l.add(o),E)o(E.directory);return()=>{l.delete(o)}},onSession:(o)=>{if(c.add(o),E)o(E.session);return()=>{c.delete(o)}},onSessionLifecycle:(o)=>{if(p.add(o),se)o(se);return()=>{p.delete(o)}},onConnection:(o)=>{if(S.add(o),E)o(E.connection);return()=>{S.delete(o)}},onSettings:(o)=>{if(T.add(o),E)o(E.settings);return()=>{T.delete(o)}},onItem:(o)=>{if(u.add(o),E)o(E.item);return()=>{u.delete(o)}},onBlock:(o)=>{if(m.add(o),E?.block)o(E.block);return()=>{m.delete(o)}},onServiceEvent:(o)=>(_.add(o),()=>{_.delete(o)}),onStatusControl:(o)=>(f.add(o),()=>{f.delete(o)}),onPopoverClosed:(o)=>(b.add(o),()=>{b.delete(o)}),setStatusControls:(o)=>{if(E?.features?.statusControls!==!0)return Promise.reject(new h("UNSUPPORTED","This host does not support status controls."));if(!Po(o))return Promise.reject(new h("HOST_REJECTED","Status controls must have unique bounded ids and valid selected options."));return w({...D,type:"status-controls",id:g(d),payload:{controls:o}})},openPopover:(o)=>{if(E?.features?.popovers!==!0)return Promise.reject(new h("UNSUPPORTED","This host does not support popovers."));if(!Ct(o))return Promise.reject(new h("HOST_REJECTED","Popover requests need bounded geometry and JSON data."));return w({...D,type:"popover-open",id:g(d),payload:o})},closePopover:Uo,setPopoverAnchorActive:Mo,onResolve:(o)=>(W=o,()=>{if(W===o)W=null}),toast:(o)=>{let n=o.message.trim();if(!n||n.length>Ze)return Promise.reject(new h("HOST_REJECTED",`Toast message must contain 1 to ${Ze} characters.`));if(o.copy&&o.copy!==!0&&(!o.copy.text.length||o.copy.text.length>qe))return Promise.reject(new h("HOST_REJECTED",`Toast copy text must contain 1 to ${qe} characters.`));return w({channel:I,v:x,type:"toast",id:g(d),payload:{...o,message:n}})},openUrl:(o)=>w({channel:I,v:x,type:"open-url",id:g(d),payload:{url:o}}),openCommit:(o)=>Nt(o)?w({channel:I,v:x,type:"open-commit",id:g(d),payload:{sha:o}}):Promise.reject(new h("HOST_REJECTED","Commit id must be 7 to 64 hex characters.")),answerBlock:(o)=>w({channel:I,v:x,type:"block-answer",id:g(d),payload:{text:o.trim().slice(0,Mt)}}),openSurface:(o)=>w({channel:I,v:x,type:"open-surface",id:g(d),payload:{surfaceId:o}}),writeClipboard:(o)=>w({channel:I,v:x,type:"clipboard-write",id:g(d),payload:{text:o}}),compose:(o)=>w({channel:I,v:x,type:"compose",id:g(d),payload:o}),attach:(o)=>w({channel:I,v:x,type:"attach",id:g(d),payload:Ie(o)}),startSession:async(o)=>{if(o.projectId!==void 0)Q(o.projectId);let n=o.worktree;if(n&&n!==!0)if(n.kind==="existing")Q(n.directory);else{if(n.name!==void 0)Q(n.name,200);if(n.baseBranch!==void 0)Q(n.baseBranch,200)}let A=await V({channel:I,v:x,type:"start-session",id:g(d),payload:Gt(o)},e.requestTimeoutMs??180000);if(!vt(A))throw new h("HOST_REJECTED","Host did not return a session.");return A},prompt:(o)=>V({channel:I,v:x,type:"prompt",id:g(d),payload:Dt(o)}).then((n)=>{if(!yt(n))throw new h("HOST_REJECTED","Host did not return a prompt result.");return n}),sessionLink:(o)=>w({channel:I,v:x,type:"session-link",id:g(d),payload:Ie(o)}),close:()=>w({channel:I,v:x,type:"close",id:g(d)}),oauthStart:()=>w({channel:I,v:x,type:"oauth-start",id:g(d)}),oauthDisconnect:()=>w({channel:I,v:x,type:"oauth-disconnect",id:g(d)}),request:(o)=>(nt(o.path)?V({channel:I,v:x,type:"request",id:g(d),payload:o}):cr()).then((n)=>{if(!st(n))throw new h("HOST_REJECTED","Host request result was empty.");return n}),serviceRequest:(o)=>(nt(o.path)?V({channel:I,v:x,type:"service-request",id:g(d),payload:o}):cr()).then((n)=>{if(!st(n))throw new h("HOST_REJECTED","Host service request result was empty.");return n}),serviceStatus:()=>V({channel:I,v:x,type:"service-status",id:g(d)}).then((o)=>{if(!Xt(o))throw new h("HOST_REJECTED","Host did not return service status.");return o}),readFile:(o)=>(xe(o)?V({channel:I,v:x,type:"file-read",id:g(d),payload:{path:o}}):it()).then((n)=>{if(!Vt(n))throw new h("HOST_REJECTED","Host did not return file content.");return n}),writeFile:(o,n)=>{if(!xe(o))return it();if(n.length>tt)return Promise.reject(new h("FILE_TOO_LARGE",`Content is over ${tt} characters.`));return V({channel:I,v:x,type:"file-write",id:g(d),payload:{path:o,content:n}}).then((A)=>{if(!Bt(A))throw new h("HOST_REJECTED","Host did not confirm the write.");return A})},listDir:(o)=>(xe(o)?V({channel:I,v:x,type:"file-list",id:g(d),payload:{path:o}}):it()).then((n)=>{if(!Ft(n))throw new h("HOST_REJECTED","Host did not return directory entries.");return n}),stat:(o)=>(xe(o)?V({channel:I,v:x,type:"file-stat",id:g(d),payload:{path:o}}):it()).then((n)=>{if(!Kt(n))throw new h("HOST_REJECTED","Host did not return file status.");return n}),generate:(o)=>{let n=o.prompt.trim(),A=o.system?.trim();if(n.length===0||n.length>ot)return Promise.reject(new h("HOST_REJECTED",`Prompt must be 1 to ${ot} characters.`));if(A!==void 0&&(A.length===0||A.length>rt))return Promise.reject(new h("HOST_REJECTED",`System prompt must be 1 to ${rt} characters.`));let O=o.maxOutputTokens===void 0?void 0:Math.min(Pt,Math.max(1,Math.floor(o.maxOutputTokens)));if(O!==void 0&&!Number.isFinite(O))return Promise.reject(new h("HOST_REJECTED","maxOutputTokens must be a number."));let v={prompt:n};if(A!==void 0)v.system=A;if(O!==void 0)v.maxOutputTokens=O;return V({channel:I,v:x,type:"generate",id:g(d),payload:v},e.requestTimeoutMs??wt).then((k)=>{if(!Wt(k))throw new h("HOST_REJECTED","Host did not return generated text.");return k})},onLateGenerateResult:(o)=>{X.add(o);for(let n of M.splice(0))N([o],n);return Ro(),()=>{X.delete(o)}},setBadge:(o)=>w({channel:I,v:x,type:"badge",id:g(d),payload:{count:$t(o)}}),setHeight:(o)=>w({channel:I,v:x,type:"resize",id:g(d),payload:{height:Ht(o)}}),onFileOpen:(o)=>{if(J.add(o),!he)he=!0,r.addEventListener("keydown",Io,!0);if(Ee)o(Ee);return()=>{J.delete(o)}},onFileSnapshot:(o)=>(_e=o,()=>{if(_e===o)_e=null}),onFileSaved:(o)=>(fe.add(o),()=>{fe.delete(o)}),reportFileChange:(o)=>At({...D,type:"file-change",payload:{dirty:o.dirty,edited:o.edited}}),requestFileSave:go,reportFileUnsupported:()=>At({...D,type:"file-unsupported"}),dispose:()=>{for(let o of re.keys())j({...D,type:"workspace-unsubscribe",id:g(d),payload:{subscriptionId:o}});re.clear();for(let o of ne.keys())j({...D,type:"shells-unsubscribe",id:g(d),payload:{subscriptionId:o}});if(ne.clear(),z=!0,W=null,te=null,_e=null,J.clear(),fe.clear(),he)r.removeEventListener("keydown",Io,!0);r.removeEventListener("message",ho),r.removeEventListener("keydown",xo,!0),r.removeEventListener("pointerover",We),r.removeEventListener("pointermove",We),r.removeEventListener("pointerout",bo),r.removeEventListener("focus",ko),r.removeEventListener("blur",Co);for(let o of oe.values())clearTimeout(o.timer),o.reject(new h("HOST_UNAVAILABLE","Host client was disposed."));oe.clear(),i.clear(),l.clear(),c.clear(),p.clear(),S.clear(),T.clear(),u.clear(),m.clear(),_.clear(),f.clear(),b.clear(),X.clear(),M.length=0}}};var lr=["browser.open","browser.snapshot","browser.click","browser.type","browser.select","browser.scroll","browser.back","browser.forward","browser.inspect","browser.capture","browser.resize","browser.close"];var Gn=new Set(lr);var dr=["none","agent","user"];var $n=new Set(dr);var Xr=[["--oc-bg","background"],["--oc-elevated","elevated"],["--oc-fg","foreground"],["--oc-muted","muted"],["--oc-subtle","subtle"],["--oc-border","border"],["--oc-hover","hover"],["--oc-selection","selection"],["--oc-focus","focus"],["--oc-primary","primary"],["--oc-muted-surface","mutedSurface"],["--oc-elevated-fg","elevatedForeground"],["--oc-active","active"],["--oc-selection-fg","selectionForeground"],["--oc-primary-fg","primaryForeground"],["--oc-primary-text","primaryText"],["--oc-success-text","successText"],["--oc-warning-text","warningText"],["--oc-error-text","errorText"],["--oc-info-text","infoText"],["--oc-success","success"],["--oc-warning","warning"],["--oc-error","error"],["--oc-info","info"],["--oc-font","font"],["--oc-mono","mono"],["--oc-radius","radius"],["--surface-background","background"],["--surface-elevated","elevated"],["--surface-foreground","foreground"],["--surface-muted-foreground","muted"],["--surface-subtle","subtle"],["--interactive-border","border"],["--interactive-hover","hover"],["--interactive-selection","selection"],["--interactive-focus-ring","focus"],["--primary","primary"],["--surface-muted","mutedSurface"],["--surface-elevated-foreground","elevatedForeground"],["--interactive-active","active"],["--interactive-selection-foreground","selectionForeground"],["--primary-foreground","primaryForeground"],["--primary-text","primaryText"],["--success-text","successText"],["--warning-text","warningText"],["--error-text","errorText"],["--info-text","infoText"],["--status-success","success"],["--status-warning","warning"],["--status-error","error"],["--status-info","info"],["--font-sans","font"],["--font-mono","mono"],["--radius","radius"]],Vr=[["--oc-syntax-keyword","--syntax-keyword","syntaxKeyword"],["--oc-syntax-string","--syntax-string","syntaxString"],["--oc-syntax-number","--syntax-number","syntaxNumber"],["--oc-syntax-function","--syntax-function","syntaxFunction"],["--oc-syntax-type","--syntax-type","syntaxType"],["--oc-syntax-comment","--syntax-comment","syntaxComment"],["--oc-syntax-variable","--syntax-variable","syntaxVariable"],["--oc-syntax-operator","--syntax-operator","syntaxOperator"]],ur=(e,r)=>{r.style.colorScheme=e.mode;for(let[t,s]of Xr)r.style.setProperty(t,e.tokens[s]);for(let[t,s,i]of Vr){let l=e.tokens[i]??"";r.style.setProperty(t,l),r.style.setProperty(s,l)}r.style.setProperty("font-family",e.tokens.font),r.style.setProperty("font-size",e.tokens.fontSize??"0.875rem"),r.style.setProperty("line-height","1.45"),r.style.setProperty("color",e.tokens.foreground)},Yt=(e,r)=>{if(ur(e.theme,r),r.dataset)r.dataset.ocSurface=e.surface,r.dataset.ocTheme=e.theme.mode};var Br={"surface-background":"bg","surface-elevated":"elevated","surface-elevated-foreground":"elevated-fg","surface-foreground":"fg","surface-muted-foreground":"muted","surface-muted":"muted-surface","surface-subtle":"subtle","interactive-border":"border","interactive-hover":"hover","interactive-active":"active","interactive-selection":"selection","interactive-selection-foreground":"selection-fg","interactive-focus-ring":"focus",primary:"primary","primary-foreground":"primary-fg","primary-text":"primary-text","success-text":"success-text","warning-text":"warning-text","error-text":"error-text","info-text":"info-text","status-success":"success","status-warning":"warning","status-error":"error","status-info":"info","font-sans":"font","font-mono":"mono",radius:"radius"},y=(e,r)=>`var(--${e}, var(--oc-${Br[e]}, ${r}))`,ae=y("surface-background","transparent"),lt=y("surface-elevated","transparent"),be=y("surface-elevated-foreground","inherit"),Y=y("surface-foreground","inherit"),L=y("surface-muted-foreground","gray"),Fr=y("surface-muted","transparent"),Ae=y("interactive-border","currentColor"),F=y("interactive-hover","transparent"),me=y("interactive-active","transparent"),Jt=y("interactive-selection","transparent"),Qt=y("interactive-selection-foreground","inherit"),ie=y("primary","currentColor"),Zt=y("primary-text","inherit"),qt=y("error-text","inherit"),Kr=y("font-sans","inherit"),eo=y("font-mono","monospace"),Sr=y("radius","9px"),to=`calc(${Sr} - 2px)`,pr=`calc(${Sr} - 4px)`,P=(e,r,t="transparent")=>`color-mix(in srgb, ${e} ${r}%, ${t})`,_r=`background-image: linear-gradient(${F}, ${F});`,oo=(e,r="0.5px")=>`box-shadow: inset 0 0 0 ${r} ${e}, var(--oc-sdk-field-lift);`,ro="border-color: var(--oc-sdk-edge); box-shadow: var(--oc-sdk-raised-lift);",Er="box-shadow: var(--oc-sdk-lit);",no=`inset 0 0.5px 0 0 ${P(Y,8)}, 0 1px 2px 0 rgb(0 0 0 / 0.4)`,Wr=`
:root {
  --oc-sdk-edge: ${P(Y,16)};
  --oc-sdk-field-bg: ${lt};
  --oc-sdk-raised-bg: ${ae};
  --oc-sdk-field-lift: inset 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --oc-sdk-raised-lift: 0 1px 1.5px 0 rgb(0 0 0 / 0.08);
  --oc-sdk-lit: inset 0 1px 0 0 rgb(255 255 255 / 0.2), 0 1px 1.5px 0 rgb(0 0 0 / 0.1);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.14);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.7), 0 1px 2px -0.5px rgb(0 0 0 / 0.06), 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 20px -4px rgb(0 0 0 / 0.06);
}
:root[data-oc-theme="dark"] {
  --oc-sdk-edge: ${P(Y,14)};
  --oc-sdk-field-bg: ${P(ae,50,lt)};
  --oc-sdk-raised-bg: ${lt};
  --oc-sdk-field-lift: ${no};
  --oc-sdk-raised-lift: ${no};
  --oc-sdk-lit: ${no};
  --oc-sdk-float-edge: rgb(0 0 0 / 0.55);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.04), inset 0 0 0 0.5px rgb(255 255 255 / 0.08), 0 8px 16px 0 rgb(0 0 0 / 0.25), 0 4px 8px 0 rgb(0 0 0 / 0.25);
}`,ct=(e)=>{let r=y(`status-${e}`,"currentColor");return`
.oc-sdk[data-tone="${e}"], .oc-sdk [data-tone="${e}"] { --oc-sdk-tone: ${r}; --oc-sdk-tone-text: ${y(`${e}-text`,"inherit")}; }`},a=(e)=>`calc(${e}rem / 14)`,zr=`
.oc-sdk { box-sizing: border-box; font-size: 0.875rem; line-height: 1.45; }
.oc-sdk *, .oc-sdk *::before, .oc-sdk *::after { box-sizing: border-box; }
/* :where() keeps the reset at zero specificity so every primitive class below overrides it. */
:where(.oc-sdk) :where(button, input, textarea), :where(button.oc-sdk, input.oc-sdk, textarea.oc-sdk) { font: inherit; color: inherit; margin: 0; }
:where(.oc-sdk) :where(button), :where(button.oc-sdk) { cursor: pointer; background: none; border: 0; padding: 0; }
.oc-sdk button:disabled, button.oc-sdk:disabled, .oc-sdk[aria-disabled="true"], .oc-sdk [aria-disabled="true"] { opacity: .5; pointer-events: none; }

.oc-sdk-btn { display: inline-flex; align-items: center; justify-content: center; gap: ${a(8)}; height: ${a(32)}; padding: 0 ${a(12)}; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; line-height: 1; white-space: nowrap; }
.oc-sdk-btn[data-size="sm"] { gap: ${a(6)}; height: ${a(28)}; padding: 0 ${a(10)}; font-size: 0.8125rem; }
.oc-sdk-btn[data-size="xs"] { gap: ${a(4)}; height: ${a(24)}; padding: 0 ${a(8)}; font-size: 0.75rem; }
.oc-sdk-btn[data-loading="true"] { opacity: .5; pointer-events: none; }
.oc-sdk-btn > .oc-sdk-spinner-ring { width: ${a(14)}; height: ${a(14)}; }

.oc-sdk-field { display: flex; flex-direction: column; gap: ${a(4)}; min-width: 0; }
.oc-sdk-field-label { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-field-note { font-size: 0.75rem; }
.oc-sdk-input { display: block; width: 100%; min-width: 0; height: ${a(32)}; padding: 0 ${a(10)}; border: 0; font-size: 0.875rem; line-height: 1.45; appearance: none; }
textarea.oc-sdk-input { height: auto; padding: ${a(8)} ${a(10)}; resize: vertical; }

.oc-sdk-search { position: relative; min-width: 0; }
.oc-sdk-search .oc-sdk-input { padding-left: ${a(34)}; padding-right: ${a(34)}; }
.oc-sdk-search-icon { position: absolute; left: ${a(11)}; top: 50%; transform: translateY(-50%); pointer-events: none; }
.oc-sdk-search-clear { position: absolute; right: ${a(6)}; top: 50%; transform: translateY(-50%); display: none; align-items: center; justify-content: center; width: ${a(24)}; height: ${a(24)}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-clear { display: inline-flex; }

.oc-sdk-select { position: relative; display: flex; flex-direction: column; gap: ${a(4)}; min-width: 0; }
.oc-sdk-trigger { display: inline-flex; align-items: center; gap: ${a(6)}; align-self: flex-start; width: auto; max-width: 100%; min-width: 0; height: ${a(28)}; padding: 0 ${a(10)}; border: 1px solid transparent; font-size: 0.8125rem; text-align: left; }
.oc-sdk-trigger-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-trigger-chevron { flex: 0 0 auto; }
.oc-sdk-popup { position: fixed; z-index: 50; display: flex; flex-direction: column; gap: ${a(2)}; min-width: ${a(160)}; max-width: calc(100vw - ${a(16)}); max-height: min(${a(320)}, calc(100vh - ${a(16)})); overflow: auto; padding: ${a(4)}; border: 1px solid transparent; }
.oc-sdk-popup-search { flex: 0 0 auto; padding: ${a(2)} ${a(2)} ${a(4)}; }
.oc-sdk-popup-search .oc-sdk-input { height: ${a(28)}; font-size: 0.8125rem; }
.oc-sdk-option { display: flex; align-items: center; gap: ${a(8)}; width: 100%; padding: ${a(6)} ${a(8)}; font-size: 0.8125rem; text-align: left; }
.oc-sdk-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-option-hint { flex: 0 0 auto; font-size: 0.75rem; }
.oc-sdk-option-check { flex: 0 0 auto; display: inline-flex; width: ${a(14)}; visibility: hidden; }
.oc-sdk-option[aria-selected="true"] > .oc-sdk-option-check { visibility: visible; }
.oc-sdk-popup-empty { padding: ${a(8)}; font-size: 0.8125rem; }

.oc-sdk-check { display: inline-flex; align-items: flex-start; gap: ${a(8)}; width: 100%; text-align: left; }
.oc-sdk-check-box { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: ${a(14)}; height: ${a(14)}; margin-top: ${a(3)}; border: 1px solid transparent; }
.oc-sdk-check-box > svg { display: none; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box > svg { display: block; }
.oc-sdk-check-thumb { flex: 0 0 auto; position: relative; width: ${a(36)}; height: ${a(20)}; --oc-sdk-thumb-travel: ${a(16)}; }
.oc-sdk-check-thumb::after { content: ""; position: absolute; top: ${a(2)}; left: ${a(2)}; width: ${a(16)}; height: ${a(16)}; }
.oc-sdk-check-text { display: flex; flex-direction: column; min-width: 0; }
.oc-sdk-check-label { font-size: 0.875rem; }
.oc-sdk-check-desc { font-size: 0.75rem; }

.oc-sdk-tabs { display: inline-flex; gap: ${a(2)}; padding: ${a(2)}; max-width: 100%; overflow: auto; }
.oc-sdk-tab { display: inline-flex; align-items: center; gap: ${a(6)}; height: ${a(28)}; padding: 0 ${a(10)}; border: 1px solid transparent; font-size: 0.8125rem; font-weight: 500; white-space: nowrap; }
.oc-sdk-tab-count { font-size: 0.75rem; font-variant-numeric: tabular-nums; }

.oc-sdk-badge { display: inline-flex; align-items: center; padding: ${a(1)} ${a(6)}; font-size: ${a(11)}; font-weight: 500; line-height: ${a(16)}; white-space: nowrap; }

.oc-sdk-list { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.oc-sdk-row { display: flex; align-items: center; gap: ${a(8)}; width: 100%; padding: ${a(6)} ${a(8)}; text-align: left; }
.oc-sdk-row-lead { flex: 0 0 auto; width: ${a(64)}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.oc-sdk-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-row-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-meta { flex: 0 0 auto; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-list-empty { padding: ${a(16)} ${a(8)}; text-align: center; font-size: 0.8125rem; }

.oc-sdk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${a(4)}; padding: ${a(40)} ${a(16)}; text-align: center; }
.oc-sdk-empty-title { margin: 0; font-size: 0.8125rem; font-weight: 600; }
.oc-sdk-empty-body { margin: 0; max-width: 32rem; font-size: 0.8125rem; }
.oc-sdk-empty-action { margin-top: ${a(12)}; }

@keyframes oc-sdk-spin { to { transform: rotate(360deg); } }
.oc-sdk-spinner { display: inline-flex; align-items: center; gap: ${a(8)}; font-size: 0.8125rem; }
.oc-sdk-spinner-ring { width: ${a(16)}; height: ${a(16)}; border: 2px solid transparent; animation: oc-sdk-spin .8s linear infinite; }
.oc-sdk-spinner[data-size="sm"] .oc-sdk-spinner-ring { width: ${a(12)}; height: ${a(12)}; }

.oc-sdk-banner { display: flex; align-items: flex-start; gap: ${a(12)}; padding: ${a(8)} ${a(12)}; border: 1px solid transparent; }
.oc-sdk-banner-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: ${a(2)}; }
.oc-sdk-banner-title { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-banner-body { font-size: 0.8125rem; }
.oc-sdk-banner-action { flex: 0 0 auto; }

.oc-sdk-separator { display: flex; align-items: center; gap: ${a(8)}; width: 100%; margin: ${a(8)} 0; font-size: 0.75rem; }
.oc-sdk-separator::before, .oc-sdk-separator::after { content: ""; flex: 1 1 auto; height: 1px; }
.oc-sdk-separator[data-labeled="false"]::after { display: none; }
.oc-sdk-popup > .oc-sdk-separator { margin: ${a(4)} 0; }

.oc-sdk-progress { display: flex; flex-direction: column; gap: ${a(4)}; min-width: 0; }
.oc-sdk-progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-progress-track { height: ${a(6)}; overflow: hidden; }
.oc-sdk-progress-fill { height: 100%; transform-origin: left; transition: transform 200ms ease-out; }
.oc-sdk-progress-value { display: inline-flex; align-items: center; gap: ${a(2)}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { font-weight: 600; }

.oc-sdk-menu { position: relative; display: inline-flex; }

.oc-sdk-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.oc-sdk-text img { display: block; max-width: 100%; margin: ${a(8)} 0; }

/* Under a finger the controls reach the app's touch sizes: rows and options 44px like its sheets, every other
   control at least 36px. Inputs keep 16px text, below which iOS zooms the page on focus. */
@media (pointer: coarse) {
  .oc-sdk-btn, .oc-sdk-input { height: ${a(40)}; }
  .oc-sdk-btn[data-size="sm"], .oc-sdk-btn[data-size="xs"], .oc-sdk-trigger, .oc-sdk-tab, .oc-sdk-popup-search .oc-sdk-input { height: ${a(36)}; }
  .oc-sdk-input, .oc-sdk-popup-search .oc-sdk-input { font-size: max(16px, 0.875rem); }
  .oc-sdk-search-clear { width: ${a(36)}; height: ${a(36)}; right: 0; }
  .oc-sdk-row, .oc-sdk-option { min-height: ${a(44)}; }
  .oc-sdk-check { min-height: ${a(36)}; padding: ${a(8)} 0; }
}
`,dt=`${Wr}
.oc-sdk { color: ${Y}; font-family: ${Kr}; }
.oc-sdk :focus-visible, .oc-sdk:focus-visible { outline: none; }
.oc-sdk :where(button, a[href], [role="button"], [role="tab"], [role="option"]):focus-visible, button.oc-sdk:focus-visible { ${_r} }
.oc-sdk-mono { font-family: ${eo}; }
.oc-sdk-muted { color: ${L}; }
${ct("success")}${ct("warning")}${ct("error")}${ct("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${ie}; --oc-sdk-tone-text: ${Zt}; }

.oc-sdk-btn { border-radius: ${to}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${pr}; }
.oc-sdk-btn[data-variant="default"] { color: ${Zt}; background: ${P(ie,10,ae)}; border-color: ${P(ie,12)}; ${Er} }
.oc-sdk-btn[data-variant="default"]:hover { background: ${P(ie,16,ae)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${P(ie,22,ae)}; box-shadow: none; }
.oc-sdk-btn[data-variant="secondary"] { background: ${Fr}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${F}, ${F}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${me}, ${me}); }
.oc-sdk-btn[data-variant="outline"] { background: var(--oc-sdk-raised-bg); color: ${be}; ${ro} }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${F}, ${F}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${me}, ${me}); box-shadow: none; }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${F}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${me}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${y("status-error","red")}; color: ${qt}; background: ${P("var(--oc-sdk-tone)",7,ae)}; border-color: ${P("var(--oc-sdk-tone)",12)}; ${Er} }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${P("var(--oc-sdk-tone)",9,ae)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${P("var(--oc-sdk-tone)",11,ae)}; box-shadow: none; }

.oc-sdk-field-note { color: ${L}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${qt}; }
.oc-sdk-input { border-radius: ${to}; background: var(--oc-sdk-field-bg); color: ${be}; ${oo("var(--oc-sdk-edge)")} transition: background 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${L}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${F}, ${F}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { ${oo(P(Y,26),"1px")} }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input, .oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { ${oo(y("status-error","red"),"1px")} }
.oc-sdk-input[data-mono="true"] { font-family: ${eo}; }

.oc-sdk-search-icon { color: ${L}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${ie}; }
.oc-sdk-search-clear { border-radius: ${pr}; color: ${L}; }
.oc-sdk-search-clear:hover { background: ${F}; color: ${Y}; }

.oc-sdk-trigger { border-radius: ${to}; background: var(--oc-sdk-raised-bg); color: ${be}; ${ro} transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${F}, ${F}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${me}, ${me}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${L}; }
.oc-sdk-trigger-chevron { color: ${L}; }
/* The app's floating level: the glass edge (a hairline ring and a lit top line, dark outside and light inside in dark themes) over soft shadows. The outer ring is the border, over the page like the app's. */
.oc-sdk-popup { --surface-foreground: ${be}; border-color: var(--oc-sdk-float-edge); border-radius: 12px; background: ${lt}; background-clip: padding-box; color: ${be}; box-shadow: var(--oc-sdk-float); }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${F}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${Jt}; color: ${Qt}; }
.oc-sdk-option-check { color: ${Y}; }
.oc-sdk-option[data-destructive="true"] { color: ${qt}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${P(y("status-error","red"),10)}; }
.oc-sdk-option-hint { color: ${L}; }
.oc-sdk-popup-empty { color: ${L}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${Ae}; border-radius: 4px; color: ${Y}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${P(Y,60,Ae)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${Ae}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${ae}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${ie}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(var(--oc-sdk-thumb-travel, 16px)); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${_r} }
.oc-sdk-check-desc { color: ${L}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${P(Y,4)}; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.16); }
.oc-sdk-tab { border-radius: 8px; color: ${L}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${Y}; }
.oc-sdk-tab[aria-selected="true"] { color: ${Qt}; background: ${Jt}; border-color: ${Ae}; }
.oc-sdk-tabs[data-track="true"] .oc-sdk-tab[aria-selected="true"] { color: ${be}; background: var(--oc-sdk-raised-bg); ${ro} }
.oc-sdk-tab-count { color: ${L}; }

/* The app's neutral badge: a step of the text colour, the same in every theme. */
.oc-sdk-badge { border-radius: 9999px; background: ${P(Y,6)}; color: ${L}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${P("var(--oc-sdk-tone)",15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${F}; }
.oc-sdk-row[aria-selected="true"] { background: ${Jt}; color: ${Qt}; }
.oc-sdk-row-lead { font-family: ${eo}; color: ${L}; }
.oc-sdk-row-sub { color: ${L}; }
.oc-sdk-row-meta { color: ${L}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${L}; }

.oc-sdk-empty-body { color: ${L}; }

.oc-sdk-spinner { color: ${L}; }
.oc-sdk-spinner-ring { border-color: ${Ae}; border-top-color: ${ie}; border-radius: 9999px; }

/* Set apart by its tint alone, like the app's banners. */
.oc-sdk-banner { border-color: transparent; border-radius: 8px; background: ${P("var(--oc-sdk-tone)",10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${L}; }

.oc-sdk-separator { color: ${L}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${P(Ae,40)}; }

.oc-sdk-progress-label { color: ${L}; }
/* The app's progress: a groove a step of the text colour, green once done. Older bundles mark done only through aria-valuenow. */
.oc-sdk-progress-track { border-radius: 9999px; background: ${P(Y,6)}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${ie}); }
.oc-sdk-progress-track[aria-valuenow="100"] > .oc-sdk-progress-fill:not([data-tone]) { background: ${y("status-success","currentColor")}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { color: ${y("success-text","inherit")}; }

.oc-sdk-text a { color: ${Zt}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${P(Ae,60)}; }
`,C=`
${Rt}
${zr}
${dt}`;var Tr="oc-sdk-ui-style",Se=(e)=>{while(e.firstChild)e.removeChild(e.firstChild)},U=(e)=>{let r=document.getElementById(Tr);if(r instanceof HTMLStyleElement){if(r.textContent!==e)r.textContent=e;return}ht(document);let t=document.createElement("style");t.id=Tr,t.textContent=e,document.head.appendChild(t)},R=(e,r)=>{let t=document.createElement(e);if(r)t.className=r;return t},K=(e)=>{let r=R("button",e);return r.type="button",r},G=(e,r)=>{let t=r??"";if(e.textContent!==t)e.textContent=t},Z=(e,r,t)=>{if(t===void 0||t===null||t==="")e.removeAttribute(r);else if(e.getAttribute(r)!==t)e.setAttribute(r,t)},fr=(e,r)=>{let t=(s)=>{if(s.target instanceof Node&&e.contains(s.target))return;r()};return document.addEventListener("pointerdown",t,!0),()=>{document.removeEventListener("pointerdown",t,!0)}};var jr=()=>{let e=document.createElement("span");return e.className="oc-sdk-spinner-ring",e.setAttribute("aria-hidden","true"),e},ce=(e,r)=>{U(C);let t=r,s=K("oc-sdk oc-sdk-btn"),i=jr(),l=document.createElement("span");s.append(l),e.append(s);let c=()=>{if(s.dataset.variant=t.variant??"default",s.dataset.size=t.size??"default",s.disabled=Boolean(t.disabled)||Boolean(t.loading),s.dataset.loading=t.loading?"true":"false",s.setAttribute("aria-busy",t.loading?"true":"false"),t.loading&&i.parentNode!==s)s.prepend(i);else if(!t.loading&&i.parentNode===s)i.remove();G(l,t.label)},p=()=>{if(t.disabled||t.loading)return;t.onClick()};return s.addEventListener("click",p),c(),{update:(S)=>{t={...t,...S},c()},dispose:()=>{s.removeEventListener("click",p),s.remove()}}};var Ar="http://www.w3.org/2000/svg",Yr={search:"M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z",chevron:"M12 13.172l4.95-4.95 1.414 1.414L12 16 5.636 9.636 7.05 8.222z",check:"M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z",close:"M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z"},q=(e,r,t)=>{let s=document.createElementNS(Ar,"svg");if(s.setAttribute("viewBox","0 0 24 24"),s.setAttribute("width",String(r)),s.setAttribute("height",String(r)),s.style.width=a(r),s.style.height=a(r),s.setAttribute("aria-hidden","true"),s.setAttribute("fill","currentColor"),t)s.setAttribute("class",t);let i=document.createElementNS(Ar,"path");return i.setAttribute("d",Yr[e]),s.append(i),s};var so=(e,r)=>{U(C);let t=r,s=R("div","oc-sdk oc-sdk-search"),i=R("input","oc-sdk-input");i.type="text",i.spellcheck=!1,i.autocomplete="off",i.setAttribute("role","searchbox");let l=K("oc-sdk-search-clear");l.append(q("close",14)),l.tabIndex=-1,s.append(q("search",16,"oc-sdk-search-icon"),i,l),e.append(s);let c=()=>{let u=t.placeholder??"Search";if(Z(i,"placeholder",u),i.setAttribute("aria-label",t.label??u),l.setAttribute("aria-label","Clear search"),i.value!==t.value)i.value=t.value;s.dataset.active=t.value.trim()===""?"false":"true"},p=()=>{if(t.value!=="")t.onChange("");i.focus()},S=()=>{t.onChange(i.value)},T=(u)=>{if(u.key==="Escape"&&i.value!=="")u.preventDefault(),p()};if(i.addEventListener("input",S),i.addEventListener("keydown",T),l.addEventListener("click",p),c(),t.autofocus)i.focus();return{update:(u)=>{t={...t,...u},c()},dispose:()=>{i.removeEventListener("input",S),i.removeEventListener("keydown",T),l.removeEventListener("click",p),s.remove()}}};var le=(e,r="vertical")=>{let[t,s]=r==="vertical"?["ArrowDown","ArrowUp"]:["ArrowRight","ArrowLeft"];if(e.key===t||e.ctrlKey&&e.key.toLowerCase()==="n")return"next";if(e.key===s||e.ctrlKey&&e.key.toLowerCase()==="p")return"previous";if(e.key==="Home")return"first";if(e.key==="End")return"last";return null},Te=(e,r,t)=>{let s=e.filter((S)=>!S.disabled);if(s.length===0)return null;let i=s[0],l=s[s.length-1];if(t==="first"||!i||!l)return i?.id??null;if(t==="last")return l.id;let c=s.findIndex((S)=>S.id===r);if(c===-1)return t==="next"?i.id:l.id;return s[Math.min(s.length-1,Math.max(0,c+(t==="next"?1:-1)))]?.id??null};var mr=(e,r)=>`${e}-${r??""}`,io=(e,r,t,s)=>{let i=K("oc-sdk-option");if(i.id=mr(e,t.id),i.setAttribute("role",r),i.tabIndex=-1,i.disabled=Boolean(t.disabled),r==="option")i.setAttribute("aria-selected",t.selected?"true":"false");i.dataset.destructive=t.destructive?"true":"false";let l=R("span","oc-sdk-option-label");if(l.textContent=t.label,i.append(l),t.hint){let c=R("span","oc-sdk-option-hint");c.textContent=t.hint,i.append(c)}if(r==="option"){i.dataset.mark="check";let c=R("span","oc-sdk-option-check");c.append(q("check",14)),i.append(c)}return i.addEventListener("pointerenter",s.hover),i.addEventListener("click",s.pick),i},ao=(e,r,t,s)=>{let i=mr(t,s);for(let l of Array.from(e.children))if(l instanceof HTMLElement&&l.classList.contains("oc-sdk-option"))l.dataset.active=l.id===i?"true":"false";Z(r,"aria-activedescendant",s?i:null),e.querySelector('[data-active="true"]')?.scrollIntoView({block:"nearest"})};var Jr=(e,r)=>{let t=r.getBoundingClientRect();e.style.minWidth=`${Math.round(t.width)}px`,e.style.left=`${Math.round(t.left)}px`,e.style.top=`${Math.round(t.bottom+4)}px`;let s=e.offsetHeight,i=window.innerHeight-t.bottom-8;if(s>i&&t.top-8>i)e.style.top=`${Math.max(8,Math.round(t.top-4-s))}px`;let l=t.left+e.offsetWidth-window.innerWidth+8;if(l>0)e.style.left=`${Math.max(8,Math.round(t.left-l))}px`},co=(e,r,t,s)=>{e.append(t),Jr(t,r);let i=fr(e,s),l=()=>{s()},c=(p)=>{if(p.target instanceof Node&&t.contains(p.target))return;s()};return window.addEventListener("resize",l),window.addEventListener("scroll",c,!0),()=>{i(),window.removeEventListener("resize",l),window.removeEventListener("scroll",c,!0),t.remove()}};var Or=(e,r)=>{let t=r.trim().toLowerCase();if(!t)return[...e];return e.filter((s)=>s.label.toLowerCase().includes(t)||s.id.toLowerCase().includes(t))},Qr=0,lo=(e,r)=>{U(C);let t=r,s=`oc-sdk-select-${Qr+=1}`,i=R("div","oc-sdk oc-sdk-select"),l=R("span","oc-sdk-field-label");l.id=`${s}-label`;let c=K("oc-sdk-trigger");c.setAttribute("aria-haspopup","listbox"),c.setAttribute("aria-labelledby",l.id);let p=R("span","oc-sdk-trigger-value");c.append(p,q("chevron",14,"oc-sdk-trigger-chevron")),i.append(l,c),e.append(i);let S="",T=null,u=null,m=R("div","oc-sdk oc-sdk-popup"),_=R("div","oc-sdk-popup-search"),f=R("input","oc-sdk-input");f.type="text",f.autocomplete="off",_.append(f);let b=R("div");b.setAttribute("role","listbox"),b.tabIndex=-1,m.append(b);let X=()=>Or(t.options,t.searchable?S:""),M=()=>t.searchable?f:b,W=(d)=>{T=d,ao(b,M(),s,d)},te=()=>{Se(b);let d=X();if(d.length===0){let E=R("div","oc-sdk-popup-empty");E.textContent="No matches",b.append(E)}for(let E of d)b.append(io(s,"option",{...E,selected:E.id===t.value},{hover:()=>W(E.id),pick:()=>_e(E.id)}));W(d.some((E)=>E.id===T)?T:d[0]?.id??null)},J=()=>{let d=u;u=null,d?.(),S="",f.value="",c.setAttribute("aria-expanded","false")},fe=()=>{if(u||t.disabled)return;if(T=t.value,f.placeholder=t.searchPlaceholder??"Search",t.searchable)m.prepend(_);else _.remove();te(),u=co(i,c,m,J),c.setAttribute("aria-expanded","true"),M().focus()},_e=(d)=>{if(J(),c.focus(),d!==t.value)t.onChange(d)},Ee=()=>{if(u)J();else fe()},he=(d)=>{if(!u&&le(d))d.preventDefault(),fe()},oe=(d)=>{let E=le(d);if(E)d.preventDefault(),W(Te(X(),T,E));else if(d.key==="Enter"){if(d.preventDefault(),T)_e(T)}else if(d.key==="Escape")d.preventDefault(),J(),c.focus();else if(t.searchable&&d.target!==f&&d.key.length===1&&!d.ctrlKey&&!d.metaKey)f.focus()},re=()=>{S=f.value,te()},ne=(d)=>{if(u&&!(d.relatedTarget instanceof Node&&i.contains(d.relatedTarget)))J()},z=()=>{G(l,t.label),l.hidden=!t.label;let d=t.options.find((E)=>E.id===t.value);if(G(p,d?.label??t.placeholder??"Select"),p.dataset.empty=d?"false":"true",c.disabled=Boolean(t.disabled),u)te()};return c.addEventListener("click",Ee),c.addEventListener("keydown",he),m.addEventListener("keydown",oe),f.addEventListener("input",re),i.addEventListener("focusout",ne),z(),{update:(d)=>{t={...t,...d},z()},dispose:()=>{J(),c.removeEventListener("click",Ee),c.removeEventListener("keydown",he),m.removeEventListener("keydown",oe),f.removeEventListener("input",re),i.removeEventListener("focusout",ne),i.remove()}}};var Zr=(e,r,t)=>{U(C);let s=r,i=K("oc-sdk oc-sdk-check");i.setAttribute("role",t);let l=R("span",t==="switch"?"oc-sdk-check-thumb":"oc-sdk-check-box");if(t==="checkbox")l.append(q("check",12));let c=R("span","oc-sdk-check-text"),p=R("span","oc-sdk-check-label"),S=R("span","oc-sdk-check-desc");c.append(p,S),i.append(l,c),e.append(i);let T=()=>{i.setAttribute("aria-checked",s.checked?"true":"false"),i.disabled=Boolean(s.disabled),G(p,s.label),G(S,s.description),S.hidden=!s.description},u=()=>{if(!s.disabled)s.onChange(!s.checked)};return i.addEventListener("click",u),T(),{update:(m)=>{s={...s,...m},T()},dispose:()=>{i.removeEventListener("click",u),i.remove()}}};var ut=(e,r)=>Zr(e,r,"switch");var uo=(e,r)=>{U(C);let t=r,s=R("div","oc-sdk oc-sdk-tabs");s.setAttribute("role","tablist"),e.append(s);let i=()=>{Se(s),s.dataset.track=t.trackBackground?"true":"false";for(let c of t.items){let p=K("oc-sdk-tab");p.setAttribute("role","tab");let S=c.id===t.activeId;p.setAttribute("aria-selected",S?"true":"false"),p.tabIndex=S?0:-1,p.dataset.id=c.id;let T=R("span");if(T.textContent=c.label,p.append(T),c.count!==void 0){let u=R("span","oc-sdk-tab-count");u.textContent=String(c.count),p.append(u)}p.addEventListener("click",()=>{if(c.id!==t.activeId)t.onChange(c.id)}),s.append(p)}},l=(c)=>{let p=le(c,"horizontal");if(!p)return;let S=Te(t.items,t.activeId,p);if(S&&S!==t.activeId){c.preventDefault(),t.onChange(S);let T=s.querySelector(`[data-id="${CSS.escape(S)}"]`);if(T instanceof HTMLElement)T.focus()}};return s.addEventListener("keydown",l),i(),{update:(c)=>{t={...t,...c},i()},dispose:()=>{s.removeEventListener("keydown",l),s.remove()}}};var pt=(e,r)=>{Z(e,"data-tone",r&&r!=="neutral"?r:null)},de=(e,r)=>{U(C);let t=r,s=R("span","oc-sdk oc-sdk-badge");e.append(s);let i=()=>{G(s,t.label),pt(s,t.tone)};return i(),{update:(l)=>{t={...t,...l},i()},dispose:()=>{s.remove()}}};var qr=0,po=(e,r)=>{U(C);let t=r,s=`oc-sdk-list-${qr+=1}`,i=R("div","oc-sdk oc-sdk-list");i.setAttribute("role","listbox"),i.tabIndex=0,e.append(i);let l=null,c=(m)=>`${s}-${m}`,p=(m)=>{l=m;for(let _ of Array.from(i.children))if(_ instanceof HTMLElement)_.dataset.active=_.id===c(m??"")?"true":"false";Z(i,"aria-activedescendant",m?c(m):null),i.querySelector('[data-active="true"]')?.scrollIntoView({block:"nearest"})},S=(m,_)=>{let f=R("span",m);return f.textContent=_,f},T=()=>{if(Se(i),Z(i,"aria-label",t.ariaLabel),t.items.length===0){i.append(S("oc-sdk-list-empty",t.emptyText??"Nothing here")),p(null);return}for(let _ of t.items){let f=K("oc-sdk-row");if(f.id=c(_.id),f.setAttribute("role","option"),f.setAttribute("aria-selected",_.id===t.selectedId?"true":"false"),f.disabled=Boolean(_.disabled),f.tabIndex=-1,_.leading)f.append(S("oc-sdk-row-lead",_.leading));let b=R("span","oc-sdk-row-main");if(b.append(S("oc-sdk-row-title",_.title)),_.subtitle)b.append(S("oc-sdk-row-sub",_.subtitle));if(f.append(b),_.badge){let X=S("oc-sdk-badge",_.badge.label);pt(X,_.badge.tone),f.append(X)}if(_.meta)f.append(S("oc-sdk-row-meta",_.meta));f.addEventListener("click",()=>t.onSelect(_.id)),i.append(f)}let m=t.items.some((_)=>_.id===l&&!_.disabled);p(m?l:t.selectedId??null)},u=(m)=>{let _=le(m);if(_){m.preventDefault(),p(Te(t.items,l,_));return}if((m.key==="Enter"||m.key===" ")&&l)m.preventDefault(),t.onSelect(l)};return i.addEventListener("keydown",u),T(),{update:(m)=>{t={...t,...m},T()},dispose:()=>{i.removeEventListener("keydown",u),i.remove()}}};var _o=(e,r)=>{U(C);let t=r,s=R("div","oc-sdk oc-sdk-empty"),i=R("h2","oc-sdk-empty-title"),l=R("p","oc-sdk-empty-body"),c=R("div","oc-sdk-empty-action");s.append(i,l,c),e.append(s);let p=null,S=()=>{if(G(i,t.title),G(l,t.body),l.hidden=!t.body,c.hidden=!t.action,!t.action){p?.dispose(),p=null;return}let T={label:t.action.label,onClick:t.action.onClick};if(p)p.update(T);else p=ce(c,{...T,variant:"outline",size:"sm"})};return S(),{update:(T)=>{t={...t,...T},S()},dispose:()=>{p?.dispose(),p=null,s.remove()}}};var $e=(e,r)=>{U(C);let t=r,s=R("div","oc-sdk oc-sdk-banner"),i=R("div","oc-sdk-banner-text"),l=R("div","oc-sdk-banner-title"),c=R("div","oc-sdk-banner-body"),p=R("div","oc-sdk-banner-action");i.append(l,c),s.append(i,p),e.append(s);let S=null,T=()=>{if(s.dataset.tone=t.tone,s.setAttribute("role",t.tone==="error"||t.tone==="warning"?"alert":"status"),G(l,t.title),G(c,t.body),c.hidden=!t.body,p.hidden=!t.action,!t.action){S?.dispose(),S=null;return}let u={label:t.action.label,onClick:t.action.onClick};if(S)S.update(u);else S=ce(p,{...u,variant:"outline",size:"xs"})};return T(),{update:(u)=>{t={...t,...u},T()},dispose:()=>{S?.dispose(),S=null,s.remove()}}};var Eo=(e,r={})=>{U(C);let t=r,s=R("div","oc-sdk oc-sdk-separator");s.setAttribute("role","separator");let i=R("span");s.append(i),e.append(s);let l=()=>{G(i,t.label),i.hidden=!t.label,s.dataset.labeled=t.label?"true":"false"};return l(),{update:(c)=>{t={...t,...c},l()},dispose:()=>{s.remove()}}};var en=`
${dt}
*, *::before, *::after {
  box-sizing: border-box;
}
[hidden] {
  display: none !important;
}
html, body {
  margin: 0;
  padding: 0;
  background: var(--surface-background, var(--oc-bg, transparent));
  color: var(--surface-foreground, var(--oc-fg, inherit));
  font-family: var(--font-sans, var(--oc-font, system-ui, sans-serif));
  line-height: 1.4;
}
#root {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  min-block-size: 100vh;
}
.ag-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.ag-header-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.ag-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius, var(--oc-radius, 9px));
  border: 1px solid var(--interactive-border, var(--oc-border, rgba(128, 128, 128, 0.22)));
  background: var(--surface-elevated, var(--oc-elevated, rgba(128, 128, 128, 0.06)));
}
.ag-controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
  gap: 0.6rem;
  align-items: center;
}
.ag-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-badges-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.ag-stats-line {
  font-size: 0.76rem;
  color: var(--surface-muted-foreground, var(--oc-muted, inherit));
  font-variant-numeric: tabular-nums;
}
.ag-filters {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ag-filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-search-wrap {
  flex: 1 1 11rem;
  min-inline-size: 0;
}
.ag-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-block-size: 19rem;
  overflow-y: auto;
}
.ag-inspector {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border-radius: var(--radius, var(--oc-radius, 9px));
  border: 1px solid var(--interactive-border, var(--oc-border, rgba(128, 128, 128, 0.22)));
  background: var(--surface-elevated, var(--oc-elevated, rgba(128, 128, 128, 0.05)));
}
.ag-inspector-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-inspector-meta {
  font-size: 0.75rem;
  color: var(--surface-muted-foreground, var(--oc-muted, inherit));
  font-variant-numeric: tabular-nums;
}
.ag-field-block {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.ag-field-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--surface-muted-foreground, var(--oc-muted, inherit));
}
.ag-code-box {
  margin: 0;
  padding: 0.5rem 0.6rem;
  border-radius: calc(var(--radius, var(--oc-radius, 9px)) - 2px);
  border: 1px solid var(--interactive-border, var(--oc-border, rgba(128, 128, 128, 0.2)));
  background: var(--surface-background, var(--oc-bg, transparent));
  font-family: var(--font-mono, var(--oc-mono, ui-monospace, monospace));
  font-size: 0.76rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  max-block-size: 9rem;
  overflow-y: auto;
}
.ag-prose-box {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.48;
  white-space: pre-wrap;
  word-break: break-word;
}
.ag-kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 0.45rem 0.75rem;
  font-size: 0.76rem;
}
.ag-kv-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-inline-size: 0;
}
.ag-kv-key {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--surface-muted-foreground, var(--oc-muted, inherit));
}
.ag-kv-val {
  font-family: var(--font-mono, var(--oc-mono, ui-monospace, monospace));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`,Le=jt(),tn=document.querySelector("#root"),Rr=document.createElement("style");Rr.textContent=en;document.head.appendChild(Rr);var So=!1,Pe=null,pe=null,B=null,Be=null,Oe=!1,ve="ALL",ft="",Ce=!1,ye=null,Et=null,hr,gr,To,fo,St,Ir,xr,He,Ve,Ue,ke=null,br,Ao,Xe,kr,Me,Cr,Ne,_t=null,Re,ue;async function Ur(e,r,t){let s=await Le.serviceRequest({method:e,path:r,...t!==void 0?{body:JSON.stringify(t)}:{}}),i=s.body?JSON.parse(s.body):{};if(s.status>=400)throw Error(i.message||`Service request ${r} failed (${s.status})`);return i}function Mr(e){if(e==="ALLOW")return"success";if(e==="BLOCK")return"error";return"warning"}function on(e){switch(e?.toUpperCase()){case"LOW":return"success";case"MEDIUM":return"warning";case"HIGH":case"CRITICAL":return"error";default:return"neutral"}}function rn(e){if(!Number.isFinite(e)||e<=0)return"unknown";try{return new Date(e).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}catch{return String(e)}}function nn(e){if(!Number.isFinite(e)||e<=0)return"";let r=Math.max(0,Math.round((Date.now()-e)/1000));if(r<60)return`${r}s ago`;let t=Math.round(r/60);if(t<60)return`${t}m ago`;let s=Math.round(t/60);if(s<24)return`${s}h ago`;return`${Math.round(s/24)}d ago`}function sn(){let e=B?.evaluations??[],r=ft.trim().toLowerCase();return e.filter((t)=>{if(Ce&&pe&&t.sessionID!==pe)return!1;if(ve!=="ALL"&&t.verdict!==ve)return!1;if(r){if(!(t.toolName.toLowerCase().includes(r)||t.commandPreview.toLowerCase().includes(r)||t.commandString.toLowerCase().includes(r)||(t.reasoning?.toLowerCase().includes(r)??!1)||(t.userPrompt?.toLowerCase().includes(r)??!1)||t.sessionID.toLowerCase().includes(r)))return!1}return!0})}async function Fe(){let e=new URLSearchParams;if(Pe)e.set("directory",Pe);let r=e.toString();try{B=await Ur("GET",`/api/state${r?`?${r}`:""}`),Be=null}catch(t){Be=t instanceof Error?t.message:String(t)}ee()}async function Tt(e,r){if(Oe)return;Oe=!0,ee();try{let t=new URLSearchParams;if(Pe)t.set("directory",Pe);let s=t.toString();B=(await Ur("POST",`/api/action${s?`?${s}`:""}`,e)).state,Be=null,await Le.toast({kind:"success",message:r})}catch(t){let s=t instanceof Error?t.message:String(t);await Le.toast({kind:"error",message:s})}finally{Oe=!1,ee()}}function an(){if(ke)ke.dispose(),ke=null;if(Ue.innerHTML="",Be){ke=$e(Ue,{tone:"error",title:"AutoGate service error",body:Be,action:{label:"Retry",onClick:()=>void Fe()}});return}if(!B)return;let e=B.inFlight.filter((r)=>r.awaitingReview);if(e.length>0){let r=e[0];ke=$e(Ue,{tone:"warning",title:`${e.length} action${e.length===1?"":"s"} awaiting review`,body:`${r.toolName}${r.commandString?`: ${r.commandString}`:""}`});return}if(B.breaker.tripped)ke=$e(Ue,{tone:"error",title:`Circuit breaker tripped (${B.breaker.consecutiveBlocks}/${B.breaker.threshold})`,body:"Consecutive blocks reached threshold. Actions will route to manual review until reset.",action:{label:"Reset Breaker",onClick:()=>void Tt({action:"resetBreaker"},"Circuit breaker reset")}})}function cn(e){if(ue.innerHTML="",e.length===0){Re.hidden=!0;return}Re.hidden=!1;let r=e.find((u)=>u.id===ye)??e[0]??null;if(!r){Re.hidden=!0;return}ye=r.id;let t=document.createElement("div");t.className="ag-inspector-head";let s=document.createElement("div");if(s.className="ag-badges-wrap",de(s,{label:r.verdict,tone:Mr(r.verdict)}),r.riskLevel)de(s,{label:`Risk: ${r.riskLevel}`,tone:on(r.riskLevel)});if(r.userAuthorization)de(s,{label:`Auth: ${r.userAuthorization}`,tone:"info"});if(r.cascade?.winner)de(s,{label:r.cascade.winner==="system1"?"System 1 fast-path":"System 2 escalated",tone:r.cascade.winner==="system1"?"primary":"neutral"});let i=document.createElement("span");i.className="ag-inspector-meta",i.textContent=`${rn(r.timestamp)} · ${r.durationMs}ms · ${r.sourceFormat}`,t.append(s,i),ue.appendChild(t);let l=document.createElement("div");l.className="ag-field-block";let c=document.createElement("span");c.className="ag-field-label",c.textContent=`Command / Action (${r.toolName})`;let p=document.createElement("pre");if(p.className="ag-code-box",p.textContent=r.commandPreview||r.commandString||r.toolName,l.append(c,p),ue.appendChild(l),r.reasoning){let u=document.createElement("div");u.className="ag-field-block";let m=document.createElement("span");m.className="ag-field-label",m.textContent="Reasoning";let _=document.createElement("p");_.className="ag-prose-box",_.textContent=r.reasoning,u.append(m,_),ue.appendChild(u)}if(r.userPrompt){let u=document.createElement("div");u.className="ag-field-block";let m=document.createElement("span");m.className="ag-field-label",m.textContent="User Prompt";let _=document.createElement("p");_.className="ag-prose-box",_.textContent=r.userPrompt,u.append(m,_),ue.appendChild(u)}let S=document.createElement("div");S.className="ag-kv-grid";let T=(u,m)=>{let _=document.createElement("div");_.className="ag-kv-item";let f=document.createElement("span");f.className="ag-kv-key",f.textContent=u;let b=document.createElement("span");b.className="ag-kv-val",b.textContent=m,b.title=m,_.append(f,b),S.appendChild(_)};if(T("Session",r.sessionID||"n/a"),T("Latency",`${r.durationMs} ms`),r.model)T("Model",r.model);if(r.cascade){let u=r.cascade;if(u.mode)T("Cascade Mode",u.mode);if(u.winner)T("Winner",u.winner);if(u.escalationReason)T("Escalation",u.escalationReason);if(u.s1LatencyMs!==void 0)T("S1 Latency",`${u.s1LatencyMs} ms`);if(u.s2LatencyMs!==void 0)T("S2 Latency",`${u.s2LatencyMs} ms`);if(u.s2Aborted!==void 0)T("S2 Aborted",String(u.s2Aborted));if(u.inScopeScore!==void 0)T("In-Scope",u.inScopeScore.toFixed(3));if(u.injectionScore!==void 0)T("Injection",u.injectionScore.toFixed(3));if(u.s1Probs){let m=Object.entries(u.s1Probs).map(([_,f])=>`${_}:${f.toFixed(2)}`).join(" ");if(m)T("S1 Probs",m)}}ue.appendChild(S)}function ee(){if(!So)return;let e=B?.config,r=B?.runtimes.length??0;hr.update({label:r>0?`${r} live`:"Config",tone:r>0?"info":"neutral"}),gr.update({disabled:Oe}),To.update({checked:e?.autoMode??!0,disabled:Oe}),fo.update({value:e?.reviewFallbackMode??"ntfy",disabled:Oe});let t=B?.systemOneHealth;if(!t||!t.enabled)St.update({label:"System 1: disabled",tone:"neutral"});else if(t.reachable)St.update({label:`System 1: ${t.mode} · reachable`,tone:"success"});else St.update({label:`System 1: ${t.mode} · unreachable`,tone:"error"});let s=B?.breaker,i=s?.consecutiveBlocks??0,l=s?.threshold??3;Ir.update({label:`Breaker: ${i}/${l}`,tone:s?.tripped?"error":i>0?"warning":"success"}),He.hidden=i===0,xr.update({disabled:Oe||i===0});let c=B?.stats;if(c&&c.total>0)Ve.textContent=`${c.total} evals · ${c.allow} ALLOW · ${c.block} BLOCK · ${c.unsure} UNSURE · avg ${c.avgLatencyMs}ms · S1 ${c.s1FastPathPct}%`;else Ve.textContent=e?`Log: ${e.evalLogFile} · Model: ${e.classifierModel}`:"Loading AutoGate state…";an();let p=(B?.evaluations??[]).filter((_)=>!Ce||!pe||_.sessionID===pe),S=p.filter((_)=>_.verdict==="ALLOW").length,T=p.filter((_)=>_.verdict==="BLOCK").length,u=p.filter((_)=>_.verdict==="UNSURE").length;br.update({activeId:ve,items:[{id:"ALL",label:"All",count:p.length},{id:"ALLOW",label:"ALLOW",count:S},{id:"BLOCK",label:"BLOCK",count:T},{id:"UNSURE",label:"UNSURE",count:u}]}),Xe.hidden=!pe,kr.update({checked:Ce&&Boolean(pe),disabled:!pe});let m=sn();if(m.length===0){if(Me.hidden=!0,Ne.hidden=!1,_t)_t.dispose(),_t=null;let _=ve!=="ALL"||ft.trim().length>0||Ce;_t=_o(Ne,{title:B?"No matching evaluations":"Loading evaluations…",body:_?"Adjust the verdict tabs, search query, or session toggle to see more entries.":"AutoGate evaluation decisions will appear here once permissions are evaluated.",..._?{action:{label:"Clear filters",onClick:()=>{ve="ALL",ft="",Ce=!1,Ao.update({value:""}),ee()}}}:{}})}else{if(Ne.hidden=!0,Me.hidden=!1,!m.some((f)=>f.id===ye))ye=m[0]?.id??null;let _=m.map((f)=>({id:f.id,leading:f.toolName,title:f.commandPreview||f.toolName,subtitle:`${nn(f.timestamp)}${f.cascade?.winner?` · ${f.cascade.winner==="system1"?"S1":"S2"}`:""}${f.reasoning?` · ${f.reasoning}`:""}`,badge:{label:f.verdict,tone:Mr(f.verdict)},meta:`${f.durationMs}ms`}));Cr.update({items:_,selectedId:ye})}cn(m)}function ln(){let e=document.createElement("div");e.className="ag-header";let r=document.createElement("div");r.className="ag-title-group";let t=document.createElement("h1");t.className="ag-title",t.textContent="AutoGate";let s=document.createElement("span");hr=de(s,{label:"Config",tone:"neutral"}),r.append(t,s);let i=document.createElement("div");i.className="ag-header-actions",gr=ce(i,{label:"Refresh",variant:"outline",size:"xs",onClick:()=>void Fe()}),e.append(r,i);let l=document.createElement("div");l.className="ag-card";let c=document.createElement("div");c.className="ag-controls-grid";let p=document.createElement("div");To=ut(p,{label:"Auto Mode",checked:!0,onChange:(M)=>{To.update({checked:M}),Tt({action:"setAutoMode",enabled:M},M?"Auto Mode enabled":"Auto Mode set to Manual")}});let S=document.createElement("div");fo=lo(S,{label:"Fallback",value:"ntfy",options:[{id:"ntfy",label:"ntfy (Remote)",hint:"Mobile review"},{id:"native",label:"native (Terminal)",hint:"Local prompt"}],onChange:(M)=>{let W=M==="native"?"native":"ntfy";fo.update({value:W}),Tt({action:"setFallbackMode",mode:W},`Fallback set to ${W}`)}}),c.append(p,S);let T=document.createElement("div");T.className="ag-status-row";let u=document.createElement("div");u.className="ag-badges-wrap",St=de(u,{label:"System 1: disabled",tone:"neutral"}),Ir=de(u,{label:"Breaker: 0/3",tone:"success"}),He=document.createElement("div"),He.hidden=!0,xr=ce(He,{label:"Reset Breaker",variant:"outline",size:"xs",onClick:()=>void Tt({action:"resetBreaker"},"Circuit breaker reset")}),T.append(u,He),Ve=document.createElement("div"),Ve.className="ag-stats-line",l.append(c,T,Ve),Ue=document.createElement("div");let m=document.createElement("div");m.className="ag-filters";let _=document.createElement("div");br=uo(_,{items:[{id:"ALL",label:"All",count:0},{id:"ALLOW",label:"ALLOW",count:0},{id:"BLOCK",label:"BLOCK",count:0},{id:"UNSURE",label:"UNSURE",count:0}],activeId:"ALL",trackBackground:!0,onChange:(M)=>{ve=M==="ALLOW"||M==="BLOCK"||M==="UNSURE"?M:"ALL",ee()}});let f=document.createElement("div");f.className="ag-filter-row";let b=document.createElement("div");b.className="ag-search-wrap",Ao=so(b,{value:"",placeholder:"Search tool, command, reason, session…",label:"Filter evaluations",onChange:(M)=>{ft=M,Ao.update({value:M}),ee()}}),Xe=document.createElement("div"),Xe.hidden=!0,kr=ut(Xe,{label:"Current session",checked:!1,onChange:(M)=>{Ce=M,ee()}}),f.append(b,Xe),m.append(_,f),Me=document.createElement("div"),Me.className="ag-list-wrap",Cr=po(Me,{items:[],selectedId:null,ariaLabel:"AutoGate evaluation history",emptyText:"No evaluations found",onSelect:(M)=>{ye=M,ee()}}),Ne=document.createElement("div"),Ne.hidden=!0,Re=document.createElement("div"),Re.hidden=!0;let X=document.createElement("div");Eo(X,{label:"Evaluation Detail"}),ue=document.createElement("div"),ue.className="ag-inspector",Re.append(X,ue),tn.append(e,l,Ue,m,Me,Ne,Re)}Le.onReady((e)=>{if(Yt(e,document.documentElement),Pe=e.directory,pe=e.session?.id??null,!So)So=!0,ln(),Fe(),Et=setInterval(()=>{Fe()},2500);else ee()});Le.onDirectory((e)=>{Pe=e,Fe()});Le.onSession((e)=>{pe=e?.id??null,ee()});window.addEventListener("unload",()=>{if(Et!==null)clearInterval(Et),Et=null});})();
