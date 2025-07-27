const CACHE_NAME = 'pro-tracker-cache-v2'; // Updated cache name
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js', // Updated
  '/auth.js', // New
  '/firebase-config.js', // New
  '/manifest.json',
  '/icon.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js'
];
self.addEventListener('install', event => { event.waitUntil( caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)) ); });
self.addEventListener('fetch', event => { event.respondWith( caches.match(event.request).then(response => response || fetch(event.request)) ); });