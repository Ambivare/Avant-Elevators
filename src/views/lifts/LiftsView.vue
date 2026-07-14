<template>
  <div class="lifts-view">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <ChevronsUpDown :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Lifts
        </h1>
        <p class="page-sub">Every elevator, every spec — one unified registry.</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-nav" style="margin-bottom:24px;">
      <button :class="['tab-btn', activeTab === 'directory' && 'active']" @click="activeTab = 'directory'">
        <Layers :size="14" /> Lift Directory
        <span class="badge badge-info" style="margin-left:4px;">{{ allLifts.length }}</span>
      </button>
      <button :class="['tab-btn', activeTab === 'health' && 'active']" @click="activeTab = 'health'">
        <Activity :size="14" /> Lift Health
        <span v-if="problemLifts.length" class="badge badge-danger" style="margin-left:4px;">{{ problemLifts.length }}</span>
      </button>
    </div>

    <!-- ── DIRECTORY TAB ─────────────────────────────────────────── -->
    <div v-if="activeTab === 'directory'">
      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
        <div class="search-box" style="flex:1;min-width:220px;">
          <Search :size="14" class="search-icon" />
          <input v-model="search" class="input" placeholder="Search lift ID, project, OEM, type…" />
        </div>
        <select v-model="filterType" class="input" style="width:180px;">
          <option value="">All Types</option>
          <option v-for="t in elevatorTypes" :key="t" :value="t">{{ t }}</option>
        </select>
        <div style="display:flex;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:3px;">
          <button :class="['btn-sm', dirView === 'tree' ? 'btn-primary' : 'btn-secondary']" style="border-radius:7px;" @click="dirView = 'tree'">
            <Layers :size="13" /> Tree
          </button>
          <button :class="['btn-sm', dirView === 'grid' ? 'btn-primary' : 'btn-secondary']" style="border-radius:7px;" @click="dirView = 'grid'">
            <LayoutGrid :size="13" /> Grid
          </button>
        </div>
      </div>

      <!-- TREE VIEW -->
      <div v-if="dirView === 'tree'" style="display:flex;flex-direction:column;gap:12px;">
        <div v-if="!filteredProjects.length" class="glass empty-state" style="padding:60px;text-align:center;">
          <ChevronsUpDown :size="36" style="opacity:.3;margin:0 auto 16px;" />
          <p>No lifts found.</p>
        </div>
        <div v-for="proj in filteredProjects" :key="proj.id" class="glass" style="overflow:hidden;">
          <div
            style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;"
            @click="toggleProject(proj.id)"
          >
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:38px;height:38px;background:rgba(99,102,241,0.12);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <Building2 :size="17" style="color:#818cf8;" />
              </div>
              <div>
                <div style="font-weight:600;color:var(--ct-primary);font-size:14px;">{{ proj.projectName }}</div>
                <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">{{ proj.clientName }} &bull; {{ proj.city || proj.address || '—' }}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge badge-info">{{ getProjectLiftCount(proj) }} lifts</span>
              <span :class="['badge', statusBadge(proj.status)]">{{ proj.status || 'active' }}</span>
              <ChevronDown v-if="expandedProjects[proj.id]" :size="16" style="color:var(--ct-muted);" />
              <ChevronRight v-else :size="16" style="color:var(--ct-muted);" />
            </div>
          </div>

          <div v-if="expandedProjects[proj.id]" style="border-top:1px solid rgba(255,255,255,0.06);padding:14px 18px;">
            <div v-for="(bld, bi) in (proj.buildings || [])" :key="bi" style="margin-bottom:18px;">
              <div style="font-size:11px;font-weight:700;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                <Building2 :size="11" /> {{ bld.name || ('Building ' + (bi + 1)) }}
              </div>
              <div v-for="(wing, wi) in (bld.wings || [])" :key="wi" style="margin-bottom:12px;padding-left:16px;border-left:2px solid rgba(99,102,241,0.2);">
                <div style="font-size:11px;color:var(--ct-muted);margin-bottom:8px;font-weight:500;">
                  {{ wing.name || ('Wing ' + (wi + 1)) }}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  <div
                    v-for="lift in (wing.lifts || [])"
                    :key="lift.id"
                    @click="openLiftDetail(lift, proj, bld.name, wing.name)"
                    :style="`padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid ${getLiftBorderColor(lift.id, proj.id)};border-radius:10px;cursor:pointer;min-width:150px;transition:border-color .15s;`"
                  >
                    <div style="font-size:12px;font-weight:700;color:var(--ct-accent);font-family:monospace;">{{ lift.id }}</div>
                    <div style="font-size:12px;color:var(--ct-sub);margin-top:3px;">{{ lift.type || '—' }}</div>
                    <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ lift.oem || '—' }} &bull; {{ lift.stops || '—' }} stops</div>
                    <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
                      <span v-if="getHealthScore(lift.id, proj.id) > 0" :class="['badge', getHealthScore(lift.id, proj.id) >= 4 ? 'badge-danger' : 'badge-warning']" style="font-size:9px;">
                        ⚠ {{ getHealthScore(lift.id, proj.id) }} issues
                      </span>
                      <span v-else class="badge badge-active" style="font-size:9px;">✓ healthy</span>
                      <span v-if="getLiftCertStatus(lift.id, proj.id) === 'expired'"  class="badge badge-danger"   style="font-size:9px;">cert expired</span>
                      <span v-else-if="getLiftCertStatus(lift.id, proj.id) === 'expiring'" class="badge badge-warning" style="font-size:9px;">cert expiring</span>
                      <span v-else-if="getLiftCertStatus(lift.id, proj.id) === 'valid'"   class="badge badge-active"  style="font-size:9px;">cert ok</span>
                      <span v-else-if="getLiftCertStatus(lift.id, proj.id) === 'incomplete'" class="badge badge-inactive" style="font-size:9px;">cert missing</span>
                    </div>
                  </div>
                </div>
                <div v-if="!(wing.lifts || []).length" style="font-size:11px;color:var(--ct-muted);font-style:italic;">No lifts configured in this wing.</div>
              </div>
            </div>
            <div v-if="!(proj.buildings || []).length" style="text-align:center;padding:16px;color:var(--ct-muted);font-size:12px;">
              No building / lift configuration added to this project.
            </div>
          </div>
        </div>
      </div>

      <!-- FLAT GRID VIEW -->
      <div v-if="dirView === 'grid'">
        <div v-if="!filteredLifts.length" class="glass empty-state" style="padding:60px;text-align:center;">
          <ChevronsUpDown :size="36" style="opacity:.3;margin:0 auto 16px;" />
          <p>No lifts found for the selected filters.</p>
        </div>
        <div v-else style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Lift ID</th>
                <th>Project</th>
                <th>Location</th>
                <th>Type</th>
                <th>OEM</th>
                <th>Capacity</th>
                <th>Drive</th>
                <th>Stops</th>
                <th>Door</th>
                <th>Machine Room</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="l in filteredLifts"
                :key="l.liftId + l.projectId"
                @click="openLiftDetail(l.lift, l.project, l.buildingName, l.wingName)"
                style="cursor:pointer;"
              >
                <td style="font-family:monospace;font-size:12px;font-weight:700;color:var(--ct-accent);">{{ l.liftId }}</td>
                <td>
                  <div style="font-weight:500;color:var(--ct-primary);">{{ l.projectName }}</div>
                  <div style="font-size:11px;color:var(--ct-muted);">{{ l.clientName }}</div>
                </td>
                <td style="font-size:12px;color:var(--ct-sub);">{{ [l.buildingName, l.wingName].filter(Boolean).join(' › ') }}</td>
                <td><span class="badge badge-info">{{ l.type || '—' }}</span></td>
                <td style="color:var(--ct-sub);">{{ l.oem || '—' }}</td>
                <td style="color:var(--ct-sub);">{{ l.capacity ? l.capacity + ' kg' : '—' }}</td>
                <td style="color:var(--ct-sub);">{{ l.drive || '—' }}</td>
                <td style="color:var(--ct-sub);text-align:center;">{{ l.stops || '—' }}</td>
                <td style="color:var(--ct-sub);">{{ l.doorType || '—' }}</td>
                <td style="color:var(--ct-sub);">{{ l.machineRoom || '—' }}</td>
                <td>
                  <span v-if="getHealthScore(l.liftId, l.projectId) === 0" class="badge badge-active">Healthy</span>
                  <span v-else-if="getHealthScore(l.liftId, l.projectId) <= 3" class="badge badge-warning">{{ getHealthScore(l.liftId, l.projectId) }} issues</span>
                  <span v-else class="badge badge-danger">{{ getHealthScore(l.liftId, l.projectId) }} issues</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── HEALTH TAB ─────────────────────────────────────────────── -->
    <div v-if="activeTab === 'health'">
      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;">
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:var(--ct-accent);">{{ allLifts.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Total Lifts</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#4ade80;">{{ healthyLifts.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Healthy</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#fbbf24;">{{ warningLifts.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Needs Attention</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#f87171;">{{ problemLifts.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Problem Lifts</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:var(--ct-sub);">{{ totalRepairs }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Total Repairs</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:var(--ct-sub);">{{ totalComplaints }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Complaints</div>
        </div>
      </div>

      <!-- Health filter search -->
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <div class="search-box" style="flex:1;min-width:200px;">
          <Search :size="14" class="search-icon" />
          <input v-model="healthSearch" class="input" placeholder="Search lift ID or project…" />
        </div>
        <div style="display:flex;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:3px;">
          <button :class="['btn-sm', healthFilter === 'all' ? 'btn-primary' : 'btn-secondary']" style="border-radius:7px;" @click="healthFilter = 'all'">All</button>
          <button :class="['btn-sm', healthFilter === 'problem' ? 'btn-danger' : 'btn-secondary']" style="border-radius:7px;" @click="healthFilter = 'problem'">Problem</button>
          <button :class="['btn-sm', healthFilter !== 'warning' && 'btn-secondary']" :style="`border-radius:7px;${healthFilter === 'warning' ? 'background:#b45309;color:#fff;border-color:#b45309;' : ''}`" @click="healthFilter = 'warning'">Attention</button>
          <button :class="['btn-sm', healthFilter === 'healthy' ? 'btn-success' : 'btn-secondary']" style="border-radius:7px;" @click="healthFilter = 'healthy'">Healthy</button>
        </div>
      </div>

      <div v-if="!filteredHealthLifts.length" class="glass empty-state" style="padding:60px;text-align:center;">
        <CheckCircle :size="36" style="opacity:.3;margin:0 auto 16px;color:#4ade80;" />
        <p>{{ healthFilter === 'healthy' ? 'All lifts in this filter look healthy.' : 'No lifts with issues found.' }}</p>
      </div>

      <div v-else style="display:flex;flex-direction:column;gap:10px;">
        <div
          v-for="(l, idx) in filteredHealthLifts"
          :key="l.projectId + '__' + l.liftId"
          class="glass"
          style="padding:16px 18px;display:flex;align-items:flex-start;gap:14px;cursor:pointer;"
          @click="openLiftDetail(l.lift, l.project, l.buildingName, l.wingName)"
        >
          <!-- Rank number -->
          <div style="font-size:18px;font-weight:700;color:var(--ct-muted);min-width:28px;text-align:center;padding-top:3px;">#{{ idx + 1 }}</div>

          <!-- Main info -->
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <span style="font-family:monospace;font-size:14px;font-weight:700;color:var(--ct-accent);">{{ l.liftId }}</span>
              <span :class="['badge', l.score >= 6 ? 'badge-danger' : l.score >= 3 ? 'badge-warning' : l.score > 0 ? 'badge-info' : 'badge-active']">
                {{ l.score === 0 ? 'Healthy' : l.score + ' pts' }}
              </span>
              <span class="badge badge-info" style="font-size:10px;">{{ l.type || '—' }}</span>
            </div>
            <div style="font-size:12px;color:var(--ct-sub);">
              {{ l.projectName }} &bull; {{ [l.buildingName, l.wingName].filter(Boolean).join(' › ') }}
            </div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ l.oem || '—' }} &bull; {{ l.stops || '—' }} stops &bull; {{ l.drive || '—' }}</div>

            <!-- Issue breakdown tags -->
            <div v-if="l.score > 0" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
              <span v-if="l.repairs.length" class="badge badge-warning">{{ l.repairs.length }} repair{{ l.repairs.length > 1 ? 's' : '' }}</span>
              <span v-if="l.complaints.length" class="badge badge-danger">{{ l.complaints.length }} complaint{{ l.complaints.length > 1 ? 's' : '' }}</span>
              <span v-for="it in l.topIssueTypes" :key="it" class="badge badge-info" style="font-size:10px;">{{ it }}</span>
            </div>
          </div>

          <!-- Score bar -->
          <div style="flex-shrink:0;width:90px;text-align:right;">
            <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;margin-bottom:4px;">
              <div
                :style="`width:${l.score === 0 ? 100 : Math.min(100, (l.score / 12) * 100)}%;height:100%;border-radius:3px;background:${l.score >= 6 ? '#f87171' : l.score >= 3 ? '#fbbf24' : l.score > 0 ? '#818cf8' : '#4ade80'};`"
              ></div>
            </div>
            <div style="font-size:10px;color:var(--ct-muted);">{{ l.score === 0 ? 'No issues' : l.score + ' / 12+' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── LIFT DETAIL MODAL ──────────────────────────────────────── -->
    <AppModal v-model="showLiftDetail" :title="selectedLift?.id || 'Lift Details'" width="640px">
      <template v-if="selectedLift">
        <div style="display:flex;flex-direction:column;gap:14px;">
          <!-- Context banner -->
          <div style="padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
            <div style="font-size:11px;color:var(--ct-accent);margin-bottom:2px;">{{ selectedLiftProject?.projectName }}</div>
            <div style="font-size:15px;font-weight:700;color:var(--ct-primary);">{{ selectedLift.id }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">
              {{ [selectedLiftBuilding, selectedLiftWing].filter(Boolean).join(' › ') }}
              <span v-if="selectedLiftProject?.city"> &bull; {{ selectedLiftProject.city }}</span>
            </div>
          </div>

          <!-- Config grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div v-for="field in liftConfigFields" :key="field.key" class="glass" style="padding:10px 12px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">{{ field.label }}</div>
              <div style="font-size:13px;color:var(--ct-sub);">{{ selectedLift[field.key] || '—' }}</div>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="selectedLift.notes" style="padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Notes</div>
            <div style="font-size:12px;color:var(--ct-sub);">{{ selectedLift.notes }}</div>
          </div>

          <!-- Health summary for this lift -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <div v-if="selectedLiftRepairs.length" style="padding:8px 14px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:10px;font-size:12px;color:#fbbf24;">
              🔧 {{ selectedLiftRepairs.length }} repair{{ selectedLiftRepairs.length > 1 ? 's' : '' }} logged
            </div>
            <div v-if="selectedLiftComplaints.length" style="padding:8px 14px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.2);border-radius:10px;font-size:12px;color:#f87171;">
              ⚠ {{ selectedLiftComplaints.length }} complaint{{ selectedLiftComplaints.length > 1 ? 's' : '' }}
            </div>
            <div v-if="!selectedLiftRepairs.length && !selectedLiftComplaints.length" style="padding:8px 14px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:10px;font-size:12px;color:#4ade80;">
              ✓ No repairs or complaints on record
            </div>
          </div>

          <!-- Certificate status for this lift — always shown -->
          <div style="padding:12px 14px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);border-radius:10px;">
            <div style="font-size:11px;font-weight:700;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              <ShieldCheck :size="12" /> Lift Certificates
            </div>
            <div v-if="!selectedLiftCert" style="font-size:12px;color:var(--ct-muted);font-style:italic;padding:6px 0;">
              No certificate registered for this lift. <span style="color:var(--ct-accent);cursor:pointer;" @click="navigateToLiftCert">Add one →</span>
            </div>
            <div v-else style="display:flex;flex-direction:column;gap:6px;font-size:11px;">
              <div v-for="cert in [
                { label: 'EI Certificate', expiry: selectedLiftCert.eiExpiryDate, docUrl: selectedLiftCert.eiDocUrl },
                { label: 'PWD License',    expiry: selectedLiftCert.pwdExpiryDate, docUrl: selectedLiftCert.pwdDocUrl },
                { label: 'Insurance',      expiry: selectedLiftCert.insuranceExpiryDate, docUrl: selectedLiftCert.insuranceDocUrl },
              ]" :key="cert.label" style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(255,255,255,0.03);border-radius:6px;">
                <span style="color:var(--ct-muted);min-width:90px;">{{ cert.label }}</span>
                <span style="display:flex;align-items:center;gap:8px;">
                  <span :style="`font-weight:500;color:${certDateStatus(cert.expiry) === 'expired' ? '#f87171' : certDateStatus(cert.expiry) === 'expiring' ? '#fbbf24' : certDateStatus(cert.expiry) === 'valid' ? '#4ade80' : '#64748b'};`">
                    {{ cert.expiry || '—' }}
                    <span v-if="certDateStatus(cert.expiry) === 'expired'" style="font-size:10px;margin-left:3px;">(Expired)</span>
                    <span v-else-if="certDateStatus(cert.expiry) === 'expiring'" style="font-size:10px;margin-left:3px;">(Expiring)</span>
                    <span v-else-if="certDateStatus(cert.expiry) === 'missing'" style="font-size:10px;color:#64748b;margin-left:3px;">Not set</span>
                  </span>
                  <a v-if="cert.docUrl" :href="cert.docUrl" target="_blank" style="color:var(--ct-accent);text-decoration:none;font-size:10px;padding:2px 6px;border:1px solid rgba(99,102,241,0.3);border-radius:4px;" @click.stop>↗ PDF</a>
                </span>
              </div>
            </div>
          </div>

          <!-- Activity timeline for this lift -->
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--ct-primary);margin-bottom:10px;">Activity History</div>
            <div v-if="!selectedLiftActivities.length" style="text-align:center;padding:20px;color:var(--ct-muted);font-size:12px;">
              No repairs or complaints logged for this lift ID.
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div
                v-for="act in selectedLiftActivities"
                :key="act.id"
                style="padding:10px 14px;border-radius:10px;display:flex;align-items:flex-start;gap:10px;"
                :style="`background:${act._type === 'complaint' ? 'rgba(248,113,113,0.05)' : 'rgba(251,191,36,0.05)'};border:1px solid ${act._type === 'complaint' ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.12)'};`"
              >
                <span :class="['badge', act._type === 'complaint' ? 'badge-danger' : 'badge-warning']" style="flex-shrink:0;margin-top:1px;">
                  {{ act._type === 'complaint' ? 'Complaint' : 'Repair' }}
                </span>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:12px;font-weight:600;color:var(--ct-sub);">
                    {{ act.repairType || act.issueType || act.faultDescription || act.description || '—' }}
                  </div>
                  <div v-if="act.faultDescription && act.repairType" style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ act.faultDescription }}</div>
                  <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">
                    {{ formatDate(act.repairDate || act.scheduledDate || act.createdAt) }}
                    <span v-if="act.status"> &bull; {{ act.status }}</span>
                    <span v-if="(act.technicians || []).length"> &bull; {{ act.technicians.join(', ') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn-secondary" style="display:flex;align-items:center;gap:6px;position:relative;" :disabled="navigatingToCerts" @click="navigateToLiftCert">
          <span v-if="navigatingToCerts" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#818cf8;border-radius:50%;animation:spin 0.7s linear infinite;"></span>
          <ShieldCheck v-else :size="14" />
          {{ navigatingToCerts ? 'Opening…' : 'Certificates' }}
        </button>
        <button class="btn-primary" style="display:flex;align-items:center;gap:6px;" @click="openQr(selectedLift, selectedLiftProject?.id)">
          <QrCode :size="14" /> QR Code
        </button>
        <button class="btn-secondary" @click="showLiftDetail = false">Close</button>
      </template>
    </AppModal>

    <!-- QR Code Modal -->
    <AppModal v-model="showQrModal" title="Lift QR Code" width="340px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0;">
        <div style="font-size:12px;color:var(--ct-muted);text-align:center;max-width:260px;line-height:1.6;">
          Scan to report a complaint for <strong style="color:var(--ct-accent);">{{ qrLiftLabel }}</strong>.
          Opens the app if installed, otherwise opens the web complaint form.
        </div>
        <div style="padding:16px;background:#fff;border-radius:16px;display:inline-block;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
          <img v-if="qrDataUrl" :src="qrDataUrl" style="width:220px;height:220px;display:block;" />
        </div>
        <div style="font-size:11px;color:var(--ct-muted);font-family:monospace;text-align:center;">{{ qrLiftLabel }}</div>
      </div>
      <template #footer>
        <button class="btn-primary" style="display:flex;align-items:center;gap:6px;" @click="downloadQr">
          <Download :size="13" /> Download PNG
        </button>
        <button class="btn-secondary" @click="showQrModal = false">Close</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChevronsUpDown, Search, Building2, ChevronDown, ChevronRight,
  Layers, LayoutGrid, Activity, CheckCircle, QrCode, Download, ShieldCheck,
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { useCollection } from '@/composables/useCollection'
import { Collections } from '@/firebase/collections'
import QRCode from 'qrcode'

const route = useRoute()
const router = useRouter()

const { items: allProjects } = useCollection(Collections.PROJECTS)
const { items: repairs } = useCollection(Collections.REPAIRS)
const { items: complaints } = useCollection(Collections.COMPLAINTS)
const { items: liftCertificates } = useCollection(Collections.LIFT_CERTIFICATES)

const activeTab = ref('directory')
const dirView = ref('tree')
const search = ref('')
const filterType = ref('')
const healthSearch = ref('')
const healthFilter = ref('all')
const expandedProjects = ref({})

// ── Flatten all lifts ───────────────────────────────────────────────────
const allLifts = computed(() => {
  const result = []
  for (const proj of allProjects.value) {
    for (const bld of (proj.buildings || [])) {
      for (const wing of (bld.wings || [])) {
        for (const lift of (wing.lifts || [])) {
          result.push({
            liftId: lift.id,
            lift,
            projectId: proj.id,
            projectName: proj.projectName,
            clientName: proj.clientName,
            project: proj,
            buildingName: bld.name || '',
            wingName: wing.name || '',
            type: lift.type,
            oem: lift.oem,
            capacity: lift.capacity,
            speed: lift.speed,
            drive: lift.drive,
            stops: lift.stops,
            doorType: lift.doorType,
            machineRoom: lift.machineRoom,
          })
        }
      }
    }
  }
  return result
})

const projectsWithLifts = computed(() => allProjects.value.filter(p => getProjectLiftCount(p) > 0))

function getProjectLiftCount(proj) {
  let count = 0
  for (const bld of (proj.buildings || [])) for (const wing of (bld.wings || [])) count += (wing.lifts || []).length
  return count
}

// ── Health map: "projectId__liftId" → {repairs[], complaints[]} ────────
// Only counts records with explicit liftIds — keeps health scores accurate.
// Project-level records (no liftIds) are shown in the modal separately.
const healthMap = computed(() => {
  const map = {}
  for (const r of repairs.value) {
    const pid = r.projectId || ''
    for (const id of (r.liftSelection?.liftIds || [])) {
      const key = pid + '__' + id
      if (!map[key]) map[key] = { repairs: [], complaints: [] }
      map[key].repairs.push(r)
    }
  }
  for (const c of complaints.value) {
    const pid = c.projectId || ''
    for (const id of (c.liftSelection?.liftIds || [])) {
      const key = pid + '__' + id
      if (!map[key]) map[key] = { repairs: [], complaints: [] }
      map[key].complaints.push(c)
    }
  }
  return map
})

function getHealthScore(liftId, projectId) {
  const key = (projectId || '') + '__' + liftId
  const e = healthMap.value[key]
  if (!e) return 0
  return e.complaints.length * 2 + e.repairs.length
}

function getLiftBorderColor(liftId, projectId) {
  const s = getHealthScore(liftId, projectId)
  if (s >= 4) return 'rgba(248,113,113,0.35)'
  if (s >= 2) return 'rgba(251,191,36,0.25)'
  return 'rgba(255,255,255,0.08)'
}

// ── Certificate helpers ─────────────────────────────────────────────────
function getCertRecord(liftId, projectId) {
  return liftCertificates.value.find(c =>
    (c.liftNumber === liftId || (c.liftSelection?.liftIds || []).includes(liftId)) &&
    (!c.projectId || c.projectId === projectId)
  ) || null
}

function certDateStatus(dateStr) {
  if (!dateStr) return 'missing'
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr)
  if (d < today) return 'expired'
  const soon = new Date(today); soon.setDate(soon.getDate() + 30)
  if (d <= soon) return 'expiring'
  return 'valid'
}

function getLiftCertStatus(liftId, projectId) {
  const cert = getCertRecord(liftId, projectId)
  if (!cert) return null
  const statuses = [
    certDateStatus(cert.eiExpiryDate),
    certDateStatus(cert.pwdExpiryDate),
    certDateStatus(cert.insuranceExpiryDate),
  ]
  if (statuses.includes('expired'))  return 'expired'
  if (statuses.includes('expiring')) return 'expiring'
  if (statuses.includes('missing'))  return 'incomplete'
  return 'valid'
}

// ── Totals ──────────────────────────────────────────────────────────────
const totalRepairs = computed(() => {
  const liftKeys = new Set(allLifts.value.map(l => l.projectId + '__' + l.liftId))
  const projectIds = new Set(allLifts.value.map(l => l.projectId))
  return repairs.value.filter(r => {
    const liftIds = r.liftSelection?.liftIds || []
    if (liftIds.length > 0) return liftIds.some(id => liftKeys.has((r.projectId || '') + '__' + id))
    return projectIds.has(r.projectId || '')
  }).length
})
const totalComplaints = computed(() => {
  const liftKeys = new Set(allLifts.value.map(l => l.projectId + '__' + l.liftId))
  const projectIds = new Set(allLifts.value.map(l => l.projectId))
  return complaints.value.filter(c => {
    const liftIds = c.liftSelection?.liftIds || []
    if (liftIds.length > 0) return liftIds.some(id => liftKeys.has((c.projectId || '') + '__' + id))
    return projectIds.has(c.projectId || '')
  }).length
})

// ── Elevator type options ────────────────────────────────────────────────
const elevatorTypes = [
  'Passenger', 'Goods / Freight', 'Hospital / Bed Elevator',
  'Dumbwaiter', 'Hydraulic', 'MRL (Machine Room Less)',
  'Home Lift', 'Observation / Glass', 'Service Elevator',
  'Fire Evacuation Elevator', 'Car Parking System',
  'Capsule / Panoramic', 'Escalator', 'Other',
]

// ── Directory computed ──────────────────────────────────────────────────
const filteredLifts = computed(() => {
  let list = allLifts.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(l =>
      l.liftId?.toLowerCase().includes(q) ||
      l.projectName?.toLowerCase().includes(q) ||
      l.oem?.toLowerCase().includes(q) ||
      l.type?.toLowerCase().includes(q) ||
      l.buildingName?.toLowerCase().includes(q) ||
      l.wingName?.toLowerCase().includes(q)
    )
  }
  if (filterType.value) list = list.filter(l => l.type === filterType.value)
  return list
})

