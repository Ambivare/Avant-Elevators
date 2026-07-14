import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// ─────────────────────────────────────────────────────────────────────────────
// BACKUP FIREBASE CONFIGURATION
//
// To update: change only the values inside backupFirebaseConfig below.
// Every create/update in the main app is silently mirrored here.
// Deletes are intentionally NEVER sent to backup.
//
// Collections are prefixed: projects → micro_backup_projects
// ─────────────────────────────────────────────────────────────────────────────
const backupFirebaseConfig = {
  apiKey:            'AIzaSyBXt8rKTSAv1WpOT78MtDwwEeCOI7Nfrrs',
  authDomain:        'ai-doc-73cd1.firebaseapp.com',
  projectId:         'ai-doc-73cd1',
  storageBucket:     'ai-doc-73cd1.firebasestorage.app',
  messagingSenderId: '6492771374',
  appId:             '1:6492771374:web:a7dfcdb4c341020510bbbf',
  measurementId:     'G-3Q1504M6LR',
}

const backupApp = initializeApp(backupFirebaseConfig, 'micro-backup')
export const backupDb = getFirestore(backupApp)

/**
 * Returns the backup collection name for a given main collection.
 * e.g. 'projects' → 'micro_backup_projects'
 */
export const backupCollectionName = (colName) => `micro_backup_${colName}`
