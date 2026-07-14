<template>
  <div class="gallery-view">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Images :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Gallery
        </h1>
        <p class="page-sub">Project documentation, captured and archived in pictures.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-secondary" @click="openCreateFolder">
          <FolderPlus :size="16" /> New Folder
        </button>
        <button class="btn-primary" @click="openUploadDialog">
          <Plus :size="16" /> Add Photo
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--ct-muted);">
      <Loader2 :size="24" class="spin" style="margin-right:10px;" /> Loading gallery…
    </div>

    <!-- Empty State -->
    <div v-else-if="!projectGroups.length" class="empty-state">
      <div class="empty-icon"><Images :size="40" /></div>
      <div class="empty-title">No photos yet</div>
      <div class="empty-sub">Add your first photo to get started</div>
      <button class="btn-primary" style="margin-top:16px;" @click="openUploadDialog">
        <Plus :size="15" /> Add Photo
      </button>
    </div>

    <!-- Project Cards Grid -->
    <div v-else class="projects-grid">
      <div
        v-for="group in projectGroups"
        :key="group.projectId"
        class="project-card"
        @click="openProjectGallery(group)"
      >
        <!-- Thumbnail -->
        <div class="card-thumb">
          <img
            v-if="group.images[0]?.imageUrl || group.images[0]?.imageData"
            :src="group.images[0].imageUrl || group.images[0].imageData"
            :alt="group.projectName"
            class="thumb-img"
          />
          <div v-else class="thumb-placeholder">
            <Images :size="28" />
          </div>
          <!-- Image count badge -->
          <div class="count-badge">{{ group.images.length }} photo{{ group.images.length !== 1 ? 's' : '' }}</div>
          <!-- Folder count badge -->
          <div v-if="group.folderCount > 0" class="folder-badge">
            <Folder :size="11" /> {{ group.folderCount }}
          </div>
        </div>
        <!-- Card Info -->
        <div class="card-info">
          <div class="card-project">{{ group.projectName }}</div>
          <div class="card-latest" v-if="group.images[0]">
            Latest: {{ formatDate(group.images[0].date) }}
          </div>
          <!-- Mini thumbnails strip -->
          <div class="thumb-strip" v-if="group.images.length > 1">
            <img
              v-for="(img, i) in group.images.slice(1, 4)"
              :key="i"
              :src="img.imageUrl || img.imageData"
              class="strip-thumb"
              :alt="img.title"
            />
            <div v-if="group.images.length > 4" class="strip-more">+{{ group.images.length - 4 }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Upload Dialog ────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showUpload" class="modal-overlay" @click.self="showUpload = false">
        <div class="modal-box">
          <div class="modal-header">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="modal-icon"><ImagePlus :size="18" /></div>
              <div>
                <div class="modal-title">Add Photo</div>
                <div class="modal-sub">Upload an image to a project or folder</div>
              </div>
            </div>
            <button class="icon-btn" @click="showUpload = false"><X :size="16" /></button>
          </div>

          <div class="modal-body">
            <!-- Project Select -->
            <div class="form-group">
              <label class="form-label">Project <span class="req">*</span></label>
              <select v-model="form.projectId" class="input" @change="onProjectChange">
                <option value="">Select a project…</option>
                <option v-for="p in projects" :key="p.id" :value="p.id">
                  {{ p.projectName || p.name || p.id }}
                </option>
              </select>
            </div>

            <!-- Folder Select (optional) -->
            <div v-if="form.projectId" class="form-group">
              <label class="form-label">Folder <span style="color:var(--ct-muted);font-weight:400;">(optional)</span></label>
              <select v-model="form.folderId" class="input">
                <option value="">— Root (no folder) —</option>
                <option v-for="f in projectFolders" :key="f.id" :value="f.id">
                  {{ folderPath(f) }}
                </option>
              </select>
            </div>

            <!-- Image Upload -->
            <div class="form-group">
              <label class="form-label">Image <span class="req">*</span></label>
              <div
                class="drop-zone"
                :class="{ 'has-image': form.imagePreview, 'drag-over': dragOver }"
                @click="fileInput.click()"
                @dragover.prevent="dragOver = true"
                @dragleave="dragOver = false"
                @drop.prevent="handleDrop"
              >
                <img v-if="form.imagePreview" :src="form.imagePreview" class="drop-preview" />
                <div v-else class="drop-placeholder">
                  <Upload :size="24" />
                  <span>Click or drag image here</span>
                  <span class="drop-hint">JPG, PNG, WEBP supported</span>
                </div>
              </div>
              <input ref="fileInput" type="file" accept="image/*" style="display:none;" @change="handleFileSelect" />
            </div>

            <!-- Title -->
            <div class="form-group">
              <label class="form-label">Title <span class="req">*</span></label>
              <input v-model="form.title" class="input" placeholder="e.g. Site visit, Installation progress…" />
            </div>

            <!-- Date -->
            <div class="form-group">
              <label class="form-label">Date</label>
              <input v-model="form.date" type="date" class="input" />
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="showUpload = false">Cancel</button>
            <button
              class="btn-primary"
              @click="submitUpload"
              :disabled="saving || !form.projectId || !form.imagePreview || !form.title"
            >
              <Loader2 v-if="saving" :size="14" class="spin" />
              <Upload v-else :size="14" />
              {{ saving ? 'Uploading…' : 'Upload Photo' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Create Folder Dialog ──────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showFolderCreate" class="modal-overlay" @click.self="showFolderCreate = false">
        <div class="modal-box" style="max-width:420px;">
          <div class="modal-header">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="modal-icon"><FolderPlus :size="18" /></div>
              <div>
                <div class="modal-title">{{ folderCreateParent ? 'New Subfolder' : 'New Folder' }}</div>
                <div class="modal-sub">{{ folderCreateParent ? `Inside "${folderCreateParent.name}"` : 'Create a top-level folder for a project' }}</div>
              </div>
            </div>
            <button class="icon-btn" @click="showFolderCreate = false"><X :size="16" /></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Project <span class="req">*</span></label>
              <select v-model="folderForm.projectId" class="input" :disabled="!!folderCreateParent">
                <option value="">Select a project…</option>
                <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.projectName || p.name || p.id }}</option>
              </select>
            </div>
            <div v-if="!folderCreateParent && folderForm.projectId" class="form-group">
              <label class="form-label">Parent Folder <span style="color:var(--ct-muted);font-weight:400;">(optional)</span></label>
              <select v-model="folderForm.parentFolderId" class="input">
                <option value="">— Root —</option>
                <option v-for="f in galleryFolders.filter(f => f.projectId === folderForm.projectId)" :key="f.id" :value="f.id">{{ f.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Folder Name <span class="req">*</span></label>
              <input v-model="folderForm.name" class="input" placeholder="e.g. Before Installation, Completion Photos…" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showFolderCreate = false">Cancel</button>
            <button class="btn-primary" @click="submitCreateFolder" :disabled="folderSaving || !folderForm.name || !folderForm.projectId">
              <Loader2 v-if="folderSaving" :size="14" class="spin" />
              <FolderPlus v-else :size="14" />
              {{ folderSaving ? 'Creating…' : 'Create Folder' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Project Gallery Modal ──────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="activeGroup" class="modal-overlay" @click.self="closeProjectGallery">
        <div class="gallery-modal">
          <div class="modal-header">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="modal-icon"><FolderOpen :size="18" /></div>
              <div>
                <!-- Breadcrumb -->
                <div class="modal-title">
                  <span style="cursor:pointer;color:var(--ct-accent);" @click="navigateTo(null)">{{ activeGroup.projectName }}</span>
                  <template v-for="(crumb, i) in breadcrumb" :key="crumb.id">
                    <span style="color:var(--ct-muted);margin:0 6px;">/</span>
                    <span
                      :style="i < breadcrumb.length - 1 ? 'cursor:pointer;color:var(--ct-accent);' : 'color:var(--ct-primary);'"
                      @click="i < breadcrumb.length - 1 ? navigateTo(crumb) : null"
                    >{{ crumb.name }}</span>
                  </template>
                </div>
                <div class="modal-sub">
                  {{ currentFolderImages.length }} photo{{ currentFolderImages.length !== 1 ? 's' : '' }}
                  <template v-if="currentSubFolders.length">&bull; {{ currentSubFolders.length }} folder{{ currentSubFolders.length !== 1 ? 's' : '' }}</template>
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="btn-secondary btn-sm" @click="openCreateFolderInContext" title="New Subfolder">
                <FolderPlus :size="13" />
              </button>
              <button class="btn-primary btn-sm" @click="openUploadInContext" title="Add Photo here">
                <Plus :size="13" /> Photo
              </button>
              <button class="icon-btn" @click="closeProjectGallery"><X :size="16" /></button>
            </div>
          </div>

          <div class="gallery-grid">
            <!-- Back button when inside a folder -->
            <div v-if="currentFolderId" class="gallery-item folder-card back-card" @click="navigateBack">
              <ChevronLeft :size="24" style="color:var(--ct-muted);" />
              <div style="font-size:12px;color:var(--ct-muted);margin-top:4px;">Back</div>
            </div>

            <!-- Subfolders -->
            <div
              v-for="folder in currentSubFolders"
              :key="folder.id"
              class="gallery-item folder-card"
              @click="navigateTo(folder)"
            >
              <Folder :size="36" style="color:var(--ct-accent);" />
              <div style="font-size:12px;font-weight:600;color:var(--ct-primary);margin-top:8px;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ folder.name }}</div>
              <div style="font-size:10px;color:var(--ct-muted);margin-top:3px;">{{ folderImageCount(folder.id) }} photos</div>
              <button
                class="folder-del-btn"
                @click.stop="deleteFolder(folder)"
                title="Delete folder"
              >
                <Trash2 :size="11" />
              </button>
            </div>

            <!-- Images in current folder/level -->
            <div
              v-for="(img, idx) in currentFolderImages"
              :key="img.id"
              class="gallery-item"
              @click="openLightbox(idx)"
            >
              <img :src="img.imageUrl || img.imageData" :alt="img.title" class="gallery-img" />
              <div class="gallery-overlay">
                <div class="gallery-img-title">{{ img.title }}</div>
                <div class="gallery-img-date">{{ formatDate(img.date) }}</div>
              </div>
            </div>

            <!-- Empty state for current folder -->
            <div v-if="!currentSubFolders.length && !currentFolderImages.length" style="grid-column:1/-1;text-align:center;padding:60px 24px;color:var(--ct-muted);">
              <Images :size="32" style="margin-bottom:12px;opacity:.3;" />
              <div style="font-size:14px;">This folder is empty</div>
              <div style="font-size:12px;margin-top:4px;">Add photos or create subfolders</div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Lightbox ───────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="lightboxIdx !== null && currentFolderImages.length" class="lightbox" @click.self="lightboxIdx = null">
        <button class="lb-close" @click="lightboxIdx = null"><X :size="20" /></button>
        <button class="lb-nav lb-prev" @click="lightboxIdx = Math.max(0, lightboxIdx - 1)" :disabled="lightboxIdx === 0">
          <ChevronLeft :size="24" />
        </button>
        <div class="lb-content">
          <img :src="currentFolderImages[lightboxIdx].imageUrl || currentFolderImages[lightboxIdx].imageData" class="lb-img" />
          <div class="lb-caption">
            <strong>{{ currentFolderImages[lightboxIdx].title }}</strong>
            <span>{{ formatDate(currentFolderImages[lightboxIdx].date) }}</span>
          </div>
        </div>
        <button class="lb-nav lb-next" @click="lightboxIdx = Math.min(currentFolderImages.length - 1, lightboxIdx + 1)" :disabled="lightboxIdx === currentFolderImages.length - 1">
          <ChevronRight :size="24" />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Images, Plus, Upload, X, ImagePlus, FolderOpen, Loader2, ChevronLeft, ChevronRight, FolderPlus, Folder, Trash2 } from 'lucide-vue-next'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { uploadToR2 } from '@/composables/useR2Storage'
import { getAll, create, remove } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { mediaStorage } from '@/firebase/storage-config'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const auth = useAuthStore()
const ui = useUIStore()

const loading = ref(false)
const saving = ref(false)
const galleryItems = ref([])
const galleryFolders = ref([])
const projects = ref([])
const showUpload = ref(false)
const dragOver = ref(false)
const fileInput = ref(null)

// ── Navigation state ──────────────────────────────────────────────────
const activeGroup = ref(null)      // current project group
const currentFolderId = ref(null)  // null = project root
const breadcrumb = ref([])         // array of folder objects from root to current
const lightboxIdx = ref(null)

// ── Folder creation state ─────────────────────────────────────────────
const showFolderCreate = ref(false)
const folderSaving = ref(false)
const folderCreateParent = ref(null) // folder to create subfolder inside
const folderForm = ref({ projectId: '', parentFolderId: '', name: '' })

const todayStr = () => new Date().toISOString().slice(0, 10)

const form = ref({
  projectId: '',
  projectName: '',
  folderId: '',
  title: '',
  date: todayStr(),
  imageFile: null,
  imagePreview: '',
})

// ── Computed ─────────────────────────────────────────────────────────

// Group gallery items by project
const projectGroups = computed(() => {
  const map = new Map()
  for (const item of galleryItems.value) {
    if (!map.has(item.projectId)) {
      map.set(item.projectId, { projectId: item.projectId, projectName: item.projectName, images: [], folderCount: 0 })
    }
    map.get(item.projectId).images.push(item)
  }
  // Sort images in each group by date desc
  for (const g of map.values()) {
    g.images.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }
  // Count root folders per project
  for (const g of map.values()) {
    g.folderCount = galleryFolders.value.filter(f => f.projectId === g.projectId && !f.parentFolderId).length
  }
  return Array.from(map.values())
})

const totalImages = computed(() => galleryItems.value.length)

// Folders for the currently selected project in upload form
const projectFolders = computed(() => {
  if (!form.value.projectId) return []
  return galleryFolders.value.filter(f => f.projectId === form.value.projectId)
})

// Subfolders visible in current navigation context
const currentSubFolders = computed(() => {
  if (!activeGroup.value) return []
  return galleryFolders.value.filter(f =>
    f.projectId === activeGroup.value.projectId &&
    (currentFolderId.value ? f.parentFolderId === currentFolderId.value : !f.parentFolderId)
  )
})

// Images visible in current navigation context
const currentFolderImages = computed(() => {
  if (!activeGroup.value) return []
  return activeGroup.value.images.filter(img => (img.folderId || null) === currentFolderId.value)
})

// ── Helpers ────────────────────────────────────────────────────────────
function folderPath(folder) {
  const parts = []
  let f = folder
  while (f) {
    parts.unshift(f.name)
    f = galleryFolders.value.find(x => x.id === f.parentFolderId) || null
  }
  return parts.join(' / ')
}

function folderImageCount(folderId) {
  // Count images directly in this folder + all descendant folders
  const childIds = getDescendantFolderIds(folderId)
  const allIds = [folderId, ...childIds]
  return galleryItems.value.filter(img => allIds.includes(img.folderId)).length
}

function getDescendantFolderIds(folderId) {
  const children = galleryFolders.value.filter(f => f.parentFolderId === folderId).map(f => f.id)
  return children.flatMap(id => [id, ...getDescendantFolderIds(id)])
}

// ── Data Loading ───────────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const [items, projs] = await Promise.all([
      getAll(Collections.GALLERY),
      getAll(Collections.PROJECTS),
    ])
    galleryItems.value = items
    projects.value = projs
  } catch (e) {
    ui.error('Failed to load gallery')
  } finally {
    loading.value = false
  }
  // Load folders separately — non-critical (new collection may not exist in Firestore yet)
  try {
    galleryFolders.value = await getAll(Collections.GALLERY_FOLDERS)
  } catch { /* GALLERY_FOLDERS not yet in Firestore — safe to ignore */ }
}