const filteredProjects = computed(() => {
  if (!search.value && !filterType.value) return projectsWithLifts.value
  const matchingIds = new Set(filteredLifts.value.map(l => l.projectId))
  return projectsWithLifts.value.filter(p => matchingIds.has(p.id))
})

function toggleProject(id) {
  expandedProjects.value[id] = !expandedProjects.value[id]
}

// ── Health computed ─────────────────────────────────────────────────────
const rankedLifts = computed(() =>
  allLifts.value
    .map(l => {
      const key = (l.projectId || '') + '__' + l.liftId
      const e = healthMap.value[key] || { repairs: [], complaints: [] }
      const score = e.complaints.length * 2 + e.repairs.length
      const allIssues = [
        ...e.repairs.map(r => r.repairType).filter(Boolean),
        ...e.complaints.map(c => c.issueType).filter(Boolean),
      ]
      const ic = {}
      for (const i of allIssues) ic[i] = (ic[i] || 0) + 1
      const topIssueTypes = Object.entries(ic).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
      return { ...l, repairs: e.repairs, complaints: e.complaints, score, topIssueTypes }
    })
    .sort((a, b) => b.score - a.score)
)

const healthyLifts = computed(() => allLifts.value.filter(l => getHealthScore(l.liftId, l.projectId) === 0))
const warningLifts = computed(() => allLifts.value.filter(l => { const s = getHealthScore(l.liftId, l.projectId); return s >= 1 && s <= 3 }))
const problemLifts = computed(() => allLifts.value.filter(l => getHealthScore(l.liftId, l.projectId) >= 4))

