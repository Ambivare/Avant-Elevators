<template>
  <div class="repairs-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Hammer :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Repairs & Maintenance
        </h1>
        <p class="page-sub">Swift fixes, fully documented every time.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <button class="btn-secondary btn-sm" @click="triggerExport('pdf')"><FileDown :size="14" /> PDF</button>
        <button class="btn-secondary btn-sm" @click="triggerExport('excel')"><FileText :size="14" /> Excel</button>
        <button class="btn-secondary btn-sm" @click="showImportModal = true">
          <Upload :size="14" /> Import Excel
        </button>
        <button v-if="authStore.can('canCreateService') || authStore.role === 'technician'" class="btn-primary" @click="openAdd">
          <Plus :size="16" /> New Repair
        </button>
      </div>
    </div>

    <!-- Filters Row -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div style="flex:1;min-width:220px;position:relative;">
        <Search :size="14" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--ct-muted);" />
        <input v-model="search" class="input" style="padding-left:32px;" placeholder="Search by client or technician…" />
      </div>
      <select v-model="filterRepairType" class="input" style="width:180px;">
        <option value="">All Repair Types</option>
        <option v-for="t in repairTypes" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="filterStatus" class="input" style="width:160px;">
        <option value="">All Statuses</option>
        <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div v-if="loading" style="padding:48px;text-align:center;color:var(--ct-muted);">
        <Loader2 :size="28" style="animation:spin 1s linear infinite;" />
        <p style="margin-top:10px;font-size:13px;">Loading repairs…</p>
      </div>
      <div v-else-if="!filteredRepairs.length" class="empty-state">
        <Hammer :size="40" style="opacity:.3;margin-bottom:12px;" />
        <p>No repair records found.</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Project / Client</th>
            <th>Repair Type</th>
            <th>Fault Description</th>
            <th>Technician</th>
            <th>Date</th>
            <th>Status</th>
            <th>Total Cost</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filteredRepairs" :key="r.id" @click="openView(r)" style="cursor:pointer;">
            <td>
              <div v-if="r.projectId" style="font-weight:600;color:var(--ct-primary);font-size:13px;">{{ projectName(r.projectId) }}</div>
              <div :style="r.projectId ? 'font-size:11px;color:var(--ct-muted);margin-top:1px;' : 'font-weight:500;color:var(--ct-primary);'">{{ r.clientName || '—' }}</div>
            </td>
            <td><span class="badge badge-info">{{ r.repairType || '—' }}</span></td>
            <td style="color:var(--ct-sub);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ r.faultDescription || '—' }}</td>
            <td style="color:var(--ct-sub);">{{ (r.technicians || [r.technician]).filter(Boolean).join(', ') || '—' }}</td>
            <td style="color:var(--ct-muted);font-size:12px;">{{ formatDate(r.repairDate) }}</td>
            <td><span :class="['badge', statusBadge(r.status)]">{{ formatStatus(r.status) }}</span></td>
            <td style="color:var(--ct-accent);font-weight:600;">{{ formatCurrency(r.totalCost) }}</td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:nowrap;" @click.stop>
                <button v-if="r.status !== 'completed'" class="btn-success btn-sm" @click="openComplete(r)" title="Mark Complete" style="white-space:nowrap;padding:4px 8px;">
                  <CheckCircle :size="12" /> Complete
                </button>
                <button v-if="authStore.role !== 'technician'" class="btn-secondary btn-sm" @click="openEdit(r)" title="Edit">
                  <Pencil :size="12" />
                </button>
                <button class="btn-secondary btn-sm" style="color:#818cf8;" @click="timelineRecord = r; showTimeline = true" title="Activity Timeline">
                  <History :size="12" />
                </button>
                <button v-if="authStore.role !== 'technician'" class="btn-secondary btn-sm" @click="exportRepairPDF(r)" title="Download Receipt PDF">
                  <FileText :size="12" />
                </button>
                <button v-if="authStore.role !== 'technician'" class="btn-secondary btn-sm" style="color:#10b981;" @click="openPayment(r)" title="Log Payment Received">
                  <DollarSign :size="12" />
                </button>
                <button v-if="authStore.can('canDelete')" class="btn-danger btn-sm" @click="confirmDel(r)" title="Delete">
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
      :title="editingId ? 'Edit Repair Record' : 'New Repair Record'"
      :subtitle="editingId ? 'Update repair details' : 'Log a repair/maintenance job'"
      width="760px"
    >
      <form @submit.prevent="saveRepair" class="form-grid">
        <!-- Project Selection Toggle -->
        <div class="form-group form-full" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:rgba(99,102,241,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--ct-accent);">
                <FolderOpen :size="16" />
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">Link to Project</div>
                <div style="font-size:11px;color:var(--ct-muted);">Select an existing project to auto-fill client details</div>
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
              v-model="repairProjectSearch"
              class="input"
              placeholder="Search project name…"
              @focus="showRepairProjectDropdown = true"
              @blur="repairDelayCloseDropdown"
            />
            <div v-if="showRepairProjectDropdown && repairFilteredProjects.length" class="proj-dd" style="position:absolute;top:100%;left:0;right:0;border-radius:8px;z-index:200;max-height:200px;overflow-y:auto;margin-top:4px;">
              <div
                v-for="p in repairFilteredProjects"
                :key="p.id"
                @mousedown.prevent="selectRepairProject(p)"
                class="proj-dd-item" style="padding:10px 14px;cursor:pointer;font-size:13px;"
                :style="form.projectId === p.id ? 'background:rgba(99,102,241,0.15);' : ''"
              >
                <div>{{ p.projectName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.clientName }} · {{ p.city || p.address || '—' }}</div>
              </div>
            </div>
          </div>
          <div v-if="form.projectId" style="margin-top:8px;padding:10px 14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;font-size:12px;">
            <div style="color:var(--ct-green);font-weight:600;margin-bottom:3px;">✓ Project linked</div>
            <div style="color:var(--ct-sub);">{{ form.clientName }}<span v-if="form.siteAddress"> &nbsp;·&nbsp; 📍 {{ form.siteAddress }}</span></div>
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
          <!-- Lift selection -->
          <div v-if="form.projectId && selectedProject && selectedProject.buildings && selectedProject.buildings.length" class="form-group" style="margin-top:10px;">
            <label class="label">Select Buildings / Wings / Lifts</label>
            <LiftSelector v-model="form.liftSelection" :project="selectedProject" />
          </div>
        </div>

        <!-- Manual client name (toggle OFF) -->
        <div v-if="!useProject" class="form-group form-full">
          <label class="label">Client Name *</label>
          <input v-model="form.clientName" class="input" placeholder="Client / site name" />
        </div>
        <div class="form-group">
          <label class="label">Repair Type *</label>
          <select v-model="form.repairType" class="input" required>
            <option value="">— Select —</option>
            <option v-for="t in repairTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="label">Fault Description *</label>
          <textarea v-model="form.faultDescription" class="input" rows="2" required placeholder="Describe the fault…" style="resize:vertical;"></textarea>
        </div>
        <div class="form-group form-full">
          <label class="label">Assigned Technicians</label>
          <TechnicianSelect v-model="form.technicians" />
        </div>
        <div class="form-group">
          <label class="label">Repair Date *</label>
          <input v-model="form.repairDate" type="date" class="input" required />
        </div>
        <div class="form-group">
          <label class="label">Warranty</label>
          <select v-model="form.warranty" class="input">
            <option value="no">No Warranty</option>
            <option value="yes">Under Warranty</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Labor Cost (₹)</label>
          <input v-model.number="form.laborCost" type="number" min="0" step="0.01" class="input" placeholder="0.00" @input="recalcTotal" />
        </div>

        <!-- Parts Used -->
        <div class="form-group form-full">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label class="label" style="margin:0;">Parts Used</label>
            <button type="button" class="btn-secondary btn-sm" @click="addPartRow">
              <Plus :size="12" /> Add Part
            </button>
          </div>
          <div v-if="form.partsUsed.length" style="border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:rgba(255,255,255,0.04);">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--ct-muted);font-weight:500;">Part Name</th>
                  <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--ct-muted);font-weight:500;width:80px;">Qty</th>
                  <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--ct-muted);font-weight:500;width:110px;">Unit Cost (₹)</th>
                  <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--ct-muted);font-weight:500;width:100px;">Subtotal</th>
                  <th style="width:36px;"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(part, i) in form.partsUsed" :key="i" style="border-top:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:6px 8px;">
                    <input v-model="part.name" class="input" style="padding:6px 10px;font-size:13px;" placeholder="Part name" @input="recalcTotal" />
                  </td>
                  <td style="padding:6px 8px;">
                    <input v-model.number="part.qty" type="number" min="1" class="input" style="padding:6px 10px;font-size:13px;text-align:right;" @input="recalcTotal" />
                  </td>
                  <td style="padding:6px 8px;">
                    <input v-model.number="part.unitCost" type="number" min="0" step="0.01" class="input" style="padding:6px 10px;font-size:13px;text-align:right;" @input="recalcTotal" />
                  </td>
                  <td style="padding:6px 12px;text-align:right;font-size:13px;color:var(--ct-accent);white-space:nowrap;">
                    ₹{{ formatNum((part.qty || 0) * (part.unitCost || 0)) }}
                  </td>
                  <td style="padding:6px 8px;text-align:center;">
                    <button type="button" @click="removePartRow(i)" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px;" title="Remove">
                      <X :size="14" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else style="padding:16px;text-align:center;font-size:13px;color:var(--ct-muted);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;">
            No parts added. Click "Add Part" to include parts.
          </div>
        </div>

        <!-- Cost Summary -->
        <div class="form-group form-full">
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--ct-muted);margin-bottom:6px;">
              <span>Parts Total</span>
              <span style="color:var(--ct-sub);">₹{{ formatNum(partsTotal) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--ct-muted);margin-bottom:8px;">
              <span>Labor Cost</span>
              <span style="color:var(--ct-sub);">₹{{ formatNum(form.laborCost || 0) }}</span>
            </div>
            <div class="divider" style="margin:8px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:600;">
              <span style="color:var(--ct-primary);">Total Cost</span>
              <span style="color:var(--ct-accent);">₹{{ formatNum(form.totalCost || 0) }}</span>
            </div>
          </div>
        </div>

        <div class="form-group form-full">
          <label class="label">Notes</label>
          <textarea v-model="form.notes" class="input" rows="2" placeholder="Additional notes…" style="resize:vertical;"></textarea>
        </div>

        <!-- ── Work Completion Section ── shown when repaired/tested/closed -->
        <div v-if="['repaired','tested','closed'].includes(form.status)" class="form-group form-full">
          <div style="border:1px solid rgba(99,102,241,0.2);border-radius:14px;overflow:hidden;">
            <div style="padding:14px 18px;background:rgba(99,102,241,0.08);border-bottom:1px solid rgba(99,102,241,0.15);display:flex;align-items:center;gap:10px;">
              <span style="font-size:16px;">📋</span>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--ct-primary);">Work Completion Record</div>
                <div style="font-size:11px;color:var(--ct-muted);">Capture signatures and customer feedback</div>
              </div>
            </div>
            <div style="padding:18px;display:flex;flex-direction:column;gap:20px;">

              <!-- Time fields -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div class="form-group" style="margin:0;">
                  <label class="label">Arrival Time</label>
                  <input v-model="form.arrivalTime" type="time" class="input" />
                </div>
                <div class="form-group" style="margin:0;">
                  <label class="label">Completion Time</label>
                  <input v-model="form.completionTime" type="time" class="input" />
                </div>
              </div>

              <!-- Signatures -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
                <SignatureCanvas
                  v-model="form.arrivalSignature"
                  label="Representative Signature (Arrival)"
                  border-color="#6366f1"
                />
                <SignatureCanvas
                  v-model="form.completionSignature"
                  label="Representative Signature (Completion)"
                  border-color="#22c55e"
                />
              </div>

              <!-- Customer Rating -->
              <div style="padding:14px 16px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;">
                <div style="font-size:12px;font-weight:600;color:var(--ct-sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Customer Satisfaction</div>
                <StarRating v-model="form.customerRating" />
                <textarea
                  v-model="form.customerFeedback"
                  class="input"
                  rows="2"
                  placeholder="Customer feedback or remarks (optional)…"
                  style="margin-top:12px;resize:vertical;"
                ></textarea>
              </div>

              <!-- Site Photos -->
              <div style="padding:14px 16px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);border-radius:10px;">
                <div style="font-size:12px;font-weight:600;color:var(--ct-sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Site Photos</div>
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
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" type="button" @click="showModal = false">Cancel</button>
        <button class="btn-primary" type="button" :disabled="saving" @click="saveRepair">
          <Loader2 v-if="saving" :size="14" style="animation:spin 1s linear infinite;" />
          <Save v-else :size="14" />
          {{ editingId ? 'Update' : 'Save Repair' }}
        </button>
      </template>
    </AppModal>

    <!-- Completion Modal -->
    <AppModal v-model="showCompleteModal" title="Mark as Completed" subtitle="Capture completion signature" width="600px">
      <div style="display:flex;flex-direction:column;gap:16px;" v-if="completeTarget">
        <div style="padding:12px 14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;font-size:13px;color:#4ade80;">
          Marking repair for <strong>{{ completeTarget.clientName || projectName(completeTarget.projectId) }}</strong> as <strong>Completed</strong>
        </div>
        <div class="form-grid">
          <div class="form-group form-full">
            <label class="label">Completion Note</label>
            <textarea v-model="completeForm.resolutionNote" class="input" rows="2" placeholder="Work done, parts replaced, observations…" style="resize:vertical;"></textarea>
          </div>
          <div class="form-group">
            <label class="label">Signatory Name</label>
            <input v-model="completeForm.signatoryName" class="input" placeholder="Customer / representative" />
          </div>
          <div class="form-group">
            <label class="label">Designation</label>
            <input v-model="completeForm.signatoryDesignation" class="input" placeholder="e.g. Facility Manager" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
          <SignatureCanvas v-model="completeForm.arrivalSignature" label="Arrival Signature" border-color="#6366f1" />
          <SignatureCanvas v-model="completeForm.signature" label="Customer Acknowledgement Signature" border-color="#22c55e" />
        </div>
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

    <!-- View Repair Detail -->
    <AppModal v-model="showViewModal" title="Repair Details" subtitle="Read-only view" width="720px">
      <div v-if="viewTarget" style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.18);border-radius:14px;">
          <div>
            <div v-if="viewTarget.projectId" style="font-size:12px;color:var(--ct-accent);font-weight:600;margin-bottom:2px;">{{ projectName(viewTarget.projectId) }}</div>
            <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.clientName || '—' }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:3px;">{{ viewTarget.siteAddress || '' }}</div>
          </div>
          <span :class="['badge', statusBadge(viewTarget.status)]">{{ formatStatus(viewTarget.status) }}</span>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <div class="label">Repair Type</div>
            <div style="margin-top:4px;"><span class="badge badge-info">{{ viewTarget.repairType || '—' }}</span></div>
          </div>
          <div class="form-group">
            <div class="label">Date</div>
            <div style="color:var(--ct-primary);font-size:14px;margin-top:4px;">{{ formatDate(viewTarget.repairDate) }}</div>
          </div>
          <div class="form-group form-full">
            <div class="label">Fault Description</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;line-height:1.6;">{{ viewTarget.faultDescription || '—' }}</div>
          </div>
          <div class="form-group form-full">
            <div class="label">Technicians</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;">{{ (viewTarget.technicians || [viewTarget.technician]).filter(Boolean).join(', ') || '—' }}</div>
          </div>
          <div class="form-group" v-if="viewTarget.laborCost">
            <div class="label">Labour Cost</div>
            <div style="color:var(--ct-accent);font-weight:600;font-size:14px;margin-top:4px;">{{ formatCurrency(viewTarget.laborCost) }}</div>
          </div>
          <div class="form-group" v-if="viewTarget.totalCost">
            <div class="label">Total Cost</div>
            <div style="color:var(--ct-accent);font-weight:700;font-size:16px;margin-top:4px;">{{ formatCurrency(viewTarget.totalCost) }}</div>
          </div>
          <div class="form-group form-full" v-if="viewTarget.notes">
            <div class="label">Notes</div>
            <div style="color:var(--ct-sub);font-size:13px;margin-top:4px;line-height:1.6;">{{ viewTarget.notes }}</div>
          </div>
          <div class="form-group form-full" v-if="viewTarget.partsUsed?.length">
            <div class="label" style="margin-bottom:6px;">Parts Used</div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <div v-for="(p,i) in viewTarget.partsUsed" :key="i" style="display:flex;justify-content:space-between;font-size:12px;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
                <span style="color:var(--ct-primary);">{{ p.name }}</span>
                <span style="color:var(--ct-muted);">qty: {{ p.qty }} × {{ formatCurrency(p.unitCost) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="(viewTarget.completionPhotos || []).length" style="margin-top:4px;">
          <div class="label" style="margin-bottom:8px;">Site Photos</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            <img v-for="(ph,i) in viewTarget.completionPhotos" :key="i" :src="ph" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.1);" />
          </div>
        </div>
        <div v-if="viewTarget.completionSignature" style="margin-top:4px;">
          <div class="label" style="margin-bottom:6px;">Customer Signature</div>
          <img :src="viewTarget.completionSignature" style="max-height:80px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <button v-if="authStore.role !== 'technician'" class="btn-primary" @click="openEdit(viewTarget); showViewModal = false">
          <Pencil :size="14" /> Edit
        </button>
        <button v-else-if="viewTarget.status !== 'completed'" class="btn-primary" @click="openComplete(viewTarget); showViewModal = false">
          <CheckCircle :size="14" /> Complete
        </button>
      </template>
    </AppModal>

    <!-- Confirm Delete -->
    <ConfirmDialog
      v-model="showConfirm"
      title="Delete Repair Record"
      :message="`Delete repair record for '${deleteTarget?.clientName || projectName(deleteTarget?.projectId)}'? This cannot be undone.`"
      confirmLabel="Delete"
      :danger="true"
      @confirm="deleteRepair"
    />

    <!-- Activity Timeline -->
    <ActivityTimeline
      v-model="showTimeline"
      :record-id="timelineRecord?.id || ''"
      :collection="Collections.REPAIRS"
      :title="`Repair — ${timelineRecord?.repairType || ''}`"
      :record-summary="`${timelineRecord?.clientName || projectName(timelineRecord?.projectId)} · ${formatStatus(timelineRecord?.status)}`"
    />

    <!-- Import Modal -->
    <AppModal v-model="showImportModal" title="Import Repairs from Excel" width="640px">
      <div style="margin-bottom:16px;">
        <div class="glass" style="padding:16px;border-radius:12px;margin-bottom:16px;">
          <p style="font-size:12px;color:var(--ct-muted);margin:0 0 10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Expected Columns (in order)</p>
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <thead><tr style="color:var(--ct-muted);"><th style="text-align:left;padding:4px 8px;">Column</th><th style="text-align:left;padding:4px 8px;">Example</th><th style="text-align:left;padding:4px 8px;">Required</th></tr></thead>
            <tbody>
              <tr v-for="col in importColumns" :key="col.key" style="border-top:1px solid rgba(255,255,255,0.04);">
                <td style="padding:5px 8px;color:var(--ct-accent);font-family:monospace;">{{ col.key }}</td>
                <td style="padding:5px 8px;color:var(--ct-sub);">{{ col.example }}</td>
                <td style="padding:5px 8px;"><span :class="col.required ? 'badge badge-danger' : 'badge badge-inactive'" style="font-size:10px;">{{ col.required ? 'Required' : 'Optional' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="margin-bottom:12px;">
          <label class="label">Select Excel / CSV File</label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px 16px;border:2px dashed rgba(99,102,241,0.3);border-radius:12px;cursor:pointer;background:rgba(99,102,241,0.04);">
            <Upload :size="20" style="color:#6366f1;flex-shrink:0;" />
            <span style="color:var(--ct-muted);font-size:13px;">{{ importFile ? importFile.name : 'Click to choose .xlsx, .xls or .csv' }}</span>
            <input type="file" accept=".xlsx,.xls,.csv" @change="onImportFile" style="display:none;" />
          </label>
        </div>
        <div v-if="importError" style="color:#f87171;font-size:12px;padding:10px 14px;background:rgba(239,68,68,0.08);border-radius:10px;border:1px solid rgba(239,68,68,0.18);margin-bottom:10px;">{{ importError }}</div>
        <div v-if="importPreview.length" class="glass" style="padding:12px;border-radius:12px;">
          <p style="font-size:12px;color:var(--ct-green);margin:0 0 8px;">✓ {{ importPreview.length }} record(s) ready to import</p>
          <p v-if="importSkipped" style="font-size:11px;color:#fbbf24;margin:0 0 6px;">⚠ {{ importSkipped }} row(s) skipped (missing required fields)</p>
          <div style="max-height:120px;overflow-y:auto;font-size:11px;color:var(--ct-muted);">
            <div v-for="(r, i) in importPreview.slice(0,5)" :key="i" style="padding:2px 0;">{{ r.clientName }} — {{ r.repairType }} ({{ r.faultDescription.slice(0, 40) }})</div>
            <div v-if="importPreview.length > 5" style="color:var(--ct-muted);">…and {{ importPreview.length - 5 }} more</div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="closeImport">Cancel</button>
        <button class="btn-primary" :disabled="!importPreview.length || importing" @click="doImport">
          <Upload :size="14" /> {{ importing ? 'Importing…' : `Import ${importPreview.length} Records` }}
        </button>
      </template>
    </AppModal>

  <!-- Log Payment Modal -->
  <AppModal v-model="payModal" title="Log Payment Received" subtitle="Record a payment against this repair" width="480px">
    <div v-if="payTarget" style="display:flex;flex-direction:column;gap:16px;">
      <div style="padding:10px 14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);border-radius:10px;font-size:13px;color:#4ade80;">
        Logging payment for <strong>{{ payTarget.clientName || payTarget.id }}</strong>
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
  Hammer, Plus, Search, Pencil, Trash2, X,
  FileDown, Save, Loader2, Upload, FolderOpen, FileText, History, CheckCircle, DollarSign
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ExportDialog from '@/components/ui/ExportDialog.vue'
import { useExport } from '@/composables/useExport'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SignatureCanvas from '@/components/ui/SignatureCanvas.vue'
import StarRating from '@/components/ui/StarRating.vue'
import TechnicianSelect from '@/components/ui/TechnicianSelect.vue'
import LiftSelector from '@/components/ui/LiftSelector.vue'
import ActivityTimeline from '@/components/ui/ActivityTimeline.vue'
import { logTimeline } from '@/utils/timeline'
import { getAll, create, update, remove } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { savePDF } from '@/utils/saveFile'
import { usePDF } from '@/composables/usePDF'
import { useAuthStore } from '@/stores/auth'
import * as XLSX from 'xlsx'

const ui = useUIStore()
const activity = useActivityStore()
const { exportTablePDF, _drawHeader, _drawFooter, _sectionLabel, _infoGrid, _toRs, _C, _MARGIN, _PAGE_W, _getCtx, _drawReceiptHeader, _drawReceiptFooter, _drawBlackSig, _RECEIPT } = usePDF()
const { showExportDialog, dialogVisible: expDlgVisible, selectedPeriod: expPeriod, exportType: expType, exporting: expRunning, runExport, cancelExport } = useExport()
const authStore = useAuthStore()

// ── Data ─────────────────────────────────────────────────────────────────────
const repairs = ref([])
const projects = ref([])
const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(r) { viewTarget.value = r; showViewModal.value = true }
const technicians = ref([])
const loading = ref(false)
const saving = ref(false)

watch([() => ui.pendingAutoOpen, repairs], () => {
  const pending = ui.pendingAutoOpen
  if (!pending || pending.collection !== Collections.REPAIRS) return
  const record = repairs.value.find(r => r.id === pending.recordId)
  if (record) { openView(record); ui.clearPendingAutoOpen() }
})

// Payment tracking
const payModal = ref(false)
const payTarget = ref(null)
const payForm = ref({ amount: 0, date: new Date().toISOString().slice(0,10), method: 'cash', reference: '', note: '' })

// ── Filters ───────────────────────────────────────────────────────────────────
const search = ref('')
const filterRepairType = ref('')
const filterStatus = ref('')

const repairTypes = ['Mechanical', 'Electrical', 'Hydraulic', 'Control System', 'Door', 'Safety']

const statusOptions = [
  { value: 'reported', label: 'Reported' },
  { value: 'diagnosed', label: 'Diagnosed' },
  { value: 'repaired', label: 'Repaired' },
  { value: 'tested', label: 'Tested' },
  { value: 'closed', label: 'Closed' },
]

// ── Project Selection ─────────────────────────────────────────────────────────
const useProject = ref(true)
const repairProjectSearch = ref('')
const showRepairProjectDropdown = ref(false)

const repairFilteredProjects = computed(() => {
  const q = repairProjectSearch.value.toLowerCase()
  return projects.value.filter(p => (p.projectName || '').toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q))
})

function selectRepairProject(p) {
  form.value.projectId = p.id
  form.value.clientName = p.clientName || ''
  form.value.siteAddress = (p.address ? p.address + (p.city ? ', ' + p.city : '') : p.city || '')
  form.value.selectedClients = []
  repairProjectSearch.value = p.projectName
  showRepairProjectDropdown.value = false
}

function repairDelayCloseDropdown() {
  setTimeout(() => { showRepairProjectDropdown.value = false }, 200)
}

// ── Modal / Form ──────────────────────────────────────────────────────────────
const showModal = ref(false)
const showConfirm = ref(false)
const showCompleteModal = ref(false)
const completeTarget = ref(null)
const completeForm = ref({ resolutionNote: '', signatoryName: '', signatoryDesignation: '', arrivalSignature: '', signature: '', photos: [] })

function openComplete(r) {
  completeTarget.value = r
  completeForm.value = { resolutionNote: '', signatoryName: '', signatoryDesignation: '', arrivalSignature: '', signature: '', photos: [] }
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
    await update(Collections.REPAIRS, completeTarget.value.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completionNote: completeForm.value.resolutionNote,
      arrivalSignature: completeForm.value.arrivalSignature,
      completionSignature: completeForm.value.signature,
      signatoryName: completeForm.value.signatoryName,
      signatoryDesignation: completeForm.value.signatoryDesignation,
      completionPhotos: [...(completeTarget.value.completionPhotos || []), ...completeForm.value.photos],
    })
    await logTimeline(Collections.REPAIRS, completeTarget.value.id, 'status_change', `Marked as Completed by ${authStore.user?.fullName || 'User'}`)
    ui.success('Repair marked as completed')
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

const defaultForm = () => ({
  clientName: '',
  siteAddress: '',
  selectedClients: [],
  projectId: '',
  liftSelection: { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] },
  repairType: '',
  faultDescription: '',
  technicians: [],
  repairDate: '',
  partsUsed: [],
  laborCost: 0,
  totalCost: 0,
  status: 'reported',
  warranty: 'no',
  notes: '',
  arrivalTime: '',
  completionTime: '',
  arrivalSignature: '',
  completionSignature: '',
  customerRating: 0,
  customerFeedback: '',
  completionPhotos: [],
})
const form = ref(defaultForm())

const selectedProject = computed(() => projects.value.find(p => p.id === form.value.projectId) || null)

// ── Computed ──────────────────────────────────────────────────────────────────
const filteredRepairs = computed(() => {
  const q = search.value.toLowerCase()
  return repairs.value.filter(r => {
    const matchSearch = !q ||
      (r.clientName || '').toLowerCase().includes(q) ||
      projectName(r.projectId).toLowerCase().includes(q) ||
      (r.technician || '').toLowerCase().includes(q)
    const matchType = !filterRepairType.value || r.repairType === filterRepairType.value
    const matchStatus = !filterStatus.value || r.status === filterStatus.value
    return matchSearch && matchType && matchStatus
  })
})

const partsTotal = computed(() =>
  form.value.partsUsed.reduce((sum, p) => sum + ((p.qty || 0) * (p.unitCost || 0)), 0)
)

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
  const map = { reported: 'Reported', diagnosed: 'Diagnosed', repaired: 'Repaired', tested: 'Tested', closed: 'Closed' }
  return map[s] || s
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

function statusBadge(s) {
  return {
    reported: 'badge-warning',
    diagnosed: 'badge-info',
    repaired: 'badge-active',
    tested: 'badge-active',
    closed: 'badge-inactive',
  }[s] || ''
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCurrency(n) {
  if (!n && n !== 0) return '—'
  return '₹' + formatNum(n)
}

function recalcTotal() {
  const parts = form.value.partsUsed.reduce((sum, p) => sum + ((p.qty || 0) * (p.unitCost || 0)), 0)
  form.value.totalCost = parts + (form.value.laborCost || 0)
}

function addPartRow() {
  form.value.partsUsed.push({ name: '', qty: 1, unitCost: 0 })
}

function removePartRow(i) {
  form.value.partsUsed.splice(i, 1)
  recalcTotal()
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const [r, p, e] = await Promise.all([
      getAll(Collections.REPAIRS),
      getAll(Collections.PROJECTS),
      getAll(Collections.EMPLOYEES),
    ])
    repairs.value = r.filter(item => !item.recordId && !item.type).sort((x, y) => {
      const dx = x.createdAt?.toDate?.() || new Date(x.createdAt || 0)
      const dy = y.createdAt?.toDate?.() || new Date(y.createdAt || 0)
      return dy - dx
    })
    projects.value = p
    technicians.value = e.filter(emp => emp.role === 'technician' || emp.department === 'Technical')
  } catch {
    ui.error('Failed to load repair records')
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingId.value = null
  form.value = defaultForm()
  useProject.value = true
  repairProjectSearch.value = ''
  if (authStore.role === 'technician') {
    const myName = authStore.user?.fullName || authStore.user?.username || ''
    form.value.technicians = myName ? [myName] : []
  }
  showModal.value = true
}

function openEdit(r) {
  editingId.value = r.id
  editingStatus = r.status || 'reported'
  useProject.value = !!r.projectId
  if (r.projectId) {
    const proj = projects.value.find(p => p.id === r.projectId)
    repairProjectSearch.value = proj?.projectName || ''
  } else {
    repairProjectSearch.value = ''
  }
  const linkedProj = r.projectId ? projects.value.find(p => p.id === r.projectId) : null
  form.value = {
    clientName: r.clientName || '',
    siteAddress: linkedProj ? (linkedProj.address ? linkedProj.address + (linkedProj.city ? ', ' + linkedProj.city : '') : linkedProj.city || '') : '',
    projectId: r.projectId || '',
    selectedClients: Array.isArray(r.selectedClients) ? [...r.selectedClients] : [],
    liftSelection: r.liftSelection ? { ...r.liftSelection } : { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] },
    repairType: r.repairType || '',
    faultDescription: r.faultDescription || '',
    technician: r.technician || '',
    technicians: Array.isArray(r.technicians) ? [...r.technicians] : [],
    repairDate: r.repairDate || '',
    partsUsed: (r.partsUsed || []).map(p => ({ ...p })),
    laborCost: r.laborCost || 0,
    totalCost: r.totalCost || 0,
    status: r.status || 'reported',
    warranty: r.warranty || 'no',
    notes: r.notes || '',
    arrivalTime: r.arrivalTime || '',
    completionTime: r.completionTime || '',
    arrivalSignature: r.arrivalSignature || '',
    completionSignature: r.completionSignature || '',
    customerRating: r.customerRating || 0,
    customerFeedback: r.customerFeedback || '',
  }
  showModal.value = true
}

async function saveRepair() {
  if (!form.value.repairType || !form.value.faultDescription || !form.value.repairDate) {
    ui.warning('Please fill all required fields')
    return
  }
  recalcTotal()
  saving.value = true
  try {
    if (editingId.value) {
      await update(Collections.REPAIRS, editingId.value, { ...form.value })
      activity.log({ action: 'updated', module: 'repairs', tab: 'Repairs', summary: `Updated repair record for ${form.value.clientName || '—'}`, details: { clientName: form.value.clientName, repairType: form.value.repairType, status: form.value.status, repairDate: form.value.repairDate } })
      ui.success('Repair record updated')
      if (editingStatus && editingStatus !== form.value.status) {
        await logTimeline(Collections.REPAIRS, editingId.value, 'status_change',
          `Status changed: ${formatStatus(editingStatus)} → ${formatStatus(form.value.status)}`)
      } else {
        await logTimeline(Collections.REPAIRS, editingId.value, 'updated', 'Repair record updated')
      }
    } else {
      const newId = await create(Collections.REPAIRS, { ...form.value })
      activity.log({ action: 'created', module: 'repairs', tab: 'Repairs', summary: `Created repair record for ${form.value.clientName || '—'}`, details: { clientName: form.value.clientName, repairType: form.value.repairType, faultDescription: form.value.faultDescription, repairDate: form.value.repairDate } })
      ui.success('Repair record saved')
      await logTimeline(Collections.REPAIRS, newId, 'created',
        `Repair created — ${form.value.repairType} for ${form.value.clientName || '—'}`)
    }
    showModal.value = false
    await loadData()
  } catch {
    ui.error('Failed to save repair record')
  } finally {
    saving.value = false
  }
}

function confirmDel(r) {
  deleteTarget.value = r
  showConfirm.value = true
}

async function deleteRepair() {
  if (!deleteTarget.value) return
  try {
    await remove(Collections.REPAIRS, deleteTarget.value.id)
    activity.log({ action: 'deleted', module: 'repairs', tab: 'Repairs', summary: `Deleted repair record for ${deleteTarget.value.clientName || deleteTarget.value.id}`, details: { clientName: deleteTarget.value.clientName, repairType: deleteTarget.value.repairType } })
    ui.success('Repair record deleted')
    await loadData()
  } catch {
    ui.error('Failed to delete repair record')
  }
}

// ── Payment Tracking ──────────────────────────────────────────────────────────
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
    await update(Collections.REPAIRS, payTarget.value.id, {
      paymentHistory: updatedHistory,
      paidAmount: newPaid,
    })
    ui.success(`Payment of Rs. ${Number(payForm.value.amount).toLocaleString('en-IN')} logged.`)
    payModal.value = false
    await loadData()
  } catch { ui.error('Failed to log payment') }
  finally { saving.value = false }
}

