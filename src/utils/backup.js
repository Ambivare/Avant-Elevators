import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

// Collections included in backup (excludes transient/device-specific data)
export const BACKUP_COLLECTIONS = [
  { col: Collections.INVENTORY,         label: 'Inventory' },
  { col: Collections.PROJECTS,          label: 'Projects' },
  { col: Collections.MAINTENANCE,       label: 'Maintenance' },
  { col: Collections.AMC,               label: 'AMC' },
  { col: Collections.AMC_MONTHLY,       label: 'AMC Monthly' },
  { col: Collections.EMPLOYEES,         label: 'Employees' },
  { col: Collections.USERS,             label: 'Users' },
  { col: Collections.ACTIVITIES,        label: 'Activities' },
  { col: Collections.LEADS,             label: 'Leads' },
  { col: Collections.TASKS,             label: 'Tasks' },
  { col: Collections.INVOICES,          label: 'Invoices' },
  { col: Collections.INSTALLATION,      label: 'Installation' },
  { col: Collections.MODERNISATION,     label: 'Modernisation' },
  { col: Collections.REPAIRS,           label: 'Repairs' },
  { col: Collections.COMPLAINTS,        label: 'Complaints' },
  { col: Collections.SALARY_SLIPS,      label: 'Salary Slips' },
  { col: Collections.QUOTATIONS,        label: 'Quotations' },
  { col: Collections.PURCHASE_ORDERS,   label: 'Purchase Orders' },
  { col: Collections.PROFORMA_INVOICES, label: 'Proforma Invoices' },
  { col: Collections.TAX_INVOICES,      label: 'Tax Invoices' },
  { col: Collections.VENDORS,           label: 'Vendors' },
  { col: Collections.MATERIALS,         label: 'Materials' },
  { col: Collections.BOM,               label: 'BOM' },
  { col: Collections.SETTINGS,          label: 'Settings' },
  { col: Collections.LEAVE,             label: 'Leave Requests' },
  { col: Collections.PROJECT_TIMELINE,  label: 'Project Timeline' },
  { col: Collections.CONFIGURATIONS,    label: 'Configurations' },
  { col: Collections.GALLERY,           label: 'Gallery' },
  { col: Collections.INSPECTIONS,       label: 'Inspections' },
  { col: Collections.ATTENDANCE,        label: 'Attendance' },
  { col: Collections.INVENTORY_USAGE,   label: 'Inventory Usage' },
]

const BACKUP_META_COL = 'appBackups'

// ── Serialise Firestore Timestamps & complex objects for CSV/Excel ─────────────
function serializeValue(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Timestamp) return v.toDate().toISOString()
  if (v?.toDate && typeof v.toDate === 'function') return v.toDate().toISOString()
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return JSON.stringify(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function flattenDoc(d) {
  const flat = {}
  for (const [k, v] of Object.entries(d)) flat[k] = serializeValue(v)
  return flat
}

// ── CSV ────────────────────────────────────────────────────────────────────────
function toCSV(docs) {
  if (!docs.length) return 'id\n(empty collection)'
  const keys = [...new Set(docs.flatMap(d => Object.keys(d)))]
  const escape = v => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s
  }
  return [keys.join(','), ...docs.map(d => keys.map(k => escape(d[k] ?? '')).join(','))].join('\r\n')
}

// ── Read all collections ───────────────────────────────────────────────────────
async function readAll(onProgress) {
  const result = []
  for (let i = 0; i < BACKUP_COLLECTIONS.length; i++) {
    const { col, label } = BACKUP_COLLECTIONS[i]
    onProgress?.(`Reading ${label} (${i + 1}/${BACKUP_COLLECTIONS.length})`)
    try {
      const docs = await getAll(col)
      result.push({ col, label, docs })
    } catch {
      result.push({ col, label, docs: [] })
    }
  }
  return result
}

