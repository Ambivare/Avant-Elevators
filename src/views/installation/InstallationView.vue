<template>
  <div class="installation-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <HardHat :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Installation Activities
        </h1>
        <p class="page-sub">New installations, commissioned and documented to perfection.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <button class="btn-secondary btn-sm" @click="triggerExport('pdf')"><FileDown :size="14" /> PDF</button>
        <button class="btn-secondary btn-sm" @click="triggerExport('excel')"><FileText :size="14" /> Excel</button>
        <button v-if="authStore.can('canCreateService')" class="btn-primary" @click="openAdd">
          <Plus :size="16" /> Log Activity
        </button>
      </div>
    </div>

    <!-- Filters Row -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div style="flex:1;min-width:220px;position:relative;">
        <Search :size="14" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--ct-muted);" />
        <input v-model="search" class="input" style="padding-left:32px;" placeholder="Search by project or technician…" />
      </div>
      <select v-model="filterProject" class="input" style="width:200px;">
        <option value="">All Projects</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.projectName }}</option>
      </select>
      <input v-model="filterDateFrom" type="date" class="input" style="width:150px;" title="From Date" />
      <input v-model="filterDateTo" type="date" class="input" style="width:150px;" title="To Date" />
      <select v-model="filterStatus" class="input" style="width:160px;">
        <option value="">All Statuses</option>
        <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div v-if="loading" style="padding:48px;text-align:center;color:var(--ct-muted);">
        <Loader2 :size="28" style="animation:spin 1s linear infinite;" />
        <p style="margin-top:10px;font-size:13px;">Loading activities…</p>
      </div>
      <div v-else-if="!filteredActivities.length" class="empty-state">
        <HardHat :size="40" style="opacity:.3;margin-bottom:12px;" />
        <p>No installation activities found.</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Lift #</th>
            <th>Activity Date</th>
            <th>Technician</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Work Done</th>
            <th>Remarks</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in filteredActivities" :key="a.id" @click="openView(a)" style="cursor:pointer;">
            <td style="font-weight:500;color:var(--ct-primary);">{{ projectName(a.projectId) }}</td>
            <td style="color:var(--ct-sub);">{{ a.liftNumber || '—' }}</td>
            <td style="color:var(--ct-muted);font-size:12px;">{{ formatDate(a.activityDate) }}</td>
            <td style="color:var(--ct-sub);">{{ (a.technicians || [a.technician]).filter(Boolean).join(', ') || '—' }}</td>
            <td><span :class="['badge', statusBadge(a.status)]">{{ formatStatus(a.status) }}</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;min-width:60px;">
                  <div :style="`width:${a.progress || 0}%;height:100%;background:#6366f1;border-radius:3px;`"></div>
                </div>
                <span style="font-size:11px;color:var(--ct-sub);white-space:nowrap;">{{ a.progress || 0 }}%</span>
              </div>
              <div v-if="a.paidAmount" style="font-size:10px;color:#10b981;margin-top:2px;">
                Paid: Rs. {{ Number(a.paidAmount).toLocaleString('en-IN') }}
              </div>
            </td>
            <td style="font-size:11px;color:var(--ct-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              {{ (a.workDone || []).join(', ') || '—' }}
            </td>
            <td style="color:var(--ct-sub);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ a.remarks || '—' }}</td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:nowrap;" @click.stop>
                <button v-if="a.status !== 'completed'" class="btn-success btn-sm" @click="openComplete(a)" title="Mark Complete" style="white-space:nowrap;padding:4px 8px;">
                  <CheckCircle :size="12" /> Complete
                </button>
                <button class="btn-secondary btn-sm" @click="openEdit(a)" title="Edit">
                  <Pencil :size="12" />
                </button>
                <button class="btn-secondary btn-sm" style="color:#818cf8;" @click="timelineRecord = a; showTimeline = true" title="Activity Timeline">
                  <History :size="12" />
                </button>
                <button class="btn-secondary btn-sm" @click="exportCertificatePDF(a)" title="Download Completion Certificate">
                  <FileText :size="12" />
                </button>
                <button class="btn-secondary btn-sm" style="color:#10b981;" @click="openPayment(a)" title="Log Payment Received">
                  <DollarSign :size="12" />
                </button>
                <button v-if="authStore.can('canDelete')" class="btn-danger btn-sm" @click="confirmDel(a)" title="Delete">
                  <Trash2 :size="12" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <AppModal
      v-model="showModal"
      :title="editingId ? 'Edit Activity' : 'Log Installation Activity'"
      :subtitle="editingId ? 'Update activity record' : 'Record installation progress'"
      width="720px"
    >
      <form @submit.prevent="saveActivity" class="form-grid">
        <!-- Project Selection Toggle -->
        <div class="form-group form-full" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:rgba(99,102,241,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--ct-accent);">
                <FolderOpen :size="16" />
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">Link to Project</div>
                <div style="font-size:11px;color:var(--ct-muted);">Select an existing project or enter details manually</div>
              </div>
            </div>
            <button
              type="button"
              @click="useProject = !useProject"
              :style="`width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${useProject ? '#6366f1' : 'rgba(255,255,255,0.12)'};position:relative;`"
            >
              <span :style="`position:absolute;top:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${useProject ? '23px' : '3px'};`"></span>
            </button>
          </div>
        </div>

        <!-- Project search (toggle ON) -->
        <div v-if="useProject" class="form-group form-full">
          <label class="label">Select Project *</label>
          <div style="position:relative;">
            <input
              v-model="projectSearch"
              class="input"
              placeholder="Search project name…"
              @focus="showProjectDropdown = true"
              @blur="delayCloseDropdown"
            />
            <div v-if="showProjectDropdown && filteredProjectOptions.length" class="proj-dd" style="position:absolute;top:100%;left:0;right:0;border-radius:8px;z-index:100;max-height:180px;overflow-y:auto;">
              <div
                v-for="p in filteredProjectOptions"
                :key="p.id"
                @mousedown.prevent="selectProject(p)"
                class="proj-dd-item"
                style="padding:10px 14px;cursor:pointer;font-size:13px;"
                :style="form.projectId === p.id ? 'background:rgba(99,102,241,0.15);' : ''"
              >
                <div>{{ p.projectName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.clientName }} · {{ p.address || p.city || '—' }}</div>
              </div>
            </div>
          </div>
          <!-- Address info card when project selected -->
          <div v-if="form.projectId && form.projectAddress" style="margin-top:8px;display:flex;gap:10px;padding:10px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;font-size:12px;">
            <div style="color:var(--ct-accent);flex-shrink:0;">📍</div>
            <div><span style="color:var(--ct-muted);">Client:</span> <span style="color:var(--ct-primary);">{{ form.projectClient }}</span> &nbsp;·&nbsp; <span style="color:var(--ct-muted);">Address:</span> <span style="color:var(--ct-primary);">{{ form.projectAddress }}</span></div>
          </div>
          <!-- Client selection from project -->
          <div v-if="form.projectId && selectedProject && selectedProject.clients && selectedProject.clients.length > 0" class="form-group" style="margin-top:10px;">
            <label class="label">Select Client Contact(s)</label>
            <div style="display:flex;flex-direction:column;gap:6px;padding:10px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.12);border-radius:10px;">
              <label v-for="c in selectedProject.clients" :key="c.name + c.phone" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--ct-sub);">
                <input
                  type="checkbox"
                  :value="c"
                  :checked="form.selectedClients.some(sc => sc.name === c.name && sc.phone === c.phone)"
                  @change="e => { if (e.target.checked) form.selectedClients.push(c); else form.selectedClients = form.selectedClients.filter(sc => !(sc.name === c.name && sc.phone === c.phone)) }"
                  style="accent-color:#6366f1;width:15px;height:15px;"
                />
                <span><strong>{{ c.name }}</strong><span v-if="c.designation" style="color:var(--ct-muted);"> · {{ c.designation }}</span><span v-if="c.phone" style="color:var(--ct-muted);"> · {{ c.phone }}</span></span>
              </label>
            </div>
          </div>
          <!-- Lift selection (only when project has buildings) -->
          <div v-if="form.projectId && selectedProject && selectedProject.buildings && selectedProject.buildings.length" class="form-group" style="margin-top:10px;">
            <label class="label">Select Buildings / Wings / Lifts</label>
            <LiftSelector v-model="form.liftSelection" :project="selectedProject" />
          </div>
        </div>

        <!-- Manual client details (toggle OFF) -->
        <div v-if="!useProject" class="form-group">
          <label class="label">Client Name *</label>
          <input v-model="form.clientName" class="input" placeholder="Client / company name" />
        </div>
        <div v-if="!useProject" class="form-group">
          <label class="label">Location</label>
          <input v-model="form.location" class="input" placeholder="Site / location" />
        </div>
        <div v-if="!useProject" class="form-group">
          <label class="label">Lift Type</label>
          <select v-model="form.liftType" class="input">
            <option value="">Select…</option>
            <option value="passenger">Passenger Elevator</option>
            <option value="goods">Goods Elevator</option>
            <option value="hospital">Hospital Elevator</option>
            <option value="dumbwaiter">Dumbwaiter</option>
            <option value="hydraulic">Hydraulic</option>
          </select>
        </div>
        <div v-if="!useProject" class="form-group">
          <label class="label">Issue / Scope</label>
          <input v-model="form.issueDescription" class="input" placeholder="Brief description" />
        </div>
        <div class="form-group">
          <label class="label">Lift Number</label>
          <input v-model="form.liftNumber" class="input" placeholder="e.g. Lift-01" />
        </div>
        <div class="form-group">
          <label class="label">Activity Date *</label>
          <input v-model="form.activityDate" type="date" class="input" required />
        </div>
        <div class="form-group form-full">
          <label class="label">Assigned Technicians</label>
          <TechnicianSelect v-model="form.technicians" />
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="label">Work Done</label>
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">
            <label v-for="w in workDoneOptions" :key="w" style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--ct-sub);">
              <input
                type="checkbox"
                :value="w"
                :checked="form.workDone.includes(w)"
                @change="toggleWork(w)"
                style="accent-color:#6366f1;width:15px;height:15px;"
              />
              {{ w }}
            </label>
          </div>
        </div>
        <div class="form-group form-full">
          <label class="label">Progress: {{ form.progress }}%</label>
          <input v-model.number="form.progress" type="range" min="0" max="100" step="5" style="width:100%;accent-color:#6366f1;" />
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ct-muted);margin-top:2px;">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
        <div class="form-group form-full">
          <label class="label">Remarks</label>
          <textarea v-model="form.remarks" class="input" rows="2" placeholder="Notes about today's work…" style="resize:vertical;"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Next Step Date</label>
          <input v-model="form.nextStepDate" type="date" class="input" />
        </div>
        <div class="form-group">
          <label class="label">Photos</label>
          <input type="file" accept="image/*" multiple @change="handlePhotos" class="input" style="padding:6px;" />
          <div v-if="form.photos.length" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
            <div v-for="(ph, i) in form.photos" :key="i" style="position:relative;">
              <img :src="ph" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1);" />
              <button type="button" @click="removePhoto(i)" style="position:absolute;top:-4px;right:-4px;background:#ef4444;border:none;border-radius:50%;width:16px;height:16px;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">×</button>
            </div>
          </div>
        </div>
        <!-- Completion Photos -->
        <div class="form-group form-full">
          <div style="padding:14px 16px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);border-radius:10px;">
            <div style="font-size:12px;font-weight:600;color:var(--ct-sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Completion Photos</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
              <div
                v-for="(photo, i) in form.completionPhotos"
                :key="i"
                style="position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);"
              >
                <img :src="photo" style="width:100%;height:100%;object-fit:cover;" />
                <button type="button" @click="form.completionPhotos.splice(i,1)" style="position:absolute;top:2px;right:2px;width:20px;height:20px;background:rgba(239,68,68,0.8);border:none;border-radius:50%;color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <label class="btn-secondary btn-sm" style="cursor:pointer;">
                📁 Upload Photos
                <input type="file" accept="image/*" multiple style="display:none;" @change="addPhotos($event, 'completionPhotos')" />
              </label>
              <label class="btn-secondary btn-sm" style="cursor:pointer;">
                📷 Take Photo
                <input type="file" accept="image/*" capture="environment" style="display:none;" @change="addPhotos($event, 'completionPhotos')" />
              </label>
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" type="button" @click="showModal = false">Cancel</button>
        <button class="btn-primary" type="button" :disabled="saving" @click="saveActivity">
          <Loader2 v-if="saving" :size="14" style="animation:spin 1s linear infinite;" />
          <Save v-else :size="14" />
          {{ editingId ? 'Update' : 'Save Activity' }}
        </button>
      </template>
    </AppModal>

    <!-- View Details Modal -->
    <AppModal v-model="showViewModal" title="Activity Details" subtitle="Read-only view" width="680px">
      <div v-if="viewTarget" style="display:flex;flex-direction:column;gap:16px;">
        <div class="form-grid">
          <div class="form-group">
            <div class="label">Project</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ projectName(viewTarget.projectId) }}</div>
          </div>
          <div class="form-group">
            <div class="label">Lift Number</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ viewTarget.liftNumber || '—' }}</div>
          </div>
          <div class="form-group">
            <div class="label">Activity Date</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ formatDate(viewTarget.activityDate) }}</div>
          </div>
          <div class="form-group">
            <div class="label">Technician</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ viewTarget.technician || '—' }}</div>
          </div>
          <div class="form-group">
            <div class="label">Status</div>
            <div style="margin-top:4px;"><span :class="['badge', statusBadge(viewTarget.status)]">{{ formatStatus(viewTarget.status) }}</span></div>
          </div>
          <div class="form-group">
            <div class="label">Progress</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <div style="flex:1;height:8px;background:rgba(255,255,255,0.08);border-radius:4px;">
                <div :style="`width:${viewTarget.progress || 0}%;height:100%;background:#6366f1;border-radius:4px;`"></div>
              </div>
              <span style="font-size:12px;color:var(--ct-sub);">{{ viewTarget.progress || 0 }}%</span>
            </div>
          </div>
          <div class="form-group form-full">
            <div class="label">Work Done</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
              <span v-for="w in (viewTarget.workDone || [])" :key="w" class="badge badge-info">{{ w }}</span>
              <span v-if="!(viewTarget.workDone || []).length" style="color:var(--ct-muted);font-size:13px;">—</span>
            </div>
          </div>
          <div class="form-group form-full">
            <div class="label">Remarks</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;line-height:1.6;">{{ viewTarget.remarks || '—' }}</div>
          </div>
          <div class="form-group">
            <div class="label">Next Step Date</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ formatDate(viewTarget.nextStepDate) }}</div>
          </div>
        </div>
        <div v-if="(viewTarget.photos || []).length">
          <div class="label" style="margin-bottom:8px;">Photos</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            <img v-for="(ph, i) in viewTarget.photos" :key="i" :src="ph" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.1);" />
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <button class="btn-primary" @click="openEdit(viewTarget); showViewModal = false">
          <Pencil :size="14" /> Edit
        </button>
      </template>
    </AppModal>

    <!-- Completion Modal -->
    <AppModal v-model="showCompleteModal" title="Mark as Completed" subtitle="Capture completion signature" width="600px">
      <div style="display:flex;flex-direction:column;gap:16px;" v-if="completeTarget">
        <div style="padding:12px 14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;font-size:13px;color:#4ade80;">
          Marking installation at <strong>{{ projectName(completeTarget.projectId) }}</strong> as <strong>Completed</strong>
        </div>
        <div class="form-grid">
          <div class="form-group form-full">
            <label class="label">Completion Remarks</label>
            <textarea v-model="completeForm.resolutionNote" class="input" rows="2" placeholder="What was completed, any observations…" style="resize:vertical;"></textarea>
          </div>
          <div class="form-group">
            <label class="label">Signatory Name</label>
            <input v-model="completeForm.signatoryName" class="input" placeholder="Customer / site representative" />
          </div>
          <div class="form-group">
            <label class="label">Designation</label>
            <input v-model="completeForm.signatoryDesignation" class="input" placeholder="e.g. Site Engineer" />
          </div>
        </div>
        <SignatureCanvas v-model="completeForm.signature" label="Customer / Representative Signature" />
        <div style="padding:12px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;">
          <div style="font-size:12px;color:var(--ct-muted);margin-bottom:8px;">Completion Photos</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <div v-for="(ph,i) in completeForm.photos" :key="i" style="position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
              <img :src="ph" style="width:100%;height:100%;object-fit:cover;" />
              <button type="button" @click="completeForm.photos.splice(i,1)" style="position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(239,68,68,0.8);border:none;border-radius:50%;color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <label class="btn-secondary btn-sm" style="cursor:pointer;">📁 Upload <input type="file" accept="image/*" multiple style="display:none;" @change="addCompletePhotos" /></label>
            <label class="btn-secondary btn-sm" style="cursor:pointer;">📷 Camera <input type="file" accept="image/*" capture="environment" style="display:none;" @change="addCompletePhotos" /></label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showCompleteModal = false">Cancel</button>
        <button class="btn-success" @click="saveCompletion" :disabled="saving">
          <Loader2 v-if="saving" :size="14" style="animation:spin 1s linear infinite;" />
          <CheckCircle v-else :size="14" />
          Mark Completed
        </button>
      </template>
    </AppModal>

    <!-- Confirm Delete -->
    <ConfirmDialog
      v-model="showConfirm"
      title="Delete Activity"
      :message="`Delete this installation activity record? This cannot be undone.`"
      confirmLabel="Delete"
      :danger="true"
      @confirm="deleteActivity"
    />

    <!-- Activity Timeline -->
    <ActivityTimeline
      v-model="showTimeline"
      :record-id="timelineRecord?.id || ''"
      :collection="Collections.INSTALLATION"
      :title="`Installation — ${projectName(timelineRecord?.projectId)}`"
      :record-summary="`${timelineRecord?.liftType || ''} · Tech: ${timelineRecord?.technician || '—'} · ${timelineRecord?.progress || 0}% complete`"
    />

  <!-- Log Payment Modal -->
  <AppModal v-model="payModal" title="Log Payment Received" subtitle="Record a payment against this installation" width="480px">
    <div v-if="payTarget" style="display:flex;flex-direction:column;gap:16px;">
      <div style="padding:10px 14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);border-radius:10px;font-size:13px;color:#4ade80;">
        Logging payment for <strong>{{ projectName(payTarget.projectId) || payTarget.id }}</strong>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="label">Amount (Rs.) *</label>
          <input v-model.number="payForm.amount" type="number" class="input" min="0" step="0.01" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label class="label">Date *</label>
          <input v-model="payForm.date" type="date" class="input" />
        </div>
        <div class="form-group">
          <label class="label">Payment Method</label>
          <select v-model="payForm.method" class="input">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Reference / Cheque No.</label>
          <input v-model="payForm.reference" class="input" placeholder="Optional" />
        </div>
        <div class="form-group form-full">
          <label class="label">Note</label>
          <input v-model="payForm.note" class="input" placeholder="Optional note" />
        </div>
      </div>
      <div v-if="payTarget.paymentHistory?.length" style="padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
        <div style="font-size:11px;color:var(--ct-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">Previous Payments</div>
        <div v-for="(ph, i) in payTarget.paymentHistory" :key="i" style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="color:var(--ct-sub);">{{ ph.date }} · {{ ph.method }}</span>
          <span style="color:#10b981;font-weight:600;">Rs. {{ Number(ph.amount).toLocaleString('en-IN') }}</span>
        </div>
        <div style="margin-top:6px;font-size:12px;font-weight:600;color:#10b981;">Total Paid: Rs. {{ Number(payTarget.paidAmount || 0).toLocaleString('en-IN') }}</div>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="payModal = false">Cancel</button>
      <button class="btn-success" @click="savePayment" :disabled="saving">
        <Loader2 v-if="saving" :size="14" style="animation:spin 1s linear infinite;" />
        <span v-else>Save Payment</span>
      </button>
    </template>
  </AppModal>

  <ExportDialog
    v-model="expDlgVisible"
    v-model:selectedPeriod="expPeriod"
    v-model:exportType="expType"
    :exporting="expRunning"
    @confirm="runExport"
    @cancel="cancelExport"
  />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  HardHat, Plus, Search, Pencil, Trash2, Eye,
  FileDown, Save, Loader2, FolderOpen, FileText, History, CheckCircle, DollarSign
} from 'lucide-vue-next'
import ExportDialog from '@/components/ui/ExportDialog.vue'
import ActivityTimeline from '@/components/ui/ActivityTimeline.vue'
import { logTimeline } from '@/utils/timeline'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import TechnicianSelect from '@/components/ui/TechnicianSelect.vue'
import SignatureCanvas from '@/components/ui/SignatureCanvas.vue'
import LiftSelector from '@/components/ui/LiftSelector.vue'
import { getAll, create, update, remove } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { savePDF } from '@/utils/saveFile'
import { usePDF } from '@/composables/usePDF'
import { useExport } from '@/composables/useExport'
import { useAuthStore } from '@/stores/auth'

const ui = useUIStore()
const activity = useActivityStore()
const authStore = useAuthStore()
const { exportTablePDF, _drawHeader, _drawFooter, _sectionLabel, _infoGrid, _C, _MARGIN, _PAGE_W, _getCtx, _drawReceiptHeader, _drawReceiptFooter, _drawBlackSig, _RECEIPT } = usePDF()
const { showExportDialog, dialogVisible: expDlgVisible, selectedPeriod: expPeriod, exportType: expType, exporting: expRunning, runExport, cancelExport } = useExport()

// ── Data ─────────────────────────────────────────────────────────────────────
const activities = ref([])
const projects = ref([])
const technicians = ref([])
const loading = ref(false)
const saving = ref(false)

// Payment tracking
const payModal = ref(false)
const payTarget = ref(null)
const payForm = ref({ amount: 0, date: new Date().toISOString().slice(0,10), method: 'cash', reference: '', note: '' })

// ── Filters ───────────────────────────────────────────────────────────────────
const search = ref('')
const filterProject = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')
const filterStatus = ref('')

const statusOptions = [
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On Hold' },
]

const workDoneOptions = [
  'Civil Work', 'Shaft Work', 'Machine Room', 'Guide Rails',
  'Car Frame', 'Cabin', 'Electrical', 'Testing', 'Commissioning',
]

// ── Project Selection Toggle ──────────────────────────────────────────────────
const useProject = ref(true)

// ── Dropdown search ───────────────────────────────────────────────────────────
const projectSearch = ref('')
const showProjectDropdown = ref(false)

const filteredProjectOptions = computed(() => {
  const q = projectSearch.value.toLowerCase()
  return projects.value.filter(p => (p.projectName || '').toLowerCase().includes(q))
})

function selectProject(p) {
  form.value.projectId = p.id
  form.value.projectAddress = (p.address ? p.address + (p.city ? ', ' + p.city : '') : p.city || '')
  form.value.projectClient = p.clientName || ''
  form.value.selectedClients = []
  projectSearch.value = p.projectName
  showProjectDropdown.value = false
}

function delayCloseDropdown() {
  setTimeout(() => { showProjectDropdown.value = false }, 200)
}

// ── Modal / Form ──────────────────────────────────────────────────────────────
const showModal = ref(false)
const showViewModal = ref(false)
const showConfirm = ref(false)
const showCompleteModal = ref(false)
const completeTarget = ref(null)
const completeForm = ref({ resolutionNote: '', signatoryName: '', signatoryDesignation: '', signature: '', photos: [] })

function openComplete(a) {
  completeTarget.value = a
  completeForm.value = { resolutionNote: '', signatoryName: '', signatoryDesignation: '', signature: '', photos: [] }
  showCompleteModal.value = true
}

function addCompletePhotos(event) {
  Array.from(event.target.files || []).forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => { completeForm.value.photos = [...completeForm.value.photos, e.target.result] }
    reader.readAsDataURL(file)
  })
  event.target.value = ''
}

async function saveCompletion() {
  if (!completeTarget.value) return
  saving.value = true
  try {
    await update(Collections.INSTALLATION, completeTarget.value.id, {
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString(),
      completionRemarks: completeForm.value.resolutionNote,
      completionSignature: completeForm.value.signature,
      signatoryName: completeForm.value.signatoryName,
      signatoryDesignation: completeForm.value.signatoryDesignation,
      completionPhotos: [...(completeTarget.value.completionPhotos || []), ...completeForm.value.photos],
    })
    await logTimeline(Collections.INSTALLATION, completeTarget.value.id, 'status_change', `Marked as Completed by ${authStore.user?.fullName || 'User'}`)
    ui.success('Installation marked as completed')
    showCompleteModal.value = false
    await loadData()
  } catch { ui.error('Failed to save completion') }
  finally { saving.value = false }
}

const editingId = ref(null)
const deleteTarget = ref(null)
const showTimeline = ref(false)
const timelineRecord = ref(null)
let editingStatus = ''
const viewTarget = ref(null)

const defaultForm = () => ({
  projectId: '',
  projectAddress: '',
  projectClient: '',
  selectedClients: [],
  clientName: '',
  location: '',
  liftType: '',
  issueDescription: '',
  liftNumber: '',
  liftSelection: { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] },
  activityDate: '',
  technicians: [],
  workDone: [],
  progress: 0,
  remarks: '',
  nextStepDate: '',
  photos: [],
  completionPhotos: [],
  status: 'in-progress',
})
const form = ref(defaultForm())

const selectedProject = computed(() => projects.value.find(p => p.id === form.value.projectId) || null)

// ── Computed ──────────────────────────────────────────────────────────────────
const filteredActivities = computed(() => {
  const q = search.value.toLowerCase()
  return activities.value.filter(a => {
    const pName = projectName(a.projectId).toLowerCase()
    const matchSearch = !q || pName.includes(q) || (a.technician || '').toLowerCase().includes(q)
    const matchProject = !filterProject.value || a.projectId === filterProject.value
    const matchStatus = !filterStatus.value || a.status === filterStatus.value
    const matchFrom = !filterDateFrom.value || (a.activityDate || '') >= filterDateFrom.value
    const matchTo = !filterDateTo.value || (a.activityDate || '') <= filterDateTo.value
    return matchSearch && matchProject && matchStatus && matchFrom && matchTo
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function projectName(id) {
  return projects.value.find(p => p.id === id)?.projectName || id || '—'
}

function formatDate(val) {
  if (!val) return '—'
  const d = val?.toDate ? val.toDate() : new Date(val)
  if (isNaN(d.getTime())) return val
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function formatStatus(s) {
  return { 'in-progress': 'In Progress', 'completed': 'Completed', 'on-hold': 'On Hold' }[s] || s
}

function statusBadge(s) {
  return { 'in-progress': 'badge-info', 'completed': 'badge-active', 'on-hold': 'badge-warning' }[s] || ''
}

function addPhotos(event, field) {
  const files = Array.from(event.target.files || [])
  files.forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => { form.value[field] = [...(form.value[field] || []), e.target.result] }
    reader.readAsDataURL(file)
  })
  event.target.value = ''
}

function toggleWork(w) {
  const idx = form.value.workDone.indexOf(w)
  if (idx === -1) form.value.workDone.push(w)
  else form.value.workDone.splice(idx, 1)
}

async function handlePhotos(e) {
  const files = Array.from(e.target.files)
  for (const file of files) {
    const reader = new FileReader()
    reader.onload = (ev) => { form.value.photos.push(ev.target.result) }
    reader.readAsDataURL(file)
  }
}

function removePhoto(i) {
  form.value.photos.splice(i, 1)
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const [a, p, e] = await Promise.all([
      getAll(Collections.INSTALLATION),
      getAll(Collections.PROJECTS),
      getAll(Collections.EMPLOYEES),
    ])
    activities.value = a.filter(item => !item.recordId && !item.type).sort((x, y) => {
      const dx = x.createdAt?.toDate?.() || new Date(x.createdAt || 0)
      const dy = y.createdAt?.toDate?.() || new Date(y.createdAt || 0)
      return dy - dx
    })
    projects.value = p
    technicians.value = e.filter(emp => emp.role === 'technician' || emp.department === 'Technical')
  } catch {
    ui.error('Failed to load installation activities')
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingId.value = null
  form.value = defaultForm()
  useProject.value = true
  projectSearch.value = ''
  showModal.value = true
}

function openEdit(a) {
  editingId.value = a.id
  editingStatus = a.status || 'in-progress'
  useProject.value = !!a.projectId
  const linkedProj = a.projectId ? projects.value.find(p => p.id === a.projectId) : null
  form.value = {
    projectId: a.projectId || '',
    projectAddress: linkedProj ? (linkedProj.address ? linkedProj.address + (linkedProj.city ? ', ' + linkedProj.city : '') : linkedProj.city || '') : '',
    projectClient: linkedProj?.clientName || '',
    selectedClients: Array.isArray(a.selectedClients) ? [...a.selectedClients] : [],
    clientName: a.clientName || '',
    location: a.location || '',
    liftType: a.liftType || '',
    issueDescription: a.issueDescription || '',
    liftNumber: a.liftNumber || '',
    liftSelection: a.liftSelection ? { ...a.liftSelection } : { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] },
    activityDate: a.activityDate || '',
    technician: a.technician || '',
    technicians: Array.isArray(a.technicians) ? [...a.technicians] : [],
    workDone: [...(a.workDone || [])],
    progress: a.progress || 0,
    remarks: a.remarks || '',
    nextStepDate: a.nextStepDate || '',
    photos: [...(a.photos || [])],
    status: a.status || 'in-progress',
  }
  projectSearch.value = a.projectId ? projectName(a.projectId) : ''
  showModal.value = true
}

function openView(a) {
  viewTarget.value = a
  showViewModal.value = true
}

watch([() => ui.pendingAutoOpen, activities], () => {
  const pending = ui.pendingAutoOpen
  if (!pending || pending.collection !== Collections.INSTALLATION) return
  const record = activities.value.find(r => r.id === pending.recordId)
  if (record) { openView(record); ui.clearPendingAutoOpen() }
})

async function saveActivity() {
  if ((useProject.value && !form.value.projectId) || (!useProject.value && !form.value.clientName)) {
    ui.warning(useProject.value ? 'Please select a project' : 'Client name is required')
    return
  }
  if (!form.value.activityDate) {
    ui.warning('Please fill all required fields')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await update(Collections.INSTALLATION, editingId.value, { ...form.value })
      activity.log({ action: 'updated', module: 'installation', tab: 'Installation', summary: `Updated installation activity for ${form.value.clientName || form.value.projectId || '—'}`, details: { clientName: form.value.clientName, liftType: form.value.liftType, status: form.value.status, progress: form.value.progress } })
      ui.success('Activity updated')
      if (editingStatus && editingStatus !== form.value.status) {
        await logTimeline(Collections.INSTALLATION, editingId.value, 'status_change',
          `Status changed: ${editingStatus} → ${form.value.status}`)
      } else {
        await logTimeline(Collections.INSTALLATION, editingId.value, 'updated',
          `Progress updated to ${form.value.progress || 0}%`)
      }
    } else {
      const newId = await create(Collections.INSTALLATION, { ...form.value })
      activity.log({ action: 'created', module: 'installation', tab: 'Installation', summary: `Logged installation activity for ${form.value.clientName || form.value.projectId || '—'}`, details: { clientName: form.value.clientName, liftType: form.value.liftType, activityDate: form.value.activityDate } })
      ui.success('Activity logged')
      await logTimeline(Collections.INSTALLATION, newId, 'created',
        `Installation activity created — ${form.value.liftType || ''} by ${form.value.technician || '—'}`)
    }
    showModal.value = false
    await loadData()
  } catch {
    ui.error('Failed to save activity')
  } finally {
    saving.value = false
  }
}

function confirmDel(a) {
  deleteTarget.value = a
  showConfirm.value = true
}

async function deleteActivity() {
  if (!deleteTarget.value) return
  try {
    await remove(Collections.INSTALLATION, deleteTarget.value.id)
    activity.log({ action: 'deleted', module: 'installation', tab: 'Installation', summary: `Deleted installation activity for ${deleteTarget.value.clientName || deleteTarget.value.id}`, details: { clientName: deleteTarget.value.clientName, liftType: deleteTarget.value.liftType } })
    ui.success('Activity deleted')
    await loadData()
  } catch {
    ui.error('Failed to delete activity')
  }
}

// ── Completion Certificate PDF ─────────────────────────────────────────────────
async function exportCertificatePDF(a) {
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const { company, userName } = await _getCtx()
    const M = _MARGIN
    const W = _PAGE_W
    const proj = projects.value.find(p => p.id === a.projectId)

    let y = await _drawReceiptHeader(doc, 'Installation Completion Certificate', `Certificate ID: ${a.id?.slice(0, 12) || '—'}`)

    // ── Certification statement ───────────────────────────────────────────────
    doc.setFillColor(..._C.lightGrey)
    doc.rect(M, y, W - M * 2, 18, 'F')
    doc.setDrawColor(..._C.blue)
    doc.setLineWidth(0.5)
    doc.rect(M, y, W - M * 2, 18)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.black)
    const stmt = 'This certifies that the elevator installation has been successfully completed at the site below, in accordance with all applicable standards and specifications.'
    const stmtLines = doc.splitTextToSize(stmt, W - M * 2 - 6)
    doc.text(stmtLines, M + 3, y + 6)
    y += 22

    // ── Project Details ──────────────────────────────────────────────────────
    y = _sectionLabel(doc, 'Project Details', y, _C.blue)
    y = _infoGrid(doc, [
      ['Project Name', proj?.projectName || a.projectClient || '—'],
      ['Client', a.projectClient || proj?.clientName || '—'],
      ['Site Address', a.projectAddress || proj?.address || '—'],
      ['Activity Date', formatDate(a.activityDate)],
      ['Lift Type', a.liftType || '—'],
      ['Lift Number / Floor', a.liftNumber || '—'],
      ['Technician', a.technician || (a.technicians || []).join(', ') || '—'],
      ['Progress', `${a.progress || 0}%`],
      ['Status', (a.status || '—').toUpperCase()],
    ], y)

    // ── Work Completed ───────────────────────────────────────────────────────
    if (a.workDone?.length) {
      y = _sectionLabel(doc, 'Work Completed', y, _C.greyText)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.black)
      a.workDone.forEach((w, i) => {
        doc.text(`- ${w}`, M + 2, y + i * 6)
      })
      y += a.workDone.length * 6 + 6
    }

    // ── Remarks ──────────────────────────────────────────────────────────────
    if (a.remarks) {
      y = _sectionLabel(doc, 'Remarks', y, _C.greyText)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.black)
      const rLines = doc.splitTextToSize(a.remarks, W - M * 2)
      doc.text(rLines, M, y)
      y += rLines.length * 5 + 8
    }

    // ── Completion Remarks (from completion form) ─────────────────────────────
    if (a.completionRemarks) {
      if (y > _RECEIPT.CONTENT_MAX_Y) { doc.addPage(); y = _RECEIPT.PAGE_NEW_START }
      y = _sectionLabel(doc, 'Completion Remarks', y, _C.greyText)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(..._C.black)
      const crLines = doc.splitTextToSize(a.completionRemarks, W - M * 2)
      doc.text(crLines, M, y)
      y += crLines.length * 5 + 8
    }

    // ── Signature blocks ─────────────────────────────────────────────────────
    if (y > _RECEIPT.CONTENT_MAX_Y - 44) { doc.addPage(); y = _RECEIPT.PAGE_NEW_START }
    y = _sectionLabel(doc, 'Signatures', y, _C.greyText)
    y += 2
    const sigW = (W - M * 2 - 6) / 2
    _drawBlackSig(doc, M, y, sigW, 40, 'TECHNICIAN SIGNATURE', a.technicianSignature || null, a.technician || '—', 'Technician')
    _drawBlackSig(doc, M + sigW + 6, y, sigW, 40, 'AUTHORISED SIGNATORY', null, company.name || '—', 'Authorised Signatory')
    y += 44

    await _drawReceiptFooter(doc)
    await savePDF(doc, `Installation-Certificate-${(proj?.projectName || a.id || 'cert').replace(/\s+/g, '_')}.pdf`, ui)
    ui.success('Certificate PDF downloaded')
  } catch (e) {
    console.error(e)
    ui.error('Failed to generate certificate')
  }
}

// ── Bulk Export ───────────────────────────────────────────────────────────────
function triggerExport(type) {
  showExportDialog({
    rows: activities.value,
    dateField: 'activityDate',
    columns: ['Project', 'Lift #', 'Date', 'Technician', 'Status', 'Progress', 'Work Done', 'Remarks'],
    title: 'Installation Activities Report',
    filename: 'installation-activities',
    accent: [16, 185, 129],
    ui,
    pdfRowMapper: a => [
      projectName(a.projectId),
      a.liftNumber || '—',
      formatDate(a.activityDate),
      a.technician || '—',
      formatStatus(a.status),
      `${a.progress || 0}%`,
      (a.workDone || []).join(', ') || '—',
      a.remarks || '—',
    ],
    excelRowMapper: a => [
      projectName(a.projectId),
      a.liftNumber || '—',
      formatDate(a.activityDate),
      a.technician || '—',
      formatStatus(a.status),
      a.progress || 0,
      (a.workDone || []).join(', ') || '—',
      a.remarks || '—',
    ],
  })
  if (type) expType.value = type
}

function openPayment(record) {
  payTarget.value = record
  payForm.value = { amount: 0, date: new Date().toISOString().slice(0, 10), method: 'cash', reference: '', note: '' }
  payModal.value = true
}

async function savePayment() {
  if (!payTarget.value || !payForm.value.amount || payForm.value.amount <= 0) {
    ui.error('Enter a valid amount')
    return
  }
  saving.value = true
  try {
    const existing = payTarget.value.paymentHistory || []
    const newEntry = {
      ...payForm.value,
      loggedBy: authStore.user?.fullName || authStore.user?.username || 'User',
      loggedAt: new Date().toISOString(),
    }
    const updatedHistory = [...existing, newEntry]
    const newPaid = updatedHistory.reduce((s, p) => s + Number(p.amount || 0), 0)
    await update(Collections.INSTALLATION, payTarget.value.id, {
      paymentHistory: updatedHistory,
      paidAmount: newPaid,
    })
    ui.success(`Payment of Rs. ${Number(payForm.value.amount).toLocaleString('en-IN')} logged.`)
    payModal.value = false
    await loadData()
  } catch { ui.error('Failed to log payment') }
  finally { saving.value = false }
}

onMounted(loadData)

watch(() => ui.scheduleContext, (ctx) => {
  if (!ctx || ctx.tab !== 'installation') return
  editingId.value = null
  form.value = defaultForm()
  form.value.projectId = ctx.projectId || ''
  form.value.projectAddress = ctx.clientAddress || ''
  form.value.projectClient = ctx.clientName || ''
  form.value.clientName = ctx.clientName || ''
  useProject.value = true
  projectSearch.value = ctx.projectName || ''
  showModal.value = true
  ui.clearScheduleContext()
}, { immediate: true })
</script>

<style scoped>
.installation-view { padding: 0; }
.page-sub { font-size: 13px; color:var(--ct-muted); margin-top: 4px; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }
</style>