onMounted(loadData)

// ── Upload ─────────────────────────────────────────────────────────────
function openUploadDialog() {
  form.value = { projectId: '', projectName: '', folderId: '', title: '', date: todayStr(), imageFile: null, imagePreview: '' }
  showUpload.value = true
}

function openUploadInContext() {
  form.value = {
    projectId: activeGroup.value?.projectId || '',
    projectName: activeGroup.value?.projectName || '',
    folderId: currentFolderId.value || '',
    title: '',
    date: todayStr(),
    imageFile: null,
    imagePreview: '',
  }
  showUpload.value = true
}

function onProjectChange() {
  const p = projects.value.find(x => x.id === form.value.projectId)
  form.value.projectName = p ? (p.projectName || p.name || p.id) : ''
  form.value.folderId = ''
}

function readAsDataURL(file) {
  return new Promise(r => {
    const fr = new FileReader()
    fr.onload = e => r(e.target.result)
    fr.readAsDataURL(file)
  })
}

async function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  form.value.imageFile = file
  form.value.imagePreview = await readAsDataURL(file)
}

async function handleDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  form.value.imageFile = file
  form.value.imagePreview = await readAsDataURL(file)
}

async function submitUpload() {
  if (!form.value.projectId || !form.value.imageFile || !form.value.title) return
  saving.value = true
  try {
    const ext = form.value.imageFile.name.split('.').pop() || 'jpg'
    const path = `gallery/${form.value.projectId}/${Date.now()}.${ext}`
    let imageUrl
    try {
      const sRef = storageRef(mediaStorage, path)
      await uploadBytes(sRef, form.value.imageFile)
      imageUrl = await getDownloadURL(sRef)
    } catch (fbErr) {
      console.warn('[Storage] Firebase failed, falling back to R2:', fbErr.code || fbErr.message)
      try {
        imageUrl = await uploadToR2(form.value.imageFile, path, form.value.imageFile.type || 'image/jpeg')
      } catch (r2Err) {
        console.error('[Storage] R2 fallback also failed:', r2Err.message)
        throw new Error('Image upload failed. Check your connection and try again.')
      }
    }

    const folderName = form.value.folderId
      ? galleryFolders.value.find(f => f.id === form.value.folderId)?.name || ''
      : ''

    const newId = await create(Collections.GALLERY, {
      projectId:   form.value.projectId,
      projectName: form.value.projectName,
      folderId:    form.value.folderId || null,
      folderName,
      title:       form.value.title,
      date:        form.value.date,
      imageUrl,
      storagePath: path,
      createdAt:   new Date().toISOString(),
      createdBy:   auth.user?.fullName || auth.user?.username || 'Unknown',
    })
    const newItem = {
      id: newId,
      projectId: form.value.projectId,
      projectName: form.value.projectName,
      folderId: form.value.folderId || null,
      title: form.value.title,
      date: form.value.date,
      imageUrl,
    }
    galleryItems.value.push(newItem)
    // If gallery modal is open for this project, add to active group
    if (activeGroup.value?.projectId === form.value.projectId) {
      activeGroup.value.images.push(newItem)
      activeGroup.value.images.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    }
    ui.success('Photo uploaded successfully')
    showUpload.value = false
  } catch (e) {
    ui.error('Failed to upload photo')
  } finally {
    saving.value = false
  }
}

