import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from 'firebase/analytics'

// ── Firebase Configuration (avant-elevators) ────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyDzd31b6HsFj-EKuNb2HYHt_T3TWDghxdw',
  authDomain:        'avant-elevators.firebaseapp.com',
  projectId:         'avant-elevators',
  storageBucket:     'avant-elevators.firebasestorage.app',
  messagingSenderId: '762167301144',
  appId:             '1:762167301144:web:01117f5554ab7ac6131f6d',
  measurementId:     'G-4Q8ZVTW75Y',
}

const app = initializeApp(firebaseConfig)
export const analytics = getAnalytics(app)

export const db      = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export const auth    = getAuth(app)
export const storage = getStorage(app)

// Firebase Cloud Messaging VAPID Key
// Get it from: Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates → Generate key pair
// Paste the key pair value below (the long Base64 string starting with "B...")
export const VAPID_KEY = 'YOUR_VAPID_KEY_HERE'

export default app