// ── Per-record Receipt PDF ─────────────────────────────────────────────────────
async function exportRepairPDF(r) {
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const { company, userName } = await _getCtx()
    const M = _MARGIN
    const W = _PAGE_W
    const clientLabel = r.clientName || projectName(r.projectId) || '—'

    let y = await _drawReceiptHeader(doc, 'Repair Service Receipt', `Job ID: ${r.id?.slice(0, 10) || '—'} · ${formatStatus(r.status)}`)

    // ── Client / Technician Info ─────────────────────────────────────────────
    y = _sectionLabel(doc, 'Job Details', y, _C.indigo)
    y = _infoGrid(doc, [
      ['Client / Site', clientLabel],
      ['Technician', r.technician || '—'],
      ['Site Address', r.siteAddress || '—'],
      ['Repair Date', formatDate(r.repairDate)],
      ['Arrival Time', r.arrivalTime || '—'],
      ['Completion Time', r.completionTime || '—'],
      ['Repair Type', r.repairType || '—'],
      ['Warranty', r.warranty === 'yes' ? 'Under Warranty' : 'No Warranty'],
    ], y)

    // ── Fault Description ───────────────────────────────────────────────────
    y = _sectionLabel(doc, 'Fault Description', y, _C.greyText)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(..._C.black)
    const faultLines = doc.splitTextToSize(r.faultDescription || '—', W - M * 2)
    doc.text(faultLines, M, y)
    y += faultLines.length * 5 + 6

    if (r.notes) {
      doc.setFontSize(8)
      doc.setTextColor(..._C.midGrey)
      const noteLines = doc.splitTextToSize('Notes: ' + r.notes, W - M * 2)
      doc.text(noteLines, M, y)
      y += noteLines.length * 5 + 6
    }

    // ── Completion Notes (from completion form) ──────────────────────────────
    if (r.completionNote) {
      if (y > _RECEIPT.CONTENT_MAX_Y) { doc.addPage(); y = _RECEIPT.PAGE_NEW_START }
      y = _sectionLabel(doc, 'Completion Notes', y, _C.greyText)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(..._C.black)
      const cnLines = doc.splitTextToSize(r.completionNote, W - M * 2)
      doc.text(cnLines, M, y)
      y += cnLines.length * 5 + 6
    }

    // ── Parts Used ──────────────────────────────────────────────────────────
    if (r.partsUsed?.length) {
      y = _sectionLabel(doc, 'Parts Used', y, _C.greyText)
      doc.autoTable({
        startY: y,
        head: [['Part Name', 'Qty', 'Unit Cost', 'Subtotal']],
        body: r.partsUsed.map(p => [
          p.name || '—',
          p.qty || 0,
          _toRs(p.unitCost || 0),
          _toRs((p.qty || 0) * (p.unitCost || 0)),
        ]),
        styles: { fontSize: 8.5, cellPadding: 3.5, textColor: _C.black },
        headStyles: { fillColor: _C.indigo, textColor: _C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: _C.lightGrey },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: M, right: M },
      })
      y = doc.lastAutoTable.finalY + 4
    }

    // ── Cost Summary ─────────────────────────────────────────────────────────
    const partsTotal = r.partsUsed?.reduce((s, p) => s + (p.qty || 0) * (p.unitCost || 0), 0) || 0
    y = _sectionLabel(doc, 'Cost Summary', y, _C.indigo)
    doc.autoTable({
      startY: y,
      body: [
        ['Parts Total', _toRs(partsTotal)],
        ['Labour Cost', _toRs(r.laborCost || 0)],
        ['TOTAL AMOUNT', _toRs(r.totalCost || 0)],
      ],
      styles: { fontSize: 9, cellPadding: 4, textColor: _C.black },
      alternateRowStyles: { fillColor: _C.lightGrey },
      columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell(data) {
        if (data.row.raw?.[0] === 'TOTAL AMOUNT') {
          data.cell.styles.fillColor = _C.indigo
          data.cell.styles.textColor = _C.white
          data.cell.styles.fontSize = 10
        }
      },
      margin: { left: M, right: M },
    })
    y = doc.lastAutoTable.finalY + 6

    // ── Customer Satisfaction ────────────────────────────────────────────────
    if (r.customerRating) {
      if (y > _RECEIPT.CONTENT_MAX_Y) { doc.addPage(); y = _RECEIPT.PAGE_NEW_START }
      y = _sectionLabel(doc, 'Customer Satisfaction', y, _C.greyText)
      const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(..._C.black)
      doc.text(`Rating: ${r.customerRating} / 5  (${ratingLabels[r.customerRating] || ''})`, M, y)
      y += 7
      if (r.customerFeedback) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(..._C.midGrey)
        const fbLines = doc.splitTextToSize(`"${r.customerFeedback}"`, W - M * 2)
        doc.text(fbLines, M, y)
        y += fbLines.length * 5 + 6
      }
    }

    // ── Signatures ───────────────────────────────────────────────────────────
    if (r.arrivalSignature || r.completionSignature) {
      if (y > _RECEIPT.CONTENT_MAX_Y - 44) { doc.addPage(); y = _RECEIPT.PAGE_NEW_START }
      y = _sectionLabel(doc, 'Signatures', y, _C.greyText)
      y += 2
      const sigW = (W - M * 2 - 6) / 2
      _drawBlackSig(doc, M, y, sigW, 40, 'ARRIVAL SIGNATURE', r.arrivalSignature, r.technician || '—', 'Technician')
      _drawBlackSig(doc, M + sigW + 6, y, sigW, 40, 'COMPLETION SIGNATURE', r.completionSignature, r.completedBy || '—', '')
      y += 44
    }

    await _drawReceiptFooter(doc)
    await savePDF(doc, `Repair-Receipt-${(r.clientName || r.id || 'record').replace(/\s+/g, '_')}.pdf`, ui)
    ui.success('Receipt PDF downloaded')
  } catch (e) {
    console.error(e)
    ui.error('Failed to generate PDF')
  }
}