// ── Folders ────────────────────────────────────────────────────────────
function openCreateFolder() {
  folderCreateParent.value = null
  folderForm.value = { projectId: '', parentFolderId: '', name: '' }
  showFolderCreate.value = true
}

function openCreateFolderInContext() {
  folderCreateParent.value = currentFolderId.value
    ? galleryFolders.value.find(f => f.id === currentFolderId.value) || null
    : null
  folderForm.value = {
    projectId: activeGroup.value?.projectId || '',
    parentFolderId: currentFolderId.value || '',
    name: '',
  }
  showFolderCreate.value = true
}

async function submitCreateFolder() {
  if (!folderForm.value.name || !folderForm.value.projectId) return
  folderSaving.value = true
  try {
    const data = {
      projectId:      folderForm.value.projectId,
      name:           folderForm.value.name.trim(),
      parentFolderId: folderForm.value.parentFolderId || null,
      createdAt:      new Date().toISOString(),
      createdBy:      auth.user?.fullName || auth.user?.username || 'Unknown',
    }
    const newId = await create(Collections.GALLERY_FOLDERS, data)
    galleryFolders.value.push({ id: newId, ...data })
    ui.success(`Folder "${data.name}" created.`)
    showFolderCreate.value = false
  } catch (e) {
    ui.error('Failed to create folder.')
  } finally {
    folderSaving.value = false
  }
}

