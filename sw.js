// Lets Match Day open with no signal at the pitch.
// The team's data is cached separately by Firestore; this only caches the app's own files.
const CACHE='matchday-v58';
const SHELL=['./','index.html','firebase-config.js','manifest.webmanifest?v=whistle','icons/icon-192.png?v=whistle','icons/apple-touch-icon.png?v=whistle'];

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET')return;
  const put=res=>{if(res&&(res.ok||res.type==='opaque')){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}return res};
  if(u.origin===location.origin){
    // App files: use the network so updates arrive straight away; fall back to the cache offline.
    e.respondWith(fetch(r).then(put).catch(()=>caches.match(r).then(m=>m||caches.match('./'))));
  }else if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'||u.pathname.startsWith('/firebasejs/')){
    // Fonts and the Firebase library never change at a given URL: cache first.
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(put)));
  }
  // Everything else (Firestore and sign-in traffic) goes straight to the network.
});

// Push notifications (followers' match alerts, coaches' join requests). The server sends title, body
// and the page to open; every push shows a notification, as phones require.
self.addEventListener('push',e=>{
  let d={};try{const j=e.data?e.data.json():{};d=j.data||j.notification||j}catch(_){d={title:'Match Day',body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'Match Day',{body:d.body||'',tag:d.tag||undefined,renotify:!!d.tag,
    icon:'icons/icon-192.png?v=whistle',badge:'icons/icon-192.png?v=whistle',data:{url:d.url||'./'}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();const url=new URL(e.notification.data&&e.notification.data.url||'./',self.location.href).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    const w=ws.find(x=>x.url===url)||ws.find(x=>new URL(x.url).origin===self.location.origin);
    if(w){return w.focus().then(f=>f&&f.url!==url&&f.navigate?f.navigate(url):f)}
    return self.clients.openWindow(url);
  }));
});