const filteredHealthLifts = computed(() => {
  let list = rankedLifts.value
  if (healthSearch.value) {
    const q = healthSearch.value.toLowerCase()
    list = list.filter(l => l.liftId?.toLowerCase().includes(q) || l.projectName?.toLowerCase().includes(q))
  }
  if (healthFilter.value === 'problem') list = list.filter(l => l.score >= 4)
  else if (healthFilter.value === 'warning') list = list.filter(l => l.score >= 1 && l.score <= 3)
  else if (healthFilter.value === 'healthy') list = list.filter(l => l.score === 0)
  return list
})

// ── Lift detail modal ───────────────────────────────────────────────────
const showLiftDetail = ref(false)
const selectedLift = ref(null)
const selectedLiftProject = ref(null)
const selectedLiftBuilding = ref('')
const selectedLiftWing = ref('')
const selectedLiftCert = computed(() => getCertRecord(selectedLift.value?.id, selectedLiftProject.value?.id))
const navigatingToCerts = ref(false)

function navigateToLiftCert() {
  navigatingToCerts.value = true
  const liftId = selectedLift.value?.id
  const projectId = selectedLiftProject.value?.id
  showLiftDetail.value = false
  router.push(`/licenses?liftId=${encodeURIComponent(liftId || '')}&projectId=${encodeURIComponent(projectId || '')}`).finally(() => {
    navigatingToCerts.value = false
  })
}