async function deleteFolder(folder) {
  const hasImages = galleryItems.value.some(img => img.folderId === folder.id)
  const hasSubfolders = galleryFolders.value.some(f => f.parentFolderId === folder.id)
  if (hasImages || hasSubfolders) {
    ui.error('Cannot delete a folder that contains photos or subfolders. Remove contents first.')
    return
  }
  try {
    await remove(Collections.GALLERY_FOLDERS, folder.id)
    galleryFolders.value = galleryFolders.value.filter(f => f.id !== folder.id)
    ui.success(`Folder "${folder.name}" deleted.`)
  } catch (e) {
    ui.error('Failed to delete folder.')
  }
}

// ── Navigation ─────────────────────────────────────────────────────────
function openProjectGallery(group) {
  activeGroup.value = group
  currentFolderId.value = null
  breadcrumb.value = []
  lightboxIdx.value = null
}

function closeProjectGallery() {
  activeGroup.value = null
  currentFolderId.value = null
  breadcrumb.value = []
  lightboxIdx.value = null
}

function navigateTo(folder) {
  if (!folder) {
    // Navigate back to project root
    currentFolderId.value = null
    breadcrumb.value = []
  } else {
    // Check if folder is already in breadcrumb (clicking a middle breadcrumb)
    const idx = breadcrumb.value.findIndex(b => b.id === folder.id)
    if (idx !== -1) {
      breadcrumb.value = breadcrumb.value.slice(0, idx + 1)
      currentFolderId.value = folder.id
    } else {
      breadcrumb.value.push(folder)
      currentFolderId.value = folder.id
    }
  }
  lightboxIdx.value = null
}