// ── Bulk Export ───────────────────────────────────────────────────────────────
function triggerExport(type) {
  showExportDialog({
    rows: repairs.value,
    dateField: 'repairDate',
    columns: ['Client / Project', 'Repair Type', 'Technician', 'Date', 'Status', 'Total Cost'],
    title: 'Repair Records Report',
    filename: 'repair-records',
    accent: [239, 68, 68],
    ui,
    pdfRowMapper: r => [
      r.clientName || projectName(r.projectId),
      r.repairType || '—',
      (r.technicians || [r.technician]).filter(Boolean).join(', ') || '—',
      formatDate(r.repairDate),
      formatStatus(r.status),
      formatCurrency(r.totalCost),
    ],
    excelRowMapper: r => [
      r.clientName || projectName(r.projectId),
      r.repairType || '—',
      (r.technicians || [r.technician]).filter(Boolean).join(', ') || '—',
      formatDate(r.repairDate),
      formatStatus(r.status),
      r.totalCost || 0,
    ],
  })
  if (type) expType.value = type
}

// ── Excel Import ──────────────────────────────────────────────────────────────
const showImportModal = ref(false)
const importFile = ref(null)
const importPreview = ref([])
const importError = ref('')
const importSkipped = ref(0)
const importing = ref(false)

const importColumns = [
  { key: 'clientName', example: 'ABC Towers', required: true },
  { key: 'repairType', example: 'Mechanical', required: true },
  { key: 'faultDescription', example: 'Motor overheating', required: true },
  { key: 'technician', example: 'Ravi Kumar', required: true },
  { key: 'repairDate', example: '2024-03-15', required: false },
  { key: 'laborCost', example: '2500', required: false },
  { key: 'status', example: 'reported', required: false },
  { key: 'warranty', example: 'no', required: false },
  { key: 'notes', example: 'Follow-up needed', required: false },
]

