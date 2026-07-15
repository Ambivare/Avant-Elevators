/* eslint-disable */
// Firebase Messaging Service Worker — handles background push notifications.
// This file is served from /firebase-messaging-sw.js and registered by Firebase SDK automatically.

importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyDzd31b6HsFj-EKuNb2HYHt_T3TWDghxdw',
  authDomain:        'avant-elevators.firebaseapp.com',
  projectId:         'avant-elevators',
  storageBucket:     'avant-elevators.firebasestorage.app',
  messagingSenderId: '762167301144',
  appId:             '1:762167301144:web:01117f5554ab7ac6131f6d',
})

const messaging = firebase.messaging()

// Background message handler — shows a system notification when the tab is not focused
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {}
  const data = payload.data || {}

  self.registration.showNotification(title || 'Avant Elevators', {
    body:             body || '',
    icon:             icon || '/favicon.svg',
    badge:            '/favicon.svg',
    data,
    requireInteraction: false,
    tag:              data.type || 'avant-notification',
  })
})

// Open or focus the app when a notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => w.url.startsWith(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(self.location.origin)
    })
  )
})
