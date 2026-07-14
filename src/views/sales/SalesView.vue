<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <TrendingUp :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Sales &amp; CRM
        </h1>
        <p class="page-sub">Leads tracked, deals won, pipeline always visible.</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <!-- Per-user export report title -->
        <div style="display:flex;align-items:center;gap:6px;">
          <input
            v-model="exportReportTitle"
            class="input"
            placeholder="Report title for exports…"
            style="width:220px;font-size:12px;padding:6px 10px;"
            @change="saveExportReportTitle"
          />
          <button class="btn-secondary" style="padding:6px 10px;font-size:12px;" @click="saveExportReportTitle" title="Save report title">
            <Save :size="13" />
          </button>
        </div>
        <button class="btn-secondary" @click="$router.push('/projects')">
          <FolderOpen :size="15" /> Projects
        </button>
        <button class="btn-secondary" @click="triggerLeadsExport('excel')">
          <FileSpreadsheet :size="15" /> Excel
        </button>
        <button class="btn-secondary" @click="triggerLeadsExport('pdf')">
          <FileText :size="15" /> PDF
        </button>
        <button class="btn-primary" @click="openAdd">
          <Plus :size="16" /> Add Lead
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-nav" style="margin-bottom:24px;">
      <button :class="['tab-btn', activeTab === 'pipeline' && 'active']" @click="activeTab = 'pipeline'">
        <Kanban :size="14" style="display:inline;margin-right:4px;" /> Pipeline
      </button>
      <button :class="['tab-btn', activeTab === 'list' && 'active']" @click="activeTab = 'list'">
        <List :size="14" style="display:inline;margin-right:4px;" /> All Leads
      </button>
    </div>

    <!-- PIPELINE VIEW -->
    <template v-if="activeTab === 'pipeline'">
      <div class="pipeline-grid">
        <div v-for="stage in stages" :key="stage.key" class="pipeline-col">
          <div class="pipeline-col-header">
            <span :class="['badge', stage.badge]">{{ stage.label }}</span>
            <span style="font-size:12px;color:var(--ct-muted);margin-left:auto;">{{ getLeadsByStage(stage.key).length }}</span>
          </div>
          <div class="pipeline-col-body">
            <div
              v-for="lead in getLeadsByStage(stage.key)"
              :key="lead.id"
              class="lead-card"
              @click="openLeadView(lead)"
            >
              <div class="lead-name">{{ lead.clientName || '—' }}</div>
              <div class="lead-sub">{{ lead.contactPerson || lead.phone || '—' }}</div>
              <div v-if="lead.multiRequirements && lead.requirements && lead.requirements.length" style="font-size:11px;color:var(--ct-muted);margin-bottom:4px;">
                {{ lead.requirements.length }} req · {{ lead.requirements.map(r => r.elevatorType || '—').join(', ') }}
              </div>
              <div v-else-if="lead.elevatorType" style="font-size:11px;color:var(--ct-muted);margin-bottom:4px;">{{ lead.elevatorType }}</div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:13px;font-weight:600;color:var(--ct-accent);">{{ formatCurrency(lead.value) }}</span>
                <span :class="['badge', priorityBadge(lead.priority)]" style="font-size:10px;">{{ lead.priority || 'medium' }}</span>
              </div>
              <div v-if="lead.nextFollowUp" style="font-size:11px;color:var(--ct-muted);margin-top:6px;">
                Follow-up: {{ formatDate(lead.nextFollowUp) }}
              </div>
              <div style="display:flex;align-items:center;gap:4px;margin-top:8px;border-top:1px solid rgba(255,255,255,0.05);padding-top:6px;" @click.stop>
                <button class="btn-secondary btn-sm" @click="openTimeline(lead, $event)" style="padding:3px 7px;font-size:11px;gap:3px;" title="Activity Timeline">
                  <History :size="11" /> Activity
                </button>
                <button class="btn-secondary btn-sm" @click="exportLeadPdf(lead, $event)" style="padding:3px 7px;font-size:11px;gap:3px;" title="Export Lead PDF">
                  <FileDown :size="11" /> PDF
                </button>
                <button class="btn-secondary btn-sm" @click="openEdit(lead)" style="padding:3px 7px;font-size:11px;gap:3px;" title="Edit Lead">
                  <Pencil :size="11" /> Edit
                </button>
                <button class="btn-warning btn-sm" @click="openCloseLead(lead, $event)" style="padding:3px 7px;font-size:11px;gap:3px;" title="Close Lead">
                  <CheckCircle :size="11" /> Close
                </button>
                <div style="flex:1;"></div>
                <button v-if="canDeleteLead(lead)" class="btn-danger btn-sm" @click="confirmDel(lead)" style="padding:3px 8px;font-size:11px;"><Trash2 :size="11" /></button>
              </div>
            </div>
            <div v-if="!getLeadsByStage(stage.key).length" style="text-align:center;padding:20px;color:#334155;font-size:12px;">
              No leads
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- LIST VIEW -->
    <template v-else-if="activeTab === 'list'">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
        <div class="search-box" style="flex:1;min-width:220px;">
          <Search :size="14" class="search-icon" />
          <input v-model="search" class="input" placeholder="Search leads…" />
        </div>
        <select v-model="stageFilter" class="input" style="width:160px;">
          <option value="">All Stages</option>
          <option v-for="s in stages" :key="s.key" :value="s.key">{{ s.label }}</option>
        </select>
        <select v-model="assigneeFilter" class="input" style="width:180px;">
          <option value="">All Assignees</option>
          <option v-for="a in uniqueAssignees" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>

      <!-- Upcoming Lost Leads (expiring contracts) -->
      <div v-if="upcomingExpiringLeads.length" style="margin-bottom:20px;">
        <button
          @click="showUpcomingExpiring = !showUpcomingExpiring"
          style="display:flex;align-items:center;gap:8px;width:100%;padding:12px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:12px;cursor:pointer;text-align:left;color:var(--ct-primary);"
        >
          <AlertTriangle :size="16" style="color:#f59e0b;flex-shrink:0;" />
          <span style="font-size:13px;font-weight:600;flex:1;">
            Upcoming Lost Leads — Expiring Contracts
            <span style="font-size:11px;font-weight:400;color:#f59e0b;margin-left:8px;">{{ upcomingExpiringLeads.length }} lead{{ upcomingExpiringLeads.length !== 1 ? 's' : '' }}</span>
          </span>
          <ChevronDown :size="14" :style="showUpcomingExpiring ? 'transform:rotate(180deg);transition:transform .2s;' : 'transition:transform .2s;'" style="color:var(--ct-muted);" />
        </button>
        <div v-if="showUpcomingExpiring" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;padding:0 2px;">
          <div
            v-for="lead in upcomingExpiringLeads"
            :key="lead.id"
            style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.15);border-radius:10px;cursor:pointer;"
            @click="openEdit(lead)"
          >
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">{{ lead.clientName || '—' }}</div>
              <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">
                {{ lead.currentCompanyName ? `Managed by: ${lead.currentCompanyName}` : 'External company managing' }}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:11px;color:#f59e0b;font-weight:600;">Contract Ends</div>
              <div style="font-size:12px;color:var(--ct-sub);">{{ formatDate(lead.currentContractEndDate) }}</div>
              <div style="font-size:10px;margin-top:2px;" :style="{ color: daysUntil(lead.currentContractEndDate) <= 30 ? '#ef4444' : '#f59e0b' }">
                {{ daysUntil(lead.currentContractEndDate) }} days left
              </div>
            </div>
            <div>
              <span :class="['badge', stageBadge(lead.stage)]" style="font-size:10px;">{{ lead.stage || 'new' }}</span>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        :columns="columns"
        :rows="pagedLeads"
        :loading="loading"
        :total="filtered.length"
        :page="page"
        :pageSize="pageSize"
        empty-text="No leads found."
        :on-row-click="openLeadView"
        @page="page = $event"
      >
        <template #default="{ row }">
          <td>
            <div class="tbl-name">{{ row.clientName || '—' }}</div>
            <div class="tbl-source">{{ row.leadSource || '—' }}</div>
          </td>
          <td>
            <div class="tbl-contact">{{ row.contactPerson || '—' }}</div>
            <div class="tbl-meta">{{ row.phone || '—' }}</div>
            <div class="tbl-meta">{{ row.email || '—' }}</div>
          </td>
          <td>
            <div class="tbl-value">{{ formatCurrency(row.value) }}</div>
            <div class="tbl-source">{{ row.elevatorType || '—' }}</div>
          </td>
          <td>
            <span :class="['badge', stageBadge(row.stage)]">{{ row.stage || 'new' }}</span>
          </td>
          <td>
            <span :class="['badge', priorityBadge(row.priority)]">{{ row.priority || 'medium' }}</span>
          </td>
          <td style="color:var(--ct-muted);font-size:12px;">{{ row.assignedTo || '—' }}</td>
          <td>
            <div v-if="row.nextFollowUp" :style="{ color: isOverdue(row.nextFollowUp) ? '#f87171' : '#64748b' }" style="font-size:12px;">
              {{ formatDate(row.nextFollowUp) }}
            </div>
            <div v-else style="color:var(--ct-muted);font-size:12px;">—</div>
          </td>
          <td @click.stop>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
              <button class="btn-secondary btn-sm" @click="openEdit(row)" title="Edit"><Pencil :size="12" /></button>
              <button class="btn-secondary btn-sm" @click="openTimeline(row)" title="Activity Timeline"><History :size="12" /></button>
              <button class="btn-secondary btn-sm" @click="exportLeadPdf(row)" title="Export PDF"><FileDown :size="12" /></button>
              <button class="btn-warning btn-sm" @click="openCloseLead(row, $event)" title="Close Lead" style="gap:3px;"><CheckCircle :size="12" /> Close</button>
              <button v-if="canDeleteLead(row)" class="btn-danger btn-sm" @click="confirmDel(row)" title="Delete"><Trash2 :size="12" /></button>
            </div>
          </td>
        </template>
      </DataTable>
    </template>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Lead' : 'New Lead'" width="760px">
      <div class="form-grid">
        <div class="form-group">
          <label class="label">Project Name *</label>
          <input v-model="form.clientName" class="input" placeholder="Project or company name" />
        </div>
        <div class="form-group">
          <label class="label">Contact Person</label>
          <input v-model="form.contactPerson" class="input" placeholder="Contact person name" />
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="form.phone" class="input" placeholder="+91 9876543210" />
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input v-model="form.email" class="input" type="email" placeholder="client@email.com" />
        </div>

        <!-- Multi-client box — for additional contacts -->
        <div class="form-group form-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <label class="label" style="margin:0;">Additional Contacts</label>
            <button type="button" class="btn-secondary btn-sm" @click="addLeadClient" style="gap:4px;">
              <Plus :size="12" /> Add Client
            </button>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:14px;background:rgba(255,255,255,0.02);">
            <div v-for="(client, ci) in form.clients" :key="ci" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.12);border-radius:10px;position:relative;">
              <div style="position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:4px;">
                <span style="font-size:10px;font-weight:700;background:rgba(99,102,241,0.2);color:var(--ct-accent);padding:1px 7px;border-radius:99px;">Contact {{ ci + 1 }}</span>
                <button v-if="form.clients.length > 1" type="button" @click="removeLeadClient(ci)" style="width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,0.15);border:none;color:#f87171;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;">×</button>
              </div>
              <div style="padding-top:20px;">
                <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Name *</div>
                <input v-model="client.name" class="input" placeholder="Full name" style="font-size:12px;padding:7px 10px;" />
              </div>
              <div style="padding-top:20px;">
                <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Designation</div>
                <input v-model="client.designation" class="input" placeholder="e.g. Owner" style="font-size:12px;padding:7px 10px;" />
              </div>
              <div>
                <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Phone</div>
                <input v-model="client.phone" class="input" placeholder="+91 9876543210" style="font-size:12px;padding:7px 10px;" />
              </div>
              <div>
                <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Email</div>
                <input v-model="client.email" class="input" type="email" placeholder="email@example.com" style="font-size:12px;padding:7px 10px;" />
              </div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="label">Plot / Door No. <span style="font-weight:400;font-size:10px;color:var(--ct-muted);">optional</span></label>
          <input v-model="form.plotNo" class="input" placeholder="e.g. Plot 12, Flat 4A" />
        </div>
        <div class="form-group">
          <label class="label">Sector / Area <span style="font-weight:400;font-size:10px;color:var(--ct-muted);">optional</span></label>
          <input v-model="form.sector" class="input" placeholder="e.g. Sector 15, Andheri" />
        </div>
        <div class="form-group form-full">
          <label class="label">Address / Location</label>
          <textarea v-model="form.address" class="input" rows="2" placeholder="Address…"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Lead Stage</label>
          <select v-model="form.stage" class="input">
            <option v-for="s in stages" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="label">Lead Type <span style="color:var(--ct-muted);font-weight:400;">(multi-select)</span></label>
          <!-- Trigger chip row -->
          <div class="lt-trigger" @click="ltOpen = !ltOpen">
            <span v-if="!form.leadTypes.length" class="lt-placeholder">Select type(s)…</span>
            <template v-else>
              <span v-for="t in form.leadTypes" :key="t" class="lt-chip">
                {{ LEAD_TYPE_LABELS[t] }}
                <button type="button" class="lt-chip-x" @click.stop="toggleLeadType(t)">×</button>
              </span>
            </template>
            <ChevronDown :size="13" class="lt-arrow" :style="ltOpen ? 'transform:rotate(180deg)' : ''" />
          </div>
          <!-- Dropdown panel -->
          <div v-if="ltOpen" class="lt-panel">
            <label v-for="opt in LEAD_TYPES" :key="opt.value" class="lt-option"
              :class="{ selected: form.leadTypes.includes(opt.value) }"
              @click="toggleLeadType(opt.value)">
              <span class="lt-check">
                <component :is="form.leadTypes.includes(opt.value) ? CheckSquare2 : Square" :size="14" />
              </span>
              {{ opt.label }}
            </label>
          </div>
          <!-- Per-type notes -->
          <div v-if="form.leadTypes.length" class="lt-notes">
            <div v-for="t in form.leadTypes" :key="'note-' + t" class="lt-note-row">
              <span class="lt-note-label">{{ LEAD_TYPE_LABELS[t] }} — Note</span>
              <input
                v-model="form.leadTypeNotes[t]"
                class="input lt-note-input"
                :placeholder="'Note for ' + LEAD_TYPE_LABELS[t] + '…'"
              />
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="label">Priority</label>
          <select v-model="form.priority" class="input">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High (Urgent)</option>
          </select>
        </div>
        <!-- Lost Reason — shown only when stage is Lost -->
        <div v-if="form.stage === 'lost'" class="form-group form-full">
          <label class="label" style="color:#f87171;">Reason for Lost Lead</label>
          <textarea v-model="form.lostReason" class="input" rows="2" placeholder="Why was this lead lost? e.g. Budget constraint, Competitor won, No response…" style="border-color:rgba(239,68,68,0.3);"></textarea>
        </div>
        <div class="form-group">
          <label class="label">Lead Source</label>
          <select v-model="form.leadSource" class="input">
            <option value="">Select…</option>
            <option value="referral">Referral</option>
            <option value="website">Website</option>
            <option value="cold-call">Cold Call</option>
            <option value="exhibition">Exhibition</option>
            <option value="social-media">Social Media</option>
            <option value="existing-client">Existing Client</option>
            <option value="bargeins">Bargeins</option>
            <option value="existing-database">Existing Database</option>
            <option value="vendor-database">Vendor Provided Database</option>
            <option value="justdial">Justdial</option>
            <option value="indiamart">IndiaMART</option>
            <option value="direct-visit">Direct Visit</option>
            <option value="others">Others</option>
          </select>
          <input v-if="form.leadSource === 'others'" v-model="form.leadSourceOther" class="input" placeholder="Specify lead source…" style="margin-top:6px;" />
        </div>
        <!-- Elevator Requirements -->
        <div class="form-group form-full">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <label class="label" style="margin:0;">Elevator Requirements</label>
            <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:6px 12px;">
              <span style="font-size:12px;color:var(--ct-muted);">Single</span>
              <button
                type="button"
                @click="form.multiRequirements = !form.multiRequirements"
                style="position:relative;width:44px;height:24px;border-radius:99px;border:2px solid rgba(99,102,241,0.5);cursor:pointer;transition:all .2s;flex-shrink:0;outline:none;"
                :style="{ background: form.multiRequirements ? '#6366f1' : 'rgba(255,255,255,0.08)', borderColor: form.multiRequirements ? '#6366f1' : 'rgba(255,255,255,0.25)' }"
              >
                <span
                  style="position:absolute;top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:all .22s;box-shadow:0 1px 4px rgba(0,0,0,0.4);"
                  :style="{ left: form.multiRequirements ? '22px' : '2px' }"
                ></span>
              </button>
              <span style="font-size:12px;font-weight:600;" :style="{ color: form.multiRequirements ? '#818cf8' : 'var(--ct-muted)' }">Multiple</span>
            </div>
          </div>

          <!-- Single requirement mode -->
          <template v-if="!form.multiRequirements">
            <select v-model="form.elevatorType" class="input">
              <option value="">Select elevator type…</option>
              <option value="passenger">Passenger Elevator</option>
              <option value="goods">Goods Elevator</option>
              <option value="hospital">Hospital Elevator</option>
              <option value="car-elevator">Car Elevator</option>
              <option value="dumbwaiter">Dumbwaiter</option>
              <option value="hydraulic">Hydraulic Elevator</option>
              <option value="mrl">MRL (Machine Room Less)</option>
              <option value="home-lift">Home Lift</option>
              <option value="observation">Observation / Glass</option>
              <option value="service">Service Elevator</option>
              <option value="escalator">Escalator</option>
              <option value="fire-evacuation">Fire Evacuation Elevator</option>
              <option value="car-parking">Car Parking System</option>
              <option value="amc">AMC</option>
              <option value="modernisation">Modernisation</option>
              <option value="other">Other</option>
            </select>
            <select v-if="form.elevatorType === 'passenger'" v-model="form.passengerSubType" class="input" style="margin-top:6px;">
              <option value="">Select drive type…</option>
              <option value="MRL Gearless">MRL Gearless</option>
              <option value="MR Gearless">MR Gearless</option>
              <option value="MR Geared">MR Geared</option>
              <option value="MRL Geared">MRL Geared</option>
            </select>
            <input v-if="form.elevatorType === 'other'" v-model="form.elevatorTypeOther" class="input" placeholder="Specify elevator type…" style="margin-top:6px;" />
            <template v-if="form.elevatorType === 'car-parking'">
              <select v-model="form.parkingSubType" class="input" style="margin-top:6px;">
                <option value="">Parking sub-type…</option>
                <option v-for="s in ['Car Stack','Bike Stack','Puzzle Parking','Tower Parking','Rotary Parking','No Post Parking','Two Post Parking','Others']" :key="s" :value="s">{{ s }}</option>
              </select>
              <input v-if="form.parkingSubType === 'Others'" v-model="form.parkingSubTypeOther" class="input" placeholder="Specify parking type…" style="margin-top:6px;" />
            </template>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
              <div>
                <div style="font-size:11px;color:var(--ct-muted);margin-bottom:4px;">Quantity</div>
                <input v-model.number="form.elevatorQty" class="input" type="number" min="1" placeholder="1" />
              </div>
              <div>
                <div style="font-size:11px;color:var(--ct-muted);margin-bottom:4px;">Floors Served</div>
                <input v-model="form.elevatorFloors" class="input" placeholder="e.g. G+10, 1-15" />
              </div>
              <div>
                <div style="font-size:11px;color:var(--ct-muted);margin-bottom:4px;">Load Capacity</div>
                <input v-model="form.elevatorLoadCapacity" class="input" placeholder="e.g. 630 kg / 8 persons" />
              </div>
              <div>
                <div style="font-size:11px;color:var(--ct-muted);margin-bottom:4px;">Special Note</div>
                <input v-model="form.elevatorSpecialNote" class="input" placeholder="Any special requirement…" />
              </div>
            </div>
          </template>

          <!-- Multiple requirements mode -->
          <template v-else>
            <div style="display:flex;flex-direction:column;gap:10px;border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:14px;background:rgba(255,255,255,0.02);">
              <div
                v-for="(req, ri) in form.requirements"
                :key="ri"
                style="padding:12px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.12);border-radius:10px;position:relative;"
              >
                <div style="position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:4px;">
                  <span style="font-size:10px;font-weight:700;background:rgba(99,102,241,0.2);color:var(--ct-accent);padding:1px 7px;border-radius:99px;">Req {{ ri + 1 }}</span>
                  <button v-if="form.requirements.length > 1" type="button" @click="removeRequirement(ri)" style="width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,0.15);border:none;color:#f87171;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;">×</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 60px;gap:8px;padding-top:22px;">
                  <div>
                    <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Elevator Type</div>
                    <select v-model="req.elevatorType" class="input" style="font-size:12px;padding:7px 10px;">
                      <option value="">Select…</option>
                      <option value="passenger">Passenger Elevator</option>
                      <option value="goods">Goods Elevator</option>
                      <option value="hospital">Hospital Elevator</option>
                      <option value="car-elevator">Car Elevator</option>
                      <option value="dumbwaiter">Dumbwaiter</option>
                      <option value="hydraulic">Hydraulic Elevator</option>
                      <option value="mrl">MRL (Machine Room Less)</option>
                      <option value="home-lift">Home Lift</option>
                      <option value="observation">Observation / Glass</option>
                      <option value="service">Service Elevator</option>
                      <option value="escalator">Escalator</option>
                      <option value="fire-evacuation">Fire Evacuation Elevator</option>
                      <option value="car-parking">Car Parking System</option>
                      <option value="amc">AMC</option>
                      <option value="modernisation">Modernisation</option>
                      <option value="other">Other</option>
                    </select>
                    <select v-if="req.elevatorType === 'passenger'" v-model="req.passengerSubType" class="input" style="font-size:12px;padding:7px 10px;margin-top:4px;">
                      <option value="">Select drive type…</option>
                      <option value="MRL Gearless">MRL Gearless</option>
                      <option value="MR Gearless">MR Gearless</option>
                      <option value="MR Geared">MR Geared</option>
                      <option value="MRL Geared">MRL Geared</option>
                    </select>
                    <input v-if="req.elevatorType === 'other'" v-model="req.elevatorTypeOther" class="input" placeholder="Specify type…" style="font-size:12px;padding:7px 10px;margin-top:4px;" />
                    <template v-if="req.elevatorType === 'car-parking'">
                      <select v-model="req.parkingSubType" class="input" style="font-size:12px;padding:7px 10px;margin-top:4px;">
                        <option value="">Parking sub-type…</option>
                        <option v-for="s in ['Car Stack','Bike Stack','Puzzle Parking','Tower Parking','Rotary Parking','No Post Parking','Two Post Parking','Others']" :key="s" :value="s">{{ s }}</option>
                      </select>
                      <input v-if="req.parkingSubType === 'Others'" v-model="req.parkingSubTypeOther" class="input" placeholder="Specify parking type…" style="font-size:12px;padding:7px 10px;margin-top:4px;" />
                    </template>
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Qty</div>
                    <input v-model.number="req.qty" class="input" type="number" min="1" placeholder="1" style="font-size:12px;padding:7px 10px;" />
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Floors Served</div>
                    <input v-model="req.floors" class="input" placeholder="e.g. G+10" style="font-size:12px;padding:7px 10px;" />
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Load Capacity</div>
                    <input v-model="req.loadCapacity" class="input" placeholder="e.g. 630 kg" style="font-size:12px;padding:7px 10px;" />
                  </div>
                  <div style="grid-column:1/-1;">
                    <div style="font-size:10px;color:var(--ct-muted);margin-bottom:3px;">Notes / Requirements</div>
                    <textarea v-model="req.notes" class="input" rows="2" placeholder="Specific notes for this requirement…" style="font-size:12px;padding:7px 10px;"></textarea>
                  </div>
                </div>
              </div>
              <button type="button" class="btn-secondary btn-sm" @click="addRequirement" style="width:100%;justify-content:center;gap:6px;">
                <Plus :size="13" /> Add Requirement
              </button>
            </div>
          </template>
        </div>
        <div class="form-group">
          <label class="label">Deal Value (₹)</label>
          <input v-model.number="form.value" class="input" type="number" min="0" placeholder="0" />
        </div>
        <div class="form-group">
          <label class="label">Assigned To</label>
          <select v-model="form.assignedTo" class="input">
            <option value="">Select…</option>
            <option v-for="e in salesEmployees" :key="e.id" :value="e.fullName || e.name">{{ e.fullName || e.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Next Follow-Up</label>
          <input v-model="form.nextFollowUp" class="input" type="date" />
        </div>
        <div class="form-group form-full">
          <label class="label">Notes / Requirements</label>
          <textarea v-model="form.notes" class="input" rows="3" placeholder="Client requirements, follow-up notes…"></textarea>
        </div>

        <!-- Current Company Toggle -->
        <div class="form-group form-full">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:12px;">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">Currently managed by another company?</div>
              <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">Toggle if this client is currently under contract with a competitor or another service provider</div>
            </div>
            <button
              type="button"
              @click="form.currentlyManagedByOther = !form.currentlyManagedByOther"
              :style="`width:46px;height:26px;border-radius:99px;border:none;cursor:pointer;transition:all .2s;background:${form.currentlyManagedByOther ? '#6366f1' : 'rgba(255,255,255,0.15)'};position:relative;flex-shrink:0;`"
            >
              <span :style="`position:absolute;top:4px;width:18px;height:18px;background:#fff;border-radius:50%;transition:all .2s;left:${form.currentlyManagedByOther ? '24px' : '4px'};box-shadow:0 1px 4px rgba(0,0,0,0.3);`"></span>
            </button>
          </div>
          <div v-if="form.currentlyManagedByOther" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;padding:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(99,102,241,0.12);border-radius:10px;">
            <div>
              <div style="font-size:11px;color:var(--ct-muted);margin-bottom:5px;">Current Company Name</div>
              <input v-model="form.currentCompanyName" class="input" placeholder="e.g. ABC Elevators Pvt Ltd" />
            </div>
            <div>
              <div style="font-size:11px;color:var(--ct-muted);margin-bottom:5px;">Contract / AMC End Date</div>
              <input v-model="form.currentContractEndDate" class="input" type="date" />
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="label">Expected Close Date</label>
          <input v-model="form.expectedCloseDate" class="input" type="date" />
        </div>
        <div class="form-group">
          <label class="label">Win Probability (%)</label>
          <input v-model.number="form.probability" class="input" type="number" min="0" max="100" placeholder="50" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" @click="save" :disabled="saving">
          {{ saving ? 'Saving…' : (editing ? 'Update Lead' : 'Add Lead') }}
        </button>
      </template>
    </AppModal>

    <ExportDialog
      v-model="showLeadsExport"
      v-model:selectedPeriod="leadsExportPeriod"
      v-model:exportType="leadsExportType"
      :exporting="leadsExporting"
      @confirm="runLeadsExport"
      @cancel="showLeadsExport = false"
    />
    <ConfirmDialog ref="confirmRef" @confirm="doDelete" />

    <!-- Won Lead → Project Created Banner -->
    <Transition name="slide-up">
      <div v-if="showWonBanner" style="position:fixed;bottom:24px;right:24px;z-index:500;max-width:380px;">
        <div style="background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(6,182,212,0.1));border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:18px 20px;backdrop-filter:blur(20px);box-shadow:0 10px 40px rgba(0,0,0,0.3);">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:36px;height:36px;background:rgba(16,185,129,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <CheckCircle2 :size="18" style="color:var(--ct-green);" />
            </div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;color:var(--ct-green);margin-bottom:2px;">🎉 Lead Won!</div>
              <div style="font-size:12px;color:var(--ct-sub);margin-bottom:10px;">
                Project card created for <strong style="color:var(--ct-primary);">{{ wonBannerData?.name }}</strong>. Complete the project details.
              </div>
              <div style="display:flex;gap:8px;">
                <button
                  @click="router.push('/projects'); showWonBanner = false"
                  style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:linear-gradient(135deg,#10b981,#14b8a6);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:600;cursor:pointer;"
                >
                  <FolderOpen :size="13" /> Go to Projects <ArrowRight :size="12" />
                </button>
                <button
                  @click="showWonBanner = false"
                  style="padding:7px 12px;background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--ct-muted);font-size:12px;cursor:pointer;"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Activity Timeline panel -->
    <ActivityTimeline
      v-model="showTimeline"
      :collection="Collections.ACTIVITIES"
      :recordId="timelineLead?.id || ''"
      :title="timelineLead?.clientName || 'Lead'"
      :recordSummary="timelineLead ? `${timelineLead.clientName} · ${timelineLead.stage||'new'} · ${timelineLead.assignedTo||'Unassigned'}` : ''"
    />

    <!-- Close Lead Modal -->
    <AppModal v-model="showCloseModal" title="Close Lead" subtitle="Mark this lead as won or lost" width="440px">
      <div v-if="closingLead" style="display:flex;flex-direction:column;gap:16px;">
        <div style="padding:10px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:10px;font-size:13px;">
          <strong>{{ closingLead.clientName }}</strong>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ closingLead.contactPerson }} · {{ formatCurrency(closingLead.value) }}</div>
        </div>
        <div style="display:flex;gap:10px;">
          <button
            @click="closeForm.outcome = 'won'"
            :style="`flex:1;padding:14px;border-radius:12px;border:2px solid;cursor:pointer;transition:all .2s;font-weight:600;font-size:14px;${closeForm.outcome === 'won' ? 'background:rgba(74,222,128,0.12);border-color:rgba(74,222,128,0.5);color:#4ade80;' : 'background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.1);color:var(--ct-muted);'}`"
          >
            🏆 Won
          </button>
          <button
            @click="closeForm.outcome = 'lost'"
            :style="`flex:1;padding:14px;border-radius:12px;border:2px solid;cursor:pointer;transition:all .2s;font-weight:600;font-size:14px;${closeForm.outcome === 'lost' ? 'background:rgba(248,113,113,0.12);border-color:rgba(248,113,113,0.5);color:#f87171;' : 'background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.1);color:var(--ct-muted);'}`"
          >
            ✗ Lost
          </button>
        </div>
        <div v-if="closeForm.outcome === 'won'" style="padding:10px 14px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:10px;font-size:12px;color:#4ade80;">
          ✓ A project will be automatically created. You'll be taken to Projects to fill in remaining details.
        </div>
        <div v-if="closeForm.outcome === 'lost'">
          <label class="label">Reason for Loss</label>
          <textarea v-model="closeForm.lostReason" class="input" rows="3" placeholder="Price too high, competitor chosen, budget cut…"></textarea>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showCloseModal = false">Cancel</button>
        <button
          :class="closeForm.outcome === 'won' ? 'btn-success' : 'btn-danger'"
          :disabled="closeLoading"
          @click="saveCloseLead"
        >
          {{ closeLoading ? 'Saving…' : (closeForm.outcome === 'won' ? '🏆 Close as Won' : '✗ Close as Lost') }}
        </button>
      </template>
    </AppModal>

    <!-- Lead View Modal -->
    <AppModal v-model="showLeadViewModal" :title="viewingLead?.clientName || 'Lead Details'" subtitle="Lead overview" width="600px">
      <div v-if="viewingLead" style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:4px;">Client</div>
            <div style="font-weight:600;color:var(--ct-primary);">{{ viewingLead.clientName }}</div>
          </div>
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:4px;">Stage</div>
            <span :class="['badge', stageBadge(viewingLead.stage)]">{{ viewingLead.stage }}</span>
          </div>
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:4px;">Contact</div>
            <div>{{ viewingLead.contactPerson || '—' }}</div>
            <div style="font-size:12px;color:var(--ct-muted);">{{ viewingLead.phone }} {{ viewingLead.email ? '· ' + viewingLead.email : '' }}</div>
          </div>
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:4px;">Value</div>
            <div style="font-weight:600;color:var(--ct-accent);">{{ formatCurrency(viewingLead.value) }}</div>
          </div>
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:4px;">Priority</div>
            <span :class="['badge', priorityBadge(viewingLead.priority)]">{{ viewingLead.priority || 'medium' }}</span>
          </div>
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:4px;">Assigned To</div>
            <div>{{ viewingLead.assignedTo || '—' }}</div>
          </div>
          <div v-if="viewingLead.nextFollowUp">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:4px;">Next Follow-up</div>
            <div>{{ formatDate(viewingLead.nextFollowUp) }}</div>
          </div>
          <div v-if="viewingLead.expectedCloseDate">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:4px;">Expected Close</div>
            <div>{{ formatDate(viewingLead.expectedCloseDate) }}</div>
          </div>
        </div>
        <div v-if="viewingLead.elevatorType || (viewingLead.requirements && viewingLead.requirements.length)">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:6px;">Requirements</div>
          <div v-if="viewingLead.requirements && viewingLead.requirements.length">
            <div v-for="(req, i) in viewingLead.requirements" :key="i" style="font-size:12px;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:4px;">
              {{ req.elevatorType }} · {{ req.qty || 1 }} unit(s) · {{ req.floors || '—' }} floors · {{ req.loadCapacity || '—' }}
              <span v-if="req.notes" style="color:var(--ct-muted);"> — {{ req.notes }}</span>
            </div>
          </div>
          <div v-else style="font-size:13px;">{{ viewingLead.elevatorType }}</div>
        </div>
        <div v-if="viewingLead.notes">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ct-muted);margin-bottom:4px;">Notes</div>
          <div style="font-size:12px;color:var(--ct-sub);line-height:1.5;">{{ viewingLead.notes }}</div>
        </div>
        <div v-if="viewingLead.lostReason">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#f87171;margin-bottom:4px;">Lost Reason</div>
          <div style="font-size:12px;color:var(--ct-sub);">{{ viewingLead.lostReason }}</div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showLeadViewModal = false">Close</button>
        <button class="btn-primary" @click="openEdit(viewingLead); showLeadViewModal = false">
          <Pencil :size="13" /> Edit Lead
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { TrendingUp, Plus, Search, Pencil, Trash2, Kanban, List, FolderOpen, ArrowRight, CheckCircle2, CheckCircle, FileSpreadsheet, FileText, AlertTriangle, ChevronDown, Save, History, FileDown, CheckSquare2, Square } from 'lucide-vue-next'
import DataTable from '@/components/ui/DataTable.vue'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ActivityTimeline from '@/components/ui/ActivityTimeline.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Collections } from '@/firebase/collections'
import { create, update } from '@/firebase/firestore'
import ExportDialog from '@/components/ui/ExportDialog.vue'
import { filterByDateRange, getDateRange } from '@/composables/useExport'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { savePDF, saveExcel } from '@/utils/saveFile'

const ui = useUIStore()
const auth = useAuthStore()
const router = useRouter()

// ── Lead Type multi-select ────────────────────────────────────────────────────
const LEAD_TYPES = [
  { value: 'installation',   label: 'Installation' },
  { value: 'modernisation',  label: 'Modernisation' },
  { value: 'amc',            label: 'AMC' },
  { value: 'maintenance',    label: 'Maintenance' },
  { value: 'new-order',      label: 'New Order' },
]
const LEAD_TYPE_LABELS = Object.fromEntries(LEAD_TYPES.map(t => [t.value, t.label]))
const ltOpen = ref(false)

function toggleLeadType(val) {
  const idx = form.value.leadTypes.indexOf(val)
  if (idx === -1) {
    form.value.leadTypes.push(val)
    if (!form.value.leadTypeNotes[val]) form.value.leadTypeNotes[val] = ''
  } else {
    form.value.leadTypes.splice(idx, 1)
    delete form.value.leadTypeNotes[val]
  }
}
const { items: leadItems, loading, add, edit, del } = useCollection(Collections.LEADS)
const employees = useCollection(Collections.EMPLOYEES)

// ── Won lead → project banner ─────────────────────────────────────────────────
const showWonBanner = ref(false)
const wonBannerData = ref(null)

async function createProjectFromLead(lead) {
  try {
    const primaryClient = (lead.clients && lead.clients[0]) || {}
    const projectData = {
      projectName: lead.clientName || (lead.clients && lead.clients[0]?.name) || '',
      clientName: primaryClient.name || lead.clientName || '',
      clientPhone: primaryClient.phone || lead.phone || '',
      clientEmail: primaryClient.email || lead.email || '',
      clients: lead.clients && lead.clients.length ? lead.clients : [{ name: lead.contactPerson || lead.clientName || '', designation: '', phone: lead.phone || '', email: lead.email || '' }],
      address: [lead.plotNo, lead.sector, lead.address].filter(Boolean).join(', ') || '',
      city: '',
      type: lead.elevatorType || 'New Installation',
      elevatorType: lead.elevatorType || '',
      value: lead.value || 0,
      status: 'active',
      description: lead.notes || '',
      sourceLeadId: lead.id || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const newProjectId = await create(Collections.PROJECTS, projectData)
    wonBannerData.value = { name: lead.clientName }
    showWonBanner.value = true
    setTimeout(() => { showWonBanner.value = false }, 8000)
    // Signal ProjectsView to auto-open this new project card for completion
    ui.setPendingAutoOpen({ collection: Collections.PROJECTS, recordId: newProjectId, fromLead: true })
  } catch {
    // Don't block the lead save if project creation fails
  }
}

// ── Close Lead ────────────────────────────────────────────────────────────────
const showCloseModal = ref(false)
const closingLead = ref(null)
const closeForm = ref({ outcome: 'won', lostReason: '' })
const closeLoading = ref(false)

function openCloseLead(lead, e) {
  if (e) e.stopPropagation()
  closingLead.value = lead
  closeForm.value = { outcome: 'won', lostReason: '' }
  showCloseModal.value = true
}

async function saveCloseLead() {
  const lead = closingLead.value
  if (!lead) return
  closeLoading.value = true
  try {
    const updates = { stage: closeForm.value.outcome === 'won' ? 'won' : 'lost' }
    if (closeForm.value.outcome === 'lost') updates.lostReason = closeForm.value.lostReason
    await update(Collections.LEADS, lead.id, updates)
    if (closeForm.value.outcome === 'won') {
      await createProjectFromLead({ ...lead, ...updates })
      ui.success('Lead closed as Won! Project created — please complete the project details.')
      setTimeout(() => router.push('/projects'), 2000)
    } else {
      ui.success('Lead closed as Lost.')
    }
    showCloseModal.value = false
  } catch (e) {
    ui.error('Failed to close lead: ' + e.message)
  } finally {
    closeLoading.value = false
  }
}

// ── Lead View Modal ───────────────────────────────────────────────────────────
const showLeadViewModal = ref(false)
const viewingLead = ref(null)
function openLeadView(lead) { viewingLead.value = lead; showLeadViewModal.value = true }

// Auto-open from Reminders
watch([() => ui.pendingAutoOpen, leadItems], () => {
  const pending = ui.pendingAutoOpen
  if (!pending || pending.collection !== Collections.LEADS) return
  const record = leadItems.value.find(r => r.id === pending.recordId)
  if (record) { openLeadView(record); ui.clearPendingAutoOpen() }
})

const activeTab = ref('pipeline')
const search = ref('')
const stageFilter = ref('')
const assigneeFilter = ref('')
const page = ref(1)
const pageSize = 25
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const confirmRef = ref(null)
let pendingDeleteId = null

const today = new Date().toISOString().slice(0, 10)

const stages = [
  { key: 'new', label: 'New', badge: 'badge-info' },
  { key: 'contacted', label: 'Contacted', badge: 'badge-blue' },
  { key: 'qualified', label: 'Qualified', badge: 'badge-purple' },
  { key: 'proposal', label: 'Proposal Sent', badge: 'badge-warning' },
  { key: 'negotiation', label: 'Negotiation', badge: 'badge-warning' },
  { key: 'won', label: 'Won', badge: 'badge-active' },
  { key: 'lost', label: 'Lost', badge: 'badge-danger' },
]

const emptyForm = () => ({
  clientName: '', contactPerson: '', phone: '', email: '',
  clients: [{ name: '', designation: '', phone: '', email: '' }],
  plotNo: '', sector: '', address: '',
  stage: 'new', priority: 'medium', leadSource: '', leadSourceOther: '',
  leadTypes: [], leadTypeNotes: {},
  lostReason: '',
  multiRequirements: false,
  elevatorType: '', elevatorTypeOther: '', passengerSubType: '', parkingSubType: '', parkingSubTypeOther: '',
  elevatorQty: 1, elevatorFloors: '', elevatorLoadCapacity: '', elevatorSpecialNote: '',
  requirements: [{ elevatorType: '', elevatorTypeOther: '', passengerSubType: '', parkingSubType: '', parkingSubTypeOther: '', qty: 1, floors: '', loadCapacity: '', notes: '' }],
  currentlyManagedByOther: false,
  currentCompanyName: '',
  currentContractEndDate: '',
  value: 0, assignedTo: '', nextFollowUp: '', notes: '',
  expectedCloseDate: '', probability: 50,
})

function addRequirement() {
  form.value.requirements.push({ elevatorType: '', elevatorTypeOther: '', passengerSubType: '', parkingSubType: '', parkingSubTypeOther: '', qty: 1, floors: '', loadCapacity: '', notes: '' })
}
function removeRequirement(i) {
  if (form.value.requirements.length > 1) form.value.requirements.splice(i, 1)
}

function addLeadClient() {
  form.value.clients.push({ name: '', designation: '', phone: '', email: '' })
}
function removeLeadClient(i) {
  if (form.value.clients.length > 1) form.value.clients.splice(i, 1)
}
const form = ref(emptyForm())

// ── Activity Timeline ─────────────────────────────────────────────────────────
const showTimeline = ref(false)
const timelineLead = ref(null)

function openTimeline(lead, e) {
  e?.stopPropagation()
  timelineLead.value = lead
  showTimeline.value = true
}

// ── Per-Lead PDF export ───────────────────────────────────────────────────────
async function exportLeadPdf(lead, e) {
  e?.stopPropagation()
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const fmtD = (d) => { if (!d) return '—'; const dt = d?.toDate ? d.toDate() : new Date(d); if (isNaN(dt)) return '—'; return dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  const now = new Date()

  // Header band
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('Avant Elevators — Lead Summary', 105, 11, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(148, 163, 184)
  doc.text(`Generated: ${now.toLocaleDateString('en-IN')}   |   Lead: ${lead.clientName || '—'}`, 105, 18, { align: 'center' })
  doc.setFontSize(7.5); doc.text(`Stage: ${toTitle(lead.stage||'New')}   |   Priority: ${toTitle(lead.priority||'Medium')}`, 105, 24, { align: 'center' })

  // Client info table
  autoTable(doc, {
    startY: 32,
    body: [
      ['Contact Person', lead.clientName || '—'],
      ['Contact Person', lead.contactPerson || '—'],
      ['Phone', lead.phone || '—'],
      ['Email', lead.email || '—'],
      ['Address', lead.address || '—'],
      ['Lead Type', Array.isArray(lead.leadTypes) && lead.leadTypes.length
        ? lead.leadTypes.map(t => {
            const note = lead.leadTypeNotes?.[t]
            return LEAD_TYPE_LABELS[t] + (note ? ` (${note})` : '')
          }).join(', ')
        : (lead.leadType || '—')],
      ['Lead Source', lead.leadSource || '—'],
      ['Assigned To', lead.assignedTo || '—'],
      ['Deal Value', lead.value ? `Rs. ${Number(lead.value).toLocaleString('en-IN')}` : '—'],
      ['Win Probability', `${lead.probability || 0}%`],
      ['Next Follow-Up', fmtD(lead.nextFollowUp)],
      ['Expected Close', fmtD(lead.expectedCloseDate)],
      ['Current Company', lead.currentlyManagedByOther ? (lead.currentCompanyName || 'Yes') : 'No'],
      ['Contract End Date', lead.currentlyManagedByOther ? fmtD(lead.currentContractEndDate) : '—'],
      ['Notes', lead.notes || '—'],
      ...(lead.stage === 'lost' ? [['Lost Reason', lead.lostReason || '—']] : []),
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, fillColor: [241, 245, 249], textColor: [30, 41, 59] }, 1: { cellWidth: 130 } },
    theme: 'grid',
    margin: { left: 12, right: 12 },
  })

  // Elevator requirements
  if (lead.multiRequirements && lead.requirements?.length) {
    const reqY = doc.lastAutoTable.finalY + 8
    autoTable(doc, {
      startY: reqY,
      head: [['#', 'Elevator Type', 'Qty', 'Floors', 'Load Capacity', 'Notes']],
      body: lead.requirements.map((r, i) => [i+1, r.elevatorType||'—', r.qty||1, r.floors||'—', r.loadCapacity||'—', r.notes||r.specialNote||'—']),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255 },
      margin: { left: 12, right: 12 },
    })
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(100, 116, 139)
    doc.text(`Avant Elevators EMS  |  Lead ID: ${lead.id || '—'}  |  Confidential`, 105, 290, { align: 'center' })
  }
  await savePDF(doc, `lead-${(lead.clientName||'export').replace(/\s+/g,'-')}-${now.toISOString().slice(0,10)}.pdf`, ui)
  ui.success('Lead PDF exported.')
}

// ── Per-user export report title ─────────────────────────────────────────────
const exportReportTitle = ref('')
const EXPORT_TITLE_KEY = computed(() => `micro_elevators_export_title_${auth.user?.id || auth.user?.username || 'default'}`)

function loadExportReportTitle() {
  exportReportTitle.value = localStorage.getItem(EXPORT_TITLE_KEY.value) || ''
}
function saveExportReportTitle() {
  localStorage.setItem(EXPORT_TITLE_KEY.value, exportReportTitle.value.trim())
  ui.success('Report title saved.')
}
onMounted(loadExportReportTitle)

// ── Upcoming expiring contracts ───────────────────────────────────────────────
const showUpcomingExpiring = ref(false)
const upcomingExpiringLeads = computed(() => {
  const today = new Date(); today.setHours(0,0,0,0)
  const limit = new Date(today); limit.setDate(limit.getDate() + 180) // next 6 months
  return leads.value.filter(l => {
    if (!l.currentlyManagedByOther || !l.currentContractEndDate) return false
    const d = new Date(l.currentContractEndDate)
    return !isNaN(d) && d >= today && d <= limit
  }).sort((a,b) => new Date(a.currentContractEndDate) - new Date(b.currentContractEndDate))
})

function daysUntil(dateStr) {
  if (!dateStr) return 0
  const d = new Date(dateStr); const today = new Date(); today.setHours(0,0,0,0)
  return Math.max(0, Math.ceil((d - today) / 86400000))
}

const isAdmin = computed(() => auth.user?.role === 'admin')
const canDeleteLead = (lead) => {
  if (isAdmin.value) return true
  if (auth.user?.role === 'sales') {
    return lead.createdById === currentUserId.value || lead.assignedTo === currentUserName.value
  }
  return false
}
const currentUserId = computed(() => auth.user?.id || '')
const currentUserName = computed(() => auth.user?.fullName || auth.user?.username || '')

// Sales users only see leads they created or are assigned to; admin sees all
const leads = computed(() => {
  if (isAdmin.value) return leadItems.value
  return leadItems.value.filter(l =>
    l.createdById === currentUserId.value ||
    l.assignedTo === currentUserName.value
  )
})
const salesEmployees = computed(() => employees.items.value.filter(e => e.role === 'sales' || e.role === 'admin'))
const uniqueAssignees = computed(() => [...new Set(leads.value.map(l => l.assignedTo).filter(Boolean))])
const wonCount = computed(() => leads.value.filter(l => l.stage === 'won').length)
const pipelineValue = computed(() => leads.value.filter(l => !['won','lost'].includes(l.stage)).reduce((s, l) => s + (l.value || 0), 0))

const getLeadsByStage = (stage) => leads.value.filter(l => (l.stage || 'new') === stage)

const columns = [
  { key: 'client', label: 'Contact Person' },
  { key: 'contact', label: 'Contact' },
  { key: 'value', label: 'Value' },
  { key: 'stage', label: 'Stage' },
  { key: 'priority', label: 'Priority' },
  { key: 'assigned', label: 'Assigned To' },
  { key: 'followup', label: 'Follow-Up' },
  { key: 'actions', label: 'Actions', width: '90px' },
]

const filtered = computed(() => leads.value.filter(l => {
  const q = search.value.toLowerCase()
  if (q && !l.clientName?.toLowerCase().includes(q) && !l.contactPerson?.toLowerCase().includes(q) && !l.phone?.includes(q)) return false
  if (stageFilter.value && (l.stage || 'new') !== stageFilter.value) return false
  if (assigneeFilter.value && l.assignedTo !== assigneeFilter.value) return false
  return true
}))
const pagedLeads = computed(() => {
  const s = (page.value - 1) * pageSize
  return filtered.value.slice(s, s + pageSize)
})

function openAdd() {
  editing.value = null
  const f = emptyForm()
  // Auto-assign to self for sales users (not admin)
  if (!isAdmin.value) f.assignedTo = currentUserName.value
  form.value = f
  ltOpen.value = false
  showModal.value = true
}
function openEdit(row) {
  editing.value = row
  const base = emptyForm()
  form.value = { ...base, ...row }
  // Ensure additional contacts array exists
  if (!form.value.clients || !form.value.clients.length) {
    form.value.clients = [{ name: '', designation: '', phone: '', email: '' }]
  }
  // Backward compat: if no requirements array, seed from single elevatorType field
  if (!form.value.requirements || !form.value.requirements.length) {
    form.value.requirements = [{ elevatorType: row.elevatorType || '', elevatorTypeOther: row.elevatorTypeOther || '', parkingSubType: row.parkingSubType || '', parkingSubTypeOther: row.parkingSubTypeOther || '', qty: 1 }]
  }
  // Backward compat: migrate old single leadType string to array
  if (!Array.isArray(form.value.leadTypes)) {
    form.value.leadTypes = row.leadType ? [row.leadType] : []
  }
  if (!form.value.leadTypeNotes || typeof form.value.leadTypeNotes !== 'object') {
    form.value.leadTypeNotes = {}
  }
  ltOpen.value = false
  showModal.value = true
}
async function save() {
  if (!form.value.clientName?.trim()) return ui.error('Client / Company name is required')
  if (form.value.value !== '' && form.value.value !== null && form.value.value !== undefined && isNaN(Number(form.value.value))) return ui.error('Deal value must be a number')
  if (form.value.value) form.value.value = Number(form.value.value)
  saving.value = true
  const prevStage = editing.value?.stage
  try {
    if (editing.value) {
      await edit(editing.value.id, form.value, `Updated lead ${form.value.clientName}`)
      ui.success('Lead updated')
    } else {
      await add({
        ...form.value,
        createdById: currentUserId.value,
        createdByName: currentUserName.value,
      }, `Added lead ${form.value.clientName}`)
      ui.success('Lead added')
    }
    // Auto-create project when lead is closed as Won
    if (form.value.stage === 'won' && prevStage !== 'won') {
      await createProjectFromLead({ ...form.value, id: editing.value?.id })
    }
    showModal.value = false
  } catch { ui.error('Save failed') }
  finally { saving.value = false }
}
function confirmDel(row) { pendingDeleteId = row.id; confirmRef.value?.open(`Delete lead "${row.clientName}"?`) }
async function doDelete() { await del(pendingDeleteId, 'Deleted lead'); ui.success('Lead deleted') }

const isOverdue = (d) => d && d < today
const stageBadge = (s) => stages.find(st => st.key === s)?.badge || 'badge-inactive'
const priorityBadge = (p) => ({ low: 'badge-active', medium: 'badge-info', high: 'badge-danger' }[p] || 'badge-inactive')
const formatCurrency = (v) => `Rs. ${(v || 0).toLocaleString('en-IN')}`
function toTitle(s) { return String(s||'').replace(/\b\w/g, c => c.toUpperCase()) }
// ── Leads Export ─────────────────────────────────────────────────────────────
const showLeadsExport = ref(false)
const leadsExportPeriod = ref('month')
const leadsExportType = ref('excel')
const leadsExporting = ref(false)

function triggerLeadsExport(type = 'excel') {
  leadsExportPeriod.value = 'month'
  leadsExportType.value = type
  showLeadsExport.value = true
}

const SOURCE_LABELS = {
  referral: 'Referral', website: 'Website', 'cold-call': 'Cold Call',
  exhibition: 'Exhibition', 'social-media': 'Social Media',
  'existing-client': 'Existing Client', bargeins: 'Bargeins',
  'existing-database': 'Existing Database', 'vendor-database': 'Vendor Provided Database',
  justdial: 'Justdial', indiamart: 'IndiaMART', 'direct-visit': 'Direct Visit',
}

async function exportLeadsExcel(rows, period) {
  // ── Style helpers ──────────────────────────────────────────────────────────
  const c = (v, s, t) => ({ v, s: s || {}, t: t || (typeof v === 'number' ? 'n' : 's') })

  const TITLE_S = {
    fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const SUB_S = {
    fill: { patternType: 'solid', fgColor: { rgb: '334155' } },
    font: { italic: true, color: { rgb: '94A3B8' }, sz: 9, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const HEAD_S = {
    fill: { patternType: 'solid', fgColor: { rgb: '6366F1' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
    alignment: { wrapText: true, horizontal: 'center', vertical: 'center' },
    border: { top: { style: 'thin', color: { rgb: '818CF8' } }, bottom: { style: 'medium', color: { rgb: '4338CA' } }, left: { style: 'thin', color: { rgb: '818CF8' } }, right: { style: 'thin', color: { rgb: '818CF8' } } },
  }
  const mkData = (even) => ({
    fill: { patternType: 'solid', fgColor: { rgb: even ? 'EEF2FF' : 'F8FAFC' } },
    font: { sz: 10, name: 'Calibri', color: { rgb: '1E293B' } },
    alignment: { wrapText: true, vertical: 'top' },
    border: { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } },
  })
  const mkNum = (even) => ({ ...mkData(even), font: { sz: 10, name: 'Calibri', bold: true, color: { rgb: '059669' } }, alignment: { horizontal: 'right', vertical: 'top' } })
  const mkCenter = (even) => ({ ...mkData(even), alignment: { horizontal: 'center', vertical: 'top', wrapText: true } })
  const FOOT_S = {
    fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } },
    font: { sz: 8, italic: true, color: { rgb: '64748B' }, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' },
  }

  const NCOLS = 20

  const now = new Date()
  const periodLabel = { today: 'Today', week: 'This Week', month: 'This Month', quarter: 'This Quarter', half: 'Half Year', year: 'This Year', all: 'All Time' }[period] || period
  const fmtD = (d) => { if (!d) return '—'; const dt = d?.toDate ? d.toDate() : new Date(d); if (isNaN(dt)) return '—'; return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}` }
  const blank = () => Array(NCOLS).fill(c('', {}))
  const fullCell = (v, s) => [c(v, s), ...Array(NCOLS - 1).fill(c('', s))]

  const HEADERS = [
    '#', 'Contact Person', 'Alt. Contact', 'Phone', 'Email', 'Address',
    'Stage', 'Priority', 'Lead Source',
    'Elevator Type(s)', 'Qty', 'Floors Served', 'Load Capacity', 'Special Note',
    'Deal Value (Rs.)', 'Assigned To', 'Next Follow-Up', 'Expected Close', 'Win %', 'Notes',
  ]

  const aoa = []
  const reportHeading = exportReportTitle.value?.trim() || 'AVANT LIFTS INDIA — SALES LEADS REPORT'
  aoa.push(fullCell(toTitle(reportHeading), TITLE_S))
  aoa.push(fullCell(`${periodLabel}  ·  Records: ${rows.length}  ·  Generated: ${fmtD(now)}`, SUB_S))
  aoa.push(blank())
  aoa.push(HEADERS.map(h => c(h, HEAD_S)))

  rows.forEach((lead, i) => {
    const even = i % 2 === 0
    const ds = mkData(even)
    const ns = mkNum(even)
    const cs = mkCenter(even)

    let typeStr = '', qtyStr = '', floorsStr = '', loadStr = '', noteStr = ''
    if (lead.multiRequirements && lead.requirements?.length) {
      typeStr  = lead.requirements.map(r => r.elevatorType || '—').join('\n')
      qtyStr   = lead.requirements.map(r => String(r.qty || 1)).join('\n')
      floorsStr = lead.requirements.map(r => r.floors || '—').join('\n')
      loadStr  = lead.requirements.map(r => r.loadCapacity || '—').join('\n')
      noteStr  = lead.requirements.map(r => r.specialNote || '—').join('\n')
    } else {
      typeStr  = lead.elevatorType || '—'
      qtyStr   = String(lead.elevatorQty || 1)
      floorsStr = lead.elevatorFloors || '—'
      loadStr  = lead.elevatorLoadCapacity || '—'
      noteStr  = lead.elevatorSpecialNote || '—'
    }

    const sourceLabel = SOURCE_LABELS[lead.leadSource] || (lead.leadSource === 'others' ? (lead.leadSourceOther || 'Others') : lead.leadSource || '—')

    aoa.push([
      c(i + 1, { ...cs, font: { sz: 10, name: 'Calibri', bold: true, color: { rgb: '6366F1' } } }, 'n'),
      c(lead.clientName || '—', ds),
      c(lead.contactPerson || '—', ds),
      c(lead.phone || '—', ds),
      c(lead.email || '—', ds),
      c(lead.address || '—', ds),
      c(lead.stage || 'new', cs),
      c(lead.priority || 'medium', cs),
      c(sourceLabel, ds),
      c(typeStr, ds),
      c(qtyStr, cs),
      c(floorsStr, ds),
      c(loadStr, ds),
      c(noteStr, ds),
      c(lead.value || 0, ns, 'n'),
      c(lead.assignedTo || '—', ds),
      c(lead.nextFollowUp ? fmtD(lead.nextFollowUp) : '—', cs),
      c(lead.expectedCloseDate ? fmtD(lead.expectedCloseDate) : '—', cs),
      c(`${lead.probability || 0}%`, cs),
      c(lead.notes || '—', ds),
    ])
  })

  aoa.push(blank())
  aoa.push(fullCell(`Avant Elevators EMS  ·  Confidential Sales Report  ·  ${now.getFullYear()}`, FOOT_S))

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: NCOLS - 1 } },
    { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: NCOLS - 1 } },
  ]
  ws['!cols'] = [
    { wch: 4 }, { wch: 22 }, { wch: 18 }, { wch: 15 }, { wch: 24 },
    { wch: 26 }, { wch: 13 }, { wch: 10 }, { wch: 20 }, { wch: 22 },
    { wch: 5 }, { wch: 14 }, { wch: 15 }, { wch: 24 }, { wch: 15 },
    { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 6 }, { wch: 30 },
  ]
  ws['!rows'] = [{ hpt: 36 }, { hpt: 18 }, { hpt: 6 }, { hpt: 28 }, ...rows.map(() => ({ hpt: 20 })), { hpt: 6 }, { hpt: 18 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Leads')
  await saveExcel(wb, `sales-leads-${period}-${now.toISOString().slice(0,10)}.xlsx`, ui)
}

async function runLeadsExport() {
  leadsExporting.value = true
  try {
    const { from, to } = getDateRange(leadsExportPeriod.value)
    const filtered = filterByDateRange(leads.value, 'createdAt', from, to)
    if (leadsExportType.value === 'pdf') {
      exportLeadsPdf(filtered, leadsExportPeriod.value)
      ui.success(`Exported ${filtered.length} leads to PDF.`)
    } else {
      exportLeadsExcel(filtered, leadsExportPeriod.value)
      ui.success(`Exported ${filtered.length} leads to Excel.`)
    }
    showLeadsExport.value = false
  } catch (e) {
    ui.error('Export failed.')
  } finally {
    leadsExporting.value = false
  }
}

async function exportLeadsPdf(rows, period) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const fmtD = (d) => { if (!d) return '—'; const dt = d?.toDate ? d.toDate() : new Date(d); if (isNaN(dt)) return '—'; return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}` }
  const periodLabel = { today: 'Today', week: 'This Week', month: 'This Month', quarter: 'This Quarter', half: 'Half Year', year: 'This Year', all: 'All Time' }[period] || period
  const now = new Date()

  // Header
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, 297, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  const pdfTitle = exportReportTitle.value?.trim() || 'Avant Elevators — Sales Leads Report'
  doc.text(pdfTitle, 148, 10, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Period: ${periodLabel}   |   Generated: ${fmtD(now)}   |   Total: ${rows.length} leads`, 148, 17, { align: 'center' })

  const body = rows.map((lead, i) => {
    let typeStr, qtyStr, floorsStr, loadStr, noteStr
    if (lead.multiRequirements && lead.requirements?.length) {
      typeStr = lead.requirements.map(r => r.elevatorType || '—').join('\n')
      qtyStr = lead.requirements.map(r => r.qty || 1).join('\n')
      floorsStr = lead.requirements.map(r => r.floors || '—').join('\n')
      loadStr = lead.requirements.map(r => r.loadCapacity || '—').join('\n')
      noteStr = lead.requirements.map(r => r.specialNote || '—').join('\n')
    } else {
      typeStr = lead.elevatorType || '—'
      qtyStr = String(lead.elevatorQty || 1)
      floorsStr = lead.elevatorFloors || '—'
      loadStr = lead.elevatorLoadCapacity || '—'
      noteStr = lead.elevatorSpecialNote || '—'
    }
    const sourceLabel = SOURCE_LABELS[lead.leadSource] || (lead.leadSource === 'others' ? (lead.leadSourceOther || 'Others') : lead.leadSource || '—')
    return [
      i + 1,
      lead.clientName || '—',
      lead.contactPerson || '—',
      lead.phone || '—',
      toTitle(lead.stage || 'New'),
      toTitle(lead.priority || 'Medium'),
      sourceLabel,
      typeStr,
      qtyStr,
      floorsStr,
      loadStr,
      `Rs. ${(lead.value || 0).toLocaleString('en-IN')}`,
      lead.assignedTo || '—',
      fmtD(lead.nextFollowUp),
      fmtD(lead.expectedCloseDate),
    ]
  })

  autoTable(doc, {
    startY: 25,
    head: [['#', 'Client', 'Contact', 'Phone', 'Stage', 'Priority', 'Source', 'Elevator Type', 'Qty', 'Floors', 'Load', 'Value', 'Assigned To', 'Follow-up', 'Close Date']],
    body,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [238, 242, 255] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 28 },
      2: { cellWidth: 24 },
      3: { cellWidth: 22 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 16 },
      6: { cellWidth: 22 },
      7: { cellWidth: 28 },
      8: { halign: 'center', cellWidth: 10 },
      9: { cellWidth: 18 },
      10: { cellWidth: 18 },
      11: { halign: 'right', cellWidth: 18 },
      12: { cellWidth: 22 },
      13: { halign: 'center', cellWidth: 18 },
      14: { halign: 'center', cellWidth: 18 },
    },
    margin: { left: 8, right: 8 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages()
      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.text(`Page ${data.pageNumber} of ${pageCount}  |  Avant Elevators EMS  |  Confidential`, 148, doc.internal.pageSize.height - 6, { align: 'center' })
    },
  })

  await savePDF(doc, `sales-leads-${period}-${now.toISOString().slice(0,10)}.pdf`, ui)
}

function formatDate(d) {
  if (!d) return '—'
  const dt = d?.toDate ? d.toDate() : new Date(d)
  if (isNaN(dt.getTime())) return '—'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${dt.getFullYear()}`
}
</script>

<style scoped>
/* ── Lead Type multi-select ──────────────────────────────────────────────── */
.lt-trigger {
  position: relative;
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  min-height: 40px; padding: 6px 32px 6px 10px;
  background: var(--ct-input, rgba(255,255,255,.05));
  border: 1px solid var(--ct-border); border-radius: 8px;
  cursor: pointer; transition: border-color .15s;
}
[data-theme="light"] .lt-trigger { background: #ffffff; color: #1e293b; }
.lt-trigger:hover { border-color: var(--ct-accent); }
.lt-placeholder { font-size: 13px; color: var(--ct-muted); }
.lt-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 99px; font-size: 12px; font-weight: 600;
  background: rgba(99,102,241,.15); color: var(--ct-accent);
  border: 1px solid rgba(99,102,241,.25);
}
.lt-chip-x {
  background: none; border: none; color: inherit; cursor: pointer;
  padding: 0; line-height: 1; font-size: 14px; opacity: .7;
}
.lt-chip-x:hover { opacity: 1; }
.lt-arrow { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--ct-muted); transition: transform .2s; pointer-events: none; }
.lt-panel {
  margin-top: 4px;
  background: #1a2236;
  border: 1px solid var(--ct-border); border-radius: 10px;
  overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.4);
  z-index: 50;
}
[data-theme="light"] .lt-panel { background: #ffffff; box-shadow: 0 8px 24px rgba(0,0,0,.15); }
.lt-option {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; font-size: 13px; color: var(--ct-sub);
  cursor: pointer; transition: background .12s; border-bottom: 1px solid rgba(0,0,0,.06);
  user-select: none;
}
[data-theme="light"] .lt-option { color: #374151; border-bottom-color: rgba(0,0,0,.08); }
.lt-option:last-child { border-bottom: none; }
.lt-option:hover { background: rgba(255,255,255,.05); }
[data-theme="light"] .lt-option:hover { background: rgba(0,0,0,.04); }
.lt-option.selected { background: rgba(99,102,241,.1); color: var(--ct-accent); font-weight: 600; }
[data-theme="light"] .lt-option.selected { background: rgba(99,102,241,.08); color: #4f46e5; }
.lt-check { display: flex; align-items: center; color: inherit; }
.lt-notes {
  margin-top: 8px; display: flex; flex-direction: column; gap: 8px;
}
.lt-note-row { display: flex; align-items: center; gap: 10px; }
.lt-note-label {
  font-size: 11px; font-weight: 600; color: var(--ct-accent);
  white-space: nowrap; min-width: 130px;
}
.lt-note-input { flex: 1; }

.page-container { padding: 28px; }
.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  align-items: start;
}
.pipeline-col {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 14px;
  overflow: hidden;
}
.pipeline-col-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(255,255,255,0.02);
}
.pipeline-col-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 60px; }
.lead-card {
  padding: 12px; border-radius: 10px;
  background: rgba(255,255,255,0.035);
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer; transition: all 0.18s;
}
.lead-card:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(99,102,241,0.2);
  transform: translateY(-1px);
}

/* Lead card text */
.lead-name { font-weight: 600; color:var(--ct-primary); margin-bottom: 4px; }
.lead-sub { font-size: 12px; color:var(--ct-muted); margin-bottom: 8px; }

/* Table cell text */
.tbl-name { font-weight: 600; color:var(--ct-primary); }
.tbl-source { font-size: 11px; color:var(--ct-muted); margin-top: 2px; }
.tbl-contact { color:var(--ct-sub); font-size: 12px; }
.tbl-meta { color:var(--ct-muted); font-size: 11px; }
.tbl-value { color:var(--ct-accent); font-weight: 600; }

/* Light theme overrides */
[data-theme="light"] .pipeline-col {
  background: rgba(255,255,255,0.85);
  border-color: rgba(0,0,0,0.08);
}
[data-theme="light"] .pipeline-col-header {
  border-bottom-color: rgba(0,0,0,0.06);
  background: rgba(0,0,0,0.02);
}
[data-theme="light"] .lead-card {
  background: rgba(255,255,255,0.9);
  border-color: rgba(0,0,0,0.08);
}
[data-theme="light"] .lead-card:hover {
  background: #fff;
  border-color: rgba(99,102,241,0.3);
}
[data-theme="light"] .lead-name { color: #1e293b; }
[data-theme="light"] .tbl-name { color: #1e293b; }
[data-theme="light"] .tbl-contact { color: #374151; }
[data-theme="light"] .tbl-value { color: #6366f1; }
</style>