function openLiftDetail(lift, project, bldName, wingName) {
  selectedLift.value = lift
  selectedLiftProject.value = project
  selectedLiftBuilding.value = bldName
  selectedLiftWing.value = wingName
  showLiftDetail.value = true
}

const selectedLiftRepairs = computed(() => {
  if (!selectedLift.value) return []
  const pid = selectedLiftProject.value?.id || ''
  const key = pid + '__' + selectedLift.value.id
  const specific = healthMap.value[key]?.repairs || []
  // Also include repairs logged at project level (no specific lifts selected)
  const projectLevel = repairs.value.filter(r =>
    r.projectId === pid && !(r.liftSelection?.liftIds?.length)
  )
  const seen = new Set(specific.map(r => r.id))
  return [...specific, ...projectLevel.filter(r => !seen.has(r.id))]
})
const selectedLiftComplaints = computed(() => {
  if (!selectedLift.value) return []
  const pid = selectedLiftProject.value?.id || ''
  const key = pid + '__' + selectedLift.value.id
  const specific = healthMap.value[key]?.complaints || []
  // Also include complaints logged at project level (no specific lifts selected)
  const projectLevel = complaints.value.filter(c =>
    c.projectId === pid && !(c.liftSelection?.liftIds?.length)
  )
  const seen = new Set(specific.map(c => c.id))
  return [...specific, ...projectLevel.filter(c => !seen.has(c.id))]
})
const selectedLiftActivities = computed(() => {
  const rs = selectedLiftRepairs.value.map(r => ({ ...r, _type: 'repair' }))
  const cs = selectedLiftComplaints.value.map(c => ({ ...c, _type: 'complaint' }))
  return [...rs, ...cs].sort((a, b) => {
    const da = String(a.repairDate || a.scheduledDate || a.createdAt || '')
    const db = String(b.repairDate || b.scheduledDate || b.createdAt || '')
    return db.localeCompare(da)
  })
})