// ── Download ZIP ───────────────────────────────────────────────────────────────
export async function downloadBackupZip(allData, backupId) {
  const [JSZipModule, xlsxModule] = await Promise.all([
    import('jszip'),
    import('xlsx'),
  ])
  const JSZip = JSZipModule.default
  const { utils: xlsUtils, write: xlsWrite } = xlsxModule

  const zip = new JSZip()
  const csvDir  = zip.folder('csv')
  const xlsxDir = zip.folder('excel')

  for (const { label, docs } of allData) {
    const flat     = docs.map(flattenDoc)
    const safeName = label.replace(/[^a-zA-Z0-9_-]/g, '_')

    // CSV file
    csvDir.file(`${safeName}.csv`, toCSV(flat))

    // Excel file (one sheet per collection)
    const wb = xlsUtils.book_new()
    const ws = xlsUtils.json_to_sheet(flat.length ? flat : [{ '(empty)': '' }])
    xlsUtils.book_append_sheet(wb, ws, label.slice(0, 31))
    xlsxDir.file(`${safeName}.xlsx`, xlsWrite(wb, { bookType: 'xlsx', type: 'array' }))
  }

  const totalDocs = allData.reduce((s, d) => s + d.docs.length, 0)
  zip.file(
    'manifest.txt',
    `Avant Elevators — Full Database Backup\n` +
    `Backup ID : ${backupId}\n` +
    `Generated : ${new Date().toISOString()}\n` +
    `Total docs: ${totalDocs}\n\n` +
    allData.map(d => `${d.label.padEnd(22)} (${d.col}): ${d.docs.length} docs`).join('\n')
  )

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `avant-backup-${backupId}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

// ── Save backup to Firestore ───────────────────────────────────────────────────
async function saveToFirestore(allData, backupId, createdBy, onProgress) {
  // Metadata doc
  await setDoc(doc(db, BACKUP_META_COL, backupId), {
    createdAt: serverTimestamp(),
    createdBy,
    backupId,
    collections: BACKUP_COLLECTIONS.map(b => b.col),
    totalDocuments: allData.reduce((s, d) => s + d.docs.length, 0),
    status: 'complete',
  })

  // Each collection as a subcollection under the backup doc
  for (let i = 0; i < allData.length; i++) {
    const { col, label, docs } = allData[i]
    onProgress?.(`Saving ${label} to Firestore (${i + 1}/${allData.length})`)
    if (!docs.length) continue

    const CHUNK = 400
    for (let c = 0; c < docs.length; c += CHUNK) {
      const batch = writeBatch(db)
      for (const docData of docs.slice(c, c + CHUNK)) {
        const { id, ...rest } = docData
        batch.set(doc(db, BACKUP_META_COL, backupId, col, id), rest)
      }
      await batch.commit()
    }
  }
}

// ── Get latest backup metadata ─────────────────────────────────────────────────
export async function getLatestBackup() {
  const snap = await getDocs(collection(db, BACKUP_META_COL))
  if (snap.empty) return null
  const metas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  metas.sort((a, b) => {
    const ta = a.createdAt?.toDate?.()?.getTime() || 0
    const tb = b.createdAt?.toDate?.()?.getTime() || 0
    return tb - ta
  })
  return metas[0]
}

// ── Full backup ────────────────────────────────────────────────────────────────
export async function runBackup(createdBy, onProgress) {
  const backupId = `bk_${Date.now()}`
  const allData  = await readAll(onProgress)
  onProgress?.('Saving to Firestore…')
  await saveToFirestore(allData, backupId, createdBy, onProgress)
  onProgress?.('Generating ZIP…')
  await downloadBackupZip(allData, backupId)
  return backupId
}

// ── Restore from latest Firestore backup ──────────────────────────────────────
export async function runRestore(onProgress) {
  onProgress?.('Locating latest backup…')
  const latest = await getLatestBackup()
  if (!latest) throw new Error('No backup found in Firestore. Run a backup first.')

  const backupId = latest.backupId || latest.id
  const colList  = latest.collections || BACKUP_COLLECTIONS.map(b => b.col)

  for (let i = 0; i < colList.length; i++) {
    const col   = colList[i]
    const label = BACKUP_COLLECTIONS.find(b => b.col === col)?.label || col
    onProgress?.(`Restoring ${label} (${i + 1}/${colList.length})`)

    // Read backup documents for this collection from subcollection
    const backupSnap = await getDocs(collection(db, BACKUP_META_COL, backupId, col))

    // Delete current docs in batches
    const currentSnap = await getDocs(collection(db, col))
    const CHUNK = 400
    for (let c = 0; c < currentSnap.docs.length; c += CHUNK) {
      const batch = writeBatch(db)
      currentSnap.docs.slice(c, c + CHUNK).forEach(d => batch.delete(d.ref))
      await batch.commit()
    }

    // Restore backup docs with original IDs
    if (!backupSnap.empty) {
      const bDocs = backupSnap.docs
      for (let c = 0; c < bDocs.length; c += CHUNK) {
        const batch = writeBatch(db)
        bDocs.slice(c, c + CHUNK).forEach(d => batch.set(doc(db, col, d.id), d.data()))
        await batch.commit()
      }
    }
  }

  return latest
}

// ── Verify admin credentials ───────────────────────────────────────────────────
export async function verifyAdminPassword(username, password) {
  const [employees, users] = await Promise.all([
    getAll(Collections.EMPLOYEES),
    getAll(Collections.USERS),
  ])
  const match = (list) => list.find(u =>
    u.username?.toLowerCase() === username?.toLowerCase() &&
    u.password === password &&
    u.role === 'admin' &&
    u.status !== 'inactive'
  )
  return !!(match(employees) || match(users))
}