function onImportFile(e) {
  importError.value = ''
  importPreview.value = []
  importSkipped.value = 0
  const file = e.target.files[0]
  if (!file) return
  importFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const valid = []
      let skipped = 0
      rows.forEach(row => {
        const clientName = String(row.clientName || row['Client Name'] || '').trim()
        const repairType = String(row.repairType || row['Repair Type'] || row['repair_type'] || '').trim()
        const faultDescription = String(row.faultDescription || row['Fault Description'] || row['fault_description'] || '').trim()
        const technician = String(row.technician || row['Technician'] || '').trim()
        if (!clientName || !repairType || !faultDescription || !technician) { skipped++; return }
        valid.push({
          clientName, repairType, faultDescription, technician,
          repairDate: String(row.repairDate || row['Repair Date'] || new Date().toISOString().split('T')[0]).trim(),
          laborCost: Number(row.laborCost || row['Labor Cost'] || 0),
          status: String(row.status || 'reported').trim(),
          warranty: String(row.warranty || 'no').trim(),
          notes: String(row.notes || row['Notes'] || '').trim(),
          partsUsed: [],
          totalCost: Number(row.laborCost || 0),
        })
      })
      importPreview.value = valid
      importSkipped.value = skipped
      if (!valid.length) importError.value = 'No valid rows found. Check column names match expected format.'
    } catch (err) {
      importError.value = 'Failed to parse file: ' + err.message
    }
  }
  reader.readAsArrayBuffer(file)
  e.target.value = ''
}