const liftConfigFields = [
  { key: 'type',        label: 'Type' },
  { key: 'oem',         label: 'OEM / Brand' },
  { key: 'capacity',    label: 'Capacity (kg)' },
  { key: 'ratedLoad',   label: 'Rated Load (persons)' },
  { key: 'speed',       label: 'Speed (m/s)' },
  { key: 'stops',       label: 'Stops / Floors' },
  { key: 'drive',       label: 'Drive / Controller' },
  { key: 'doorType',    label: 'Door Type' },
  { key: 'machineRoom', label: 'Machine Room' },
]

// ── QR Code ─────────────────────────────────────────────────────────────────
const showQrModal = ref(false)
const qrDataUrl   = ref('')
const qrLiftLabel = ref('')

async function openQr(lift, projectId) {
  const url = `https://www.avant.online/lift?projectId=${encodeURIComponent(projectId)}&liftId=${encodeURIComponent(lift.id)}`
  qrDataUrl.value   = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#1e1b4b', light: '#ffffff' } })
  qrLiftLabel.value = lift.id
  showQrModal.value = true
}

function downloadQr() {
  const a = document.createElement('a')
  a.href = qrDataUrl.value
  a.download = `QR-${qrLiftLabel.value}.png`
  a.click()
}

// ── Deep link: auto-open lift modal from /lifts?projectId=X&liftId=Y ────────
watch([() => route.query.projectId, () => route.query.liftId, () => allLifts.value.length], () => {
  const qPid = route.query.projectId
  const qLid = route.query.liftId
  if (!qPid || !qLid || !allLifts.value.length) return
  const found = allLifts.value.find(l => l.projectId === qPid && l.liftId === qLid)
  if (found) openLiftDetail(found.lift, found.project, found.buildingName, found.wingName)
}, { immediate: true })

// ── Utilities ───────────────────────────────────────────────────────────
function statusBadge(s) {
  return { active: 'badge-active', 'in-progress': 'badge-info', completed: 'badge-inactive', 'on-hold': 'badge-warning', cancelled: 'badge-danger' }[s] || 'badge-info'
}

function formatDate(ts) {
  if (!ts) return '—'
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '—' }
}
</script>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
</style>