function navigateBack() {
  if (breadcrumb.value.length <= 1) {
    currentFolderId.value = null
    breadcrumb.value = []
  } else {
    breadcrumb.value.pop()
    currentFolderId.value = breadcrumb.value[breadcrumb.value.length - 1]?.id || null
  }
  lightboxIdx.value = null
}

function openLightbox(idx) {
  lightboxIdx.value = idx
}

function formatDate(d) {
  if (!d) return ''
  try {
    const dt = new Date(d + 'T00:00:00')
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${dt.getFullYear()}`
  } catch { return d }
}
</script>

<style scoped>
.gallery-view {
  padding: 24px;
  max-width: 1400px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
  gap: 16px;
  flex-wrap: wrap;
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--ct-primary);
  margin: 0 0 4px;
}
.page-sub { font-size: 13px; color: var(--ct-muted); margin: 0; }

/* ── Empty State ─────────────────────────────────────────────────────── */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 80px 24px; text-align: center;
}
.empty-icon {
  width: 72px; height: 72px; border-radius: 20px;
  background: rgba(99,102,241,0.1);
  border: 1px solid rgba(99,102,241,0.2);
  display: flex; align-items: center; justify-content: center;
  color: var(--ct-accent); margin-bottom: 16px;
}
.empty-title { font-size: 18px; font-weight: 700; color: var(--ct-primary); margin-bottom: 6px; }
.empty-sub { font-size: 13px; color: var(--ct-muted); }

/* ── Project Cards ───────────────────────────────────────────────────── */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}
.project-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s;
}
.project-card:hover {
  transform: translateY(-3px);
  border-color: rgba(99,102,241,0.3);
  box-shadow: 0 8px 32px rgba(99,102,241,0.12);
}
.card-thumb {
  height: 180px;
  position: relative;
  background: rgba(255,255,255,0.04);
  overflow: hidden;
}
.thumb-img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: var(--ct-muted);
}
.count-badge {
  position: absolute; top: 10px; right: 10px;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 11px; font-weight: 600;
  padding: 3px 10px;
  border-radius: 99px;
}
.folder-badge {
  position: absolute; top: 10px; left: 10px;
  background: rgba(99,102,241,0.75);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 11px; font-weight: 600;
  padding: 3px 10px;
  border-radius: 99px;
  display: flex; align-items: center; gap: 4px;
}
.card-info { padding: 14px 16px; }
.card-project { font-size: 14px; font-weight: 700; color: var(--ct-primary); margin-bottom: 4px; }
.card-latest { font-size: 12px; color: var(--ct-muted); margin-bottom: 10px; }
.thumb-strip { display: flex; gap: 6px; align-items: center; }
.strip-thumb {
  width: 42px; height: 32px;
  object-fit: cover; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
}
.strip-more {
  font-size: 11px; color: var(--ct-muted);
  background: rgba(255,255,255,0.06);
  border-radius: 6px; padding: 4px 8px;
}

/* ── Modal Base ──────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.modal-box {
  background: #0f1629;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 18px;
  width: 500px;
  max-width: 100%;
  max-height: 90vh;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.gallery-modal {
  background: #0f1629;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 18px;
  width: 960px;
  max-width: 100%;
  max-height: 88vh;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.modal-icon {
  width: 38px; height: 38px; border-radius: 10px;
  background: rgba(99,102,241,0.15);
  border: 1px solid rgba(99,102,241,0.25);
  display: flex; align-items: center; justify-content: center;
  color: var(--ct-accent);
}
.modal-title { font-size: 15px; font-weight: 700; color: var(--ct-primary); }
.modal-sub { font-size: 12px; color: var(--ct-muted); margin-top: 2px; }
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.modal-footer {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 14px 24px 20px;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.icon-btn {
  width: 32px; height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: var(--ct-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover { background: rgba(255,255,255,0.1); color: var(--ct-primary); }

/* ── Form ────────────────────────────────────────────────────────────── */
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 12px; font-weight: 600; color: var(--ct-muted); margin-bottom: 6px; }
.req { color: #f87171; }

.drop-zone {
  border: 2px dashed rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 24px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
  min-height: 140px;
  overflow: hidden;
}
.drop-zone:hover, .drop-zone.drag-over {
  border-color: rgba(99,102,241,0.5);
  background: rgba(99,102,241,0.05);
}
.drop-zone.has-image { padding: 0; }
.drop-preview { width: 100%; max-height: 220px; object-fit: contain; border-radius: 10px; }
.drop-placeholder {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--ct-muted);
}
.drop-placeholder span { font-size: 13px; }
.drop-hint { font-size: 11px; color: #334155; }

/* ── Gallery Grid (inside modal) ──────────────────────────────────────── */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding: 20px 24px;
  overflow-y: auto;
  align-content: start;
}
.gallery-item {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  aspect-ratio: 4/3;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  transition: transform 0.15s, border-color 0.15s;
}
.gallery-item:hover { transform: scale(1.02); border-color: rgba(99,102,241,0.3); }
.gallery-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gallery-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.75));
  padding: 20px 10px 10px;
  opacity: 0;
  transition: opacity 0.18s;
}
.gallery-item:hover .gallery-overlay { opacity: 1; }
.gallery-img-title { font-size: 12px; font-weight: 600; color: #fff; }
.gallery-img-date { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 2px; }

/* ── Folder Cards ────────────────────────────────────────────────────── */
.folder-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  cursor: pointer;
  background: rgba(99,102,241,0.05);
  border-color: rgba(99,102,241,0.15);
  padding: 16px;
}
.folder-card:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.35); }
.back-card { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.08); }
.back-card:hover { background: rgba(255,255,255,0.07); }
.folder-del-btn {
  position: absolute; top: 6px; right: 6px;
  width: 24px; height: 24px;
  border-radius: 6px;
  border: 1px solid rgba(239,68,68,0.3);
  background: rgba(239,68,68,0.1);
  color: #f87171;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.folder-card:hover .folder-del-btn { opacity: 1; }

/* ── Lightbox ─────────────────────────────────────────────────────────── */
.lightbox {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.92);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000;
}
.lb-close {
  position: absolute; top: 20px; right: 20px;
  width: 40px; height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.08);
  color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.lb-close:hover { background: rgba(255,255,255,0.16); }
.lb-nav {
  width: 48px; height: 48px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.08);
  color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
  z-index: 1;
}
.lb-nav:hover:not(:disabled) { background: rgba(255,255,255,0.18); }
.lb-nav:disabled { opacity: 0.3; cursor: default; }
.lb-prev { margin-right: 16px; }
.lb-next { margin-left: 16px; }
.lb-content { flex: 1; display: flex; flex-direction: column; align-items: center; max-width: 80vw; }
.lb-img { max-height: 80vh; max-width: 100%; object-fit: contain; border-radius: 12px; }
.lb-caption {
  display: flex; gap: 16px; align-items: center;
  margin-top: 14px; color: rgba(255,255,255,0.85);
  font-size: 13px;
}
.lb-caption strong { font-weight: 700; }
.lb-caption span { color: rgba(255,255,255,0.5); font-size: 12px; }

/* ── Utility ─────────────────────────────────────────────────────────── */
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

/* Light theme overrides */
[data-theme="light"] .project-card {
  background: rgba(0,0,0,0.03);
  border-color: rgba(0,0,0,0.1);
}
[data-theme="light"] .modal-box,
[data-theme="light"] .gallery-modal {
  background: #f8fafc;
  border-color: rgba(0,0,0,0.1);
}
[data-theme="light"] .drop-zone { border-color: rgba(0,0,0,0.15); }
[data-theme="light"] .drop-zone:hover { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.04); }
[data-theme="light"] .gallery-item { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.08); }
[data-theme="light"] .folder-card { background: rgba(99,102,241,0.04); border-color: rgba(99,102,241,0.12); }
[data-theme="light"] .back-card { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); }
</style>