async function doImport() {
  importing.value = true
  let success = 0
  for (const row of importPreview.value) {
    try {
      await create(Collections.REPAIRS, { ...row, createdAt: new Date() })
      success++
    } catch {}
  }
  ui.success(`Imported ${success} repair record(s).`)
  closeImport()
  await loadData()
  importing.value = false
}

function closeImport() {
  showImportModal.value = false
  importFile.value = null
  importPreview.value = []
  importError.value = ''
  importSkipped.value = 0
}

onMounted(loadData)

watch(() => ui.scheduleContext, (ctx) => {
  if (!ctx || ctx.tab !== 'repairs') return
  editingId.value = null
  form.value = defaultForm()
  form.value.projectId = ctx.projectId || ''
  form.value.clientName = ctx.clientName || ''
  form.value.siteAddress = ctx.clientAddress || ''
  form.value.selectedClients = []
  useProject.value = true
  repairProjectSearch.value = ctx.projectName || ''
  showModal.value = true
  ui.clearScheduleContext()
}, { immediate: true })
</script>

<style scoped>
.repairs-view { padding: 0; }
.page-sub { font-size: 13px; color:var(--ct-muted); margin-top: 4px; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.proj-dd { background: var(--ct-card, #1e293b); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
[data-theme="light"] .proj-dd { background: #ffffff; border-color: #e2e8f0; }
.proj-dd-item { color: var(--ct-primary); border-bottom: 1px solid rgba(255,255,255,0.05); }
[data-theme="light"] .proj-dd-item { border-bottom-color: #f1f5f9; }
</style>
