const CACHE = ''pietrobon-v5''
const ARQUIVOS = [
  ''/index.html'',
  ''/CSS/style.css'',
  ''/logo.png'',
  ''/icon-192.png'',
  ''/icon-512.png''
]

self.addEventListener(''install'', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)))
  self.skipWaiting()
})

self.addEventListener(''activate'', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener(''fetch'', (e) => {
  if (e.request.method !== ''GET'') return
  if (e.request.url.includes(''/api/'')) return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
self.addEventListener(''push'', (e) => {
  let data = { titulo: ''Pietrobon · Insumos'', corpo: ''Nova atualização no sistema.'', url: ''/'' }
  try { if (e.data) data = { ...data, ...JSON.parse(e.data.text()) } } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.titulo, {
      body: data.corpo,
      icon: ''/icon-192.png'',
      badge: ''/icon-192.png'',
      data: { url: data.url },
      vibrate: [200, 100, 200]
    })
  )
})

self.addEventListener(''notificationclick'', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: ''window'', includeUncontrolled: true }).then((cs) => {
      const url = e.notification.data?.url || ''/''
      const c = cs.find((c) => c.url.includes(url) && ''focus'' in c)
      if (c) return c.focus()
      return clients.openWindow(url)
    })
  )
})