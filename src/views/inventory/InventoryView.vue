<template>
  <div class="inventory-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <component :is="locationIcon" :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          {{ locationLabel }} Inventory
        </h1>
        <p class="page-sub">Every part tracked, every stock level monitored.</p>
      </div>
      <div v-if="activeTab === 'inventory'" style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-secondary btn-sm" @click="showScanner = true" title="Scan barcode to search">
          <ScanLine :size="14" /> Scan Barcode
        </button>
        <button class="btn-secondary btn-sm" @click="exportPDF">
          <Download :size="14" /> Export PDF
        </button>
        <button class="btn-primary" @click="openAdd">
          <Plus :size="16" /> Add Item
        </button>
      </div>
    </div>

    <!-- Subtabs -->
    <div class="inv-subtabs">
      <button :class="['inv-subtab-btn', { active: activeTab === 'inventory' }]" @click="activeTab = 'inventory'">
        <Package :size="14" /> Inventory
      </button>
      <button :class="['inv-subtab-btn', { active: activeTab === 'usage' }]" @click="activeTab = 'usage'">
        <History :size="14" /> Usage Logs
        <span v-if="locationUsageLogs.length" class="usage-count-badge">{{ locationUsageLogs.length }}</span>
      </button>
    </div>

    <!-- ═══════════ INVENTORY TAB ═══════════ -->
    <template v-if="activeTab === 'inventory'">
      <!-- Low Stock Alert -->
      <div v-if="lowStockItems.length" class="low-stock-alert glass" style="margin-bottom:20px;padding:14px 18px;display:flex;align-items:center;gap:10px;border-color:rgba(245,158,11,0.25);">
        <AlertTriangle :size="16" style="color:#fbbf24;flex-shrink:0;" />
        <span style="font-size:13px;color:#fbbf24;font-weight:500;">{{ lowStockItems.length }} item(s) below minimum stock level</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:4px;">
          <span v-for="item in lowStockItems.slice(0,4)" :key="item.id" class="badge badge-warning">{{ item.name }}</span>
          <span v-if="lowStockItems.length > 4" class="badge badge-warning">+{{ lowStockItems.length - 4 }} more</span>
        </div>
      </div>

      <!-- Filters Row -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
        <div class="search-box" style="flex:1;min-width:220px;">
          <Search :size="14" class="search-icon" />
          <input v-model="search" class="input" placeholder="Search by name, SKU…" style="min-width:200px;" />
        </div>
        <select v-model="filterCategory" class="input" style="width:200px;">
          <option value="">All Categories</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="filterStock" class="input" style="width:160px;">
          <option value="">All Stock Levels</option>
          <option value="low">Low Stock</option>
          <option value="ok">In Stock</option>
        </select>
      </div>

      <!-- Summary Stats -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;">
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--ct-accent);">{{ items.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Total Items</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--ct-green);">{{ inStockItems.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">In Stock</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#fbbf24;">{{ lowStockItems.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Low Stock</div>
        </div>
        <div class="glass" style="padding:16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--ct-sub);">{{ categories.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Categories</div>
        </div>
      </div>

      <!-- Data Table -->
      <DataTable
        :columns="columns"
        :rows="pagedItems"
        :loading="loading"
        :total="filteredItems.length"
        :page="page"
        :pageSize="pageSize"
        empty-text="No inventory items found."
        @page="page = $event"
      >
        <template #default="{ row }">
          <td>
            <div style="font-weight:500;color:var(--ct-primary);">{{ row.name }}</div>
            <div v-if="row.sku" style="font-size:11px;color:var(--ct-muted);margin-top:2px;">SKU: {{ row.sku }}</div>
            <div v-if="row.barcode" style="font-size:11px;color:var(--ct-muted);">BC: {{ row.barcode }}</div>
          </td>
          <td><span class="badge badge-info">{{ row.category }}</span></td>
          <td>
            <span :class="getStockClass(row)" style="font-weight:600;">{{ row.quantity }}</span>
            <span style="color:var(--ct-muted);font-size:12px;margin-left:4px;">{{ row.unit }}</span>
          </td>
          <td style="color:var(--ct-muted);font-size:12px;">{{ row.minStock || 0 }} {{ row.unit }}</td>
          <td>
            <span v-if="isLowStock(row)" class="badge badge-warning"><AlertTriangle :size="10" /> Low</span>
            <span v-else class="badge badge-active">OK</span>
          </td>
          <td style="color:var(--ct-muted);font-size:12px;">{{ row.lastUpdated ? formatDate(row.lastUpdated) : '—' }}</td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn-success btn-sm" @click="openConsume(row)" title="Use/Consume">
                <MinusCircle :size="12" /> Use
              </button>
              <button class="btn-warning btn-sm" @click="openRestock(row)" title="Restock">
                <PlusCircle :size="12" /> Restock
              </button>
              <button class="btn-secondary btn-sm" @click="openEdit(row)">
                <Pencil :size="12" />
              </button>
              <button class="btn-danger btn-sm" @click="confirmDelete(row)">
                <Trash2 :size="12" />
              </button>
            </div>
          </td>
        </template>
      </DataTable>
    </template>

    <!-- ═══════════ USAGE LOGS TAB ═══════════ -->
    <template v-else>
      <!-- Usage Filters -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
        <div class="search-box" style="flex:1;min-width:220px;">
          <Search :size="14" class="search-icon" />
          <input v-model="usageSearch" class="input" placeholder="Search item, project, service…" />
        </div>
        <select v-model="usageFilterType" class="input" style="width:180px;">
          <option value="">All Services</option>
          <option v-for="st in SERVICE_TYPES" :key="st.key" :value="st.key">{{ st.label }}</option>
        </select>
        <input v-model="usageFilterDate" type="date" class="input" style="width:160px;" title="Filter by date" />
        <button v-if="usageSearch || usageFilterType || usageFilterDate" class="btn-secondary btn-sm" @click="clearUsageFilter">
          <X :size="14" /> Clear
        </button>
      </div>

      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
        <div class="glass" style="padding:14px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:var(--ct-accent);">{{ locationUsageLogs.length }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">Total Uses</div>
        </div>
        <div class="glass" style="padding:14px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#f87171;">{{ totalQtyUsed }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">Units Used</div>
        </div>
        <div class="glass" style="padding:14px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:var(--ct-green);">{{ totalQtyReturned }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">Units Returned</div>
        </div>
        <div class="glass" style="padding:14px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#fbbf24;">{{ logsWithProject }}</div>
          <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">Project-Linked</div>
        </div>
      </div>

      <!-- Usage Cards -->
      <div v-if="usageLoading" style="text-align:center;padding:40px;color:var(--ct-muted);">Loading usage logs…</div>
      <div v-else-if="filteredUsageLogs.length === 0" class="glass" style="padding:40px;text-align:center;color:var(--ct-muted);">
        No usage logs found for this location.
      </div>
      <div v-else style="display:flex;flex-direction:column;gap:10px;">
        <div v-for="log in filteredUsageLogs" :key="log.id" class="usage-card glass">
          <div class="usage-card-main">
            <div class="usage-card-left">
              <div class="usage-item-name">{{ log.itemName }}
                <span v-if="log.itemSku" style="font-size:11px;font-weight:400;color:var(--ct-muted);margin-left:6px;">{{ log.itemSku }}</span>
              </div>
              <div class="usage-item-meta">
                <span class="badge badge-warning" style="font-size:10px;">–{{ log.quantityUsed }} {{ log.unit }}</span>
                <span v-if="log.sentBack" class="badge badge-active" style="font-size:10px;">+{{ log.sentBack }} returned</span>
                <span v-if="log.serviceType" :class="['badge', svcBadgeClass(log.serviceType)]" style="font-size:10px;">{{ svcLabel(log.serviceType) }}</span>
              </div>
              <div v-if="log.projectName" style="font-size:12px;color:var(--ct-sub);margin-top:5px;display:flex;align-items:center;gap:5px;">
                <Briefcase :size="11" />
                <span style="font-weight:500;">{{ log.projectName }}</span>
                <span v-if="log.serviceLabel" style="color:var(--ct-muted);">— {{ log.serviceLabel }}</span>
              </div>
              <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">
                {{ formatDateTime(log.usedAt) }}
                <span v-if="log.usedByName"> &bull; {{ log.usedByName }}</span>
                <span v-if="log.remarks" style="font-style:italic;margin-left:6px;">"{{ log.remarks }}"</span>
              </div>
            </div>
            <div class="usage-card-actions">
              <button class="btn-secondary btn-xs" @click="openUsageDetail(log)">
                <Eye :size="12" /> View
              </button>
              <button
                class="btn-warning btn-xs"
                :disabled="(log.sentBack || 0) >= log.quantityUsed"
                @click="openSendBack(log)"
                title="Send unused material back to inventory"
              >
                <CornerUpLeft :size="12" /> Send Back
              </button>
            </div>
          </div>
          <!-- Return history inline -->
          <div v-if="log.sentBackHistory?.length" class="usage-return-log">
            <div v-for="(sb, i) in log.sentBackHistory" :key="i" style="font-size:10px;color:var(--ct-muted);">
              ↩ {{ sb.qty }} {{ log.unit }} returned {{ formatDateTime(sb.at) }} by {{ sb.by }}{{ sb.remarks ? ' — ' + sb.remarks : '' }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══════════ MODALS ═══════════ -->

    <!-- Add / Edit Modal -->
    <AppModal
      v-model="showItemModal"
      :title="editingItem ? 'Edit Item' : 'Add Inventory Item'"
      :subtitle="editingItem ? `Editing: ${editingItem.name}` : `Adding to ${locationLabel}`"
      width="680px"
    >
      <div class="form-grid">
        <div class="form-group">
          <label class="label">Item Name *</label>
          <input v-model="form.name" class="input" placeholder="e.g. Motor Drive Unit" />
        </div>
        <div class="form-group">
          <label class="label">SKU</label>
          <input v-model="form.sku" class="input" placeholder="e.g. MTR-001" />
        </div>
        <div class="form-group">
          <label class="label">Barcode</label>
          <div style="display:flex;gap:8px;">
            <input v-model="form.barcode" class="input" placeholder="Scan or enter barcode" style="flex:1;" />
            <button type="button" class="btn-secondary btn-sm" style="flex-shrink:0;white-space:nowrap;" @click="showScanner = true" title="Open camera scanner">
              <ScanLine :size="13" /> Scan
            </button>
          </div>
        </div>
        <div class="form-group">
          <label class="label">Category *</label>
          <select v-model="form.category" class="input">
            <option value="">Select category</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Quantity *</label>
          <input v-model.number="form.quantity" type="number" min="0" class="input" placeholder="0" />
        </div>
        <div class="form-group">
          <label class="label">Unit</label>
          <input v-model="form.unit" class="input" placeholder="pcs, kg, m, set…" />
        </div>
        <div class="form-group">
          <label class="label">Min Stock (Alert Threshold)</label>
          <input v-model.number="form.minStock" type="number" min="0" class="input" placeholder="0" />
        </div>
        <div class="form-group form-full">
          <label class="label">Description</label>
          <textarea v-model="form.description" class="input" rows="3" placeholder="Optional notes…"></textarea>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showItemModal = false">Cancel</button>
        <button class="btn-primary" :disabled="saving" @click="saveItem">
          <Save :size="14" /> {{ saving ? 'Saving…' : (editingItem ? 'Update Item' : 'Add Item') }}
        </button>
      </template>
    </AppModal>

    <!-- Consume / Use Modal (Enhanced) -->
    <AppModal
      v-model="showConsumeModal"
      title="Use / Consume Stock"
      :subtitle="`${consumeTarget?.name} — Available: ${consumeTarget?.quantity} ${consumeTarget?.unit}`"
      width="560px"
    >
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Qty -->
        <div class="form-group">
          <label class="label">Quantity to Use *</label>
          <input v-model.number="consumeQty" type="number" min="1" :max="consumeTarget?.quantity" class="input" placeholder="Enter quantity" />
        </div>

        <!-- Project search -->
        <div style="position:relative;">
          <label class="label">Link to Project <span style="font-weight:400;color:var(--ct-muted);">(optional)</span></label>
          <div class="search-box">
            <Search :size="13" class="search-icon" />
            <input
              v-model="consumeProjectSearch"
              class="input"
              placeholder="Type to search projects…"
              @focus="consumeProjectOpen = true"
              @blur="delayCloseProjectDropdown"
            />
          </div>
          <div v-if="consumeProjectOpen && filteredConsumeProjects.length" class="consume-dropdown">
            <div
              v-for="p in filteredConsumeProjects"
              :key="p.id"
              class="consume-dropdown-item"
              @mousedown.prevent="selectConsumeProject(p)"
            >
              <div class="proj-name">{{ p.projectName }}</div>
              <div class="proj-sub">{{ p.clientName }}<span v-if="p.city || p.address"> · {{ p.city || p.address }}</span></div>
            </div>
          </div>
          <!-- Selected project chip -->
          <div v-if="consumeSelectedProject" class="consume-project-chip">
            <Briefcase :size="12" />
            <span>{{ consumeSelectedProject.projectName }}</span>
            <button class="chip-remove" @click="clearConsumeProject"><X :size="11" /></button>
          </div>
        </div>

        <!-- Service linking — shown only when a project is selected -->
        <div v-if="consumeSelectedProject" class="service-link-section">
          <label class="label">Link to Service Record <span style="font-weight:400;color:var(--ct-muted);">(optional)</span></label>

          <!-- Service type selector -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;margin-bottom:10px;">
            <button
              v-for="st in SERVICE_TYPES"
              :key="st.key"
              :class="['svc-type-btn', { active: consumeServiceType === st.key }]"
              @click="selectServiceType(st.key)"
            >
              {{ st.label }}
            </button>
          </div>

          <!-- Service records list -->
          <template v-if="consumeServiceType">
            <div v-if="consumeServiceLoading" style="font-size:12px;color:var(--ct-muted);padding:6px 0;">Loading records…</div>
            <div v-else-if="consumeServiceRecords.length === 0" style="font-size:12px;color:var(--ct-muted);padding:6px 0;">
              No {{ svcLabel(consumeServiceType) }} records found for this project.
            </div>
            <div v-else class="svc-records-list">
              <div
                v-for="svc in consumeServiceRecords"
                :key="svc.id"
                :class="['svc-record-item', { selected: consumeSelectedService?.id === svc.id }]"
                @click="consumeSelectedService = svc"
              >
                <div style="font-size:12px;font-weight:600;color:var(--ct-primary);padding-right:60px;">{{ getServiceSummary(consumeServiceType, svc) }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ getServiceMeta(consumeServiceType, svc) }}</div>
                <span v-if="consumeSelectedService?.id === svc.id" style="position:absolute;top:8px;right:10px;color:var(--ct-green);font-size:11px;font-weight:600;">✓ Selected</span>
              </div>
            </div>
          </template>
        </div>

        <!-- Remarks -->
        <div class="form-group">
          <label class="label">Remarks</label>
          <input v-model="consumeRemarks" class="input" placeholder="Reason for use (optional)" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showConsumeModal = false">Cancel</button>
        <button class="btn-danger" :disabled="saving" @click="consumeStock">
          <MinusCircle :size="14" /> {{ saving ? 'Processing…' : 'Consume Stock' }}
        </button>
      </template>
    </AppModal>

    <!-- Restock Modal -->
    <AppModal v-model="showRestockModal" title="Restock Item" :subtitle="`Current stock: ${restockTarget?.quantity} ${restockTarget?.unit}`" width="440px">
      <div class="form-group" style="margin-bottom:16px;">
        <label class="label">Quantity to Add *</label>
        <input v-model.number="restockQty" type="number" min="1" class="input" placeholder="Enter quantity" />
      </div>
      <div class="form-group">
        <label class="label">Remarks</label>
        <input v-model="restockRemarks" class="input" placeholder="Source / PO ref (optional)" />
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showRestockModal = false">Cancel</button>
        <button class="btn-success" :disabled="saving" @click="restockStock">
          <PlusCircle :size="14" /> {{ saving ? 'Processing…' : 'Add Stock' }}
        </button>
      </template>
    </AppModal>

    <!-- Usage Detail Modal -->
    <AppModal v-model="showUsageDetail" title="Usage Detail" :subtitle="viewUsageLog?.itemName" width="520px">
      <div v-if="viewUsageLog" style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="detail-stat">
            <div class="detail-stat-label">Item</div>
            <div class="detail-stat-val">{{ viewUsageLog.itemName }}<span v-if="viewUsageLog.itemSku" style="color:var(--ct-muted);font-size:11px;margin-left:6px;">{{ viewUsageLog.itemSku }}</span></div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Location</div>
            <div class="detail-stat-val" style="text-transform:capitalize;">{{ viewUsageLog.location }}</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Qty Used</div>
            <div class="detail-stat-val" style="color:#f87171;font-size:16px;">–{{ viewUsageLog.quantityUsed }} {{ viewUsageLog.unit }}</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Qty Returned</div>
            <div class="detail-stat-val" style="color:var(--ct-green);font-size:16px;">+{{ viewUsageLog.sentBack || 0 }} {{ viewUsageLog.unit }}</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Used On</div>
            <div class="detail-stat-val">{{ formatDateTime(viewUsageLog.usedAt) }}</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">Used By</div>
            <div class="detail-stat-val">{{ viewUsageLog.usedByName || '—' }}</div>
          </div>
        </div>
        <div v-if="viewUsageLog.projectName" class="detail-stat">
          <div class="detail-stat-label">Project</div>
          <div class="detail-stat-val" style="display:flex;align-items:center;gap:6px;"><Briefcase :size="13" /> {{ viewUsageLog.projectName }}</div>
        </div>
        <div v-if="viewUsageLog.serviceType" class="detail-stat">
          <div class="detail-stat-label">Service</div>
          <div class="detail-stat-val" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span :class="['badge', svcBadgeClass(viewUsageLog.serviceType)]">{{ svcLabel(viewUsageLog.serviceType) }}</span>
            <span style="font-size:12px;color:var(--ct-sub);">{{ viewUsageLog.serviceLabel }}</span>
          </div>
        </div>
        <div v-if="viewUsageLog.remarks" class="detail-stat">
          <div class="detail-stat-label">Remarks</div>
          <div class="detail-stat-val" style="font-style:italic;color:var(--ct-sub);">"{{ viewUsageLog.remarks }}"</div>
        </div>
        <!-- Return history -->
        <div v-if="viewUsageLog.sentBackHistory?.length">
          <div class="label" style="margin-bottom:8px;">Return History</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div v-for="(sb, i) in viewUsageLog.sentBackHistory" :key="i"
              style="padding:8px 12px;background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);border-radius:8px;font-size:12px;">
              <span style="color:var(--ct-green);font-weight:600;">+{{ sb.qty }} {{ viewUsageLog.unit }}</span>
              returned {{ formatDateTime(sb.at) }} by {{ sb.by }}
              <span v-if="sb.remarks" style="color:var(--ct-muted);"> — {{ sb.remarks }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showUsageDetail = false">Close</button>
        <button
          v-if="viewUsageLog && (viewUsageLog.sentBack || 0) < viewUsageLog.quantityUsed"
          class="btn-warning"
          @click="() => { showUsageDetail = false; openSendBack(viewUsageLog) }"
        >
          <CornerUpLeft :size="14" /> Send Back to Inventory
        </button>
      </template>
    </AppModal>

    <!-- Send Back Modal -->
    <AppModal
      v-model="showSendBackModal"
      title="Send Back to Inventory"
      :subtitle="`${sendBackTarget?.itemName} — used: ${sendBackTarget?.quantityUsed} ${sendBackTarget?.unit}`"
      width="420px"
    >
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="padding:10px 14px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:10px;font-size:13px;color:#fbbf24;">
          Available to return:
          <strong>{{ (sendBackTarget?.quantityUsed || 0) - (sendBackTarget?.sentBack || 0) }} {{ sendBackTarget?.unit }}</strong>
        </div>
        <div class="form-group">
          <label class="label">Quantity to Return *</label>
          <input
            v-model.number="sendBackQty"
            type="number"
            min="1"
            :max="(sendBackTarget?.quantityUsed || 0) - (sendBackTarget?.sentBack || 0)"
            class="input"
            placeholder="Enter quantity"
          />
        </div>
        <div class="form-group">
          <label class="label">Remarks</label>
          <input v-model="sendBackRemarks" class="input" placeholder="e.g. Work completed, material leftover" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showSendBackModal = false">Cancel</button>
        <button class="btn-success" :disabled="saving" @click="confirmSendBack">
          <CornerUpLeft :size="14" /> {{ saving ? 'Processing…' : 'Return to Inventory' }}
        </button>
      </template>
    </AppModal>

    <!-- Confirm Delete -->
    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Item"
      :message="`Are you sure you want to delete '${deleteTarget?.name}'? This cannot be undone.`"
      confirm-label="Delete"
      danger
      @confirm="deleteItem"
    />

    <!-- Barcode Scanner -->
    <BarcodeScanner
      v-if="showScanner"
      @scanned="onBarcodeScanned"
      @close="showScanner = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Plus, Search, Download, Pencil, Trash2, Save, AlertTriangle,
  PlusCircle, MinusCircle, Warehouse, Building2, Truck, ScanLine,
  Package, History, X, Briefcase, Eye, CornerUpLeft,
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import BarcodeScanner from '@/components/ui/BarcodeScanner.vue'
import { useCollection } from '@/composables/useCollection'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { savePDF } from '@/utils/saveFile'
import { Collections } from '@/firebase/collections'
import { getAll } from '@/firebase/firestore'

const route = useRoute()
const ui = useUIStore()
const auth = useAuthStore()
const activity = useActivityStore()

// ── Active subtab ─────────────────────────────────────────────────────────────
const activeTab = ref('inventory')

// ── Barcode Scanner ───────────────────────────────────────────────────────────
const showScanner = ref(false)
function onBarcodeScanned(code) {
  if (showItemModal.value) { form.value.barcode = code; ui.success(`Barcode scanned: ${code}`) }
  else { search.value = code; ui.success(`Searching for: ${code}`) }
  showScanner.value = false
}

// ── Location ──────────────────────────────────────────────────────────────────
const location = computed(() => route.meta?.location || route.query?.location || 'warehouse')
const locationLabel = computed(() => ({ warehouse: 'Warehouse', office: 'Office', 'service-van': 'Service Van' })[location.value] || 'Warehouse')
const locationIcon = computed(() => ({ warehouse: Warehouse, office: Building2, 'service-van': Truck })[location.value] || Warehouse)

const CATEGORY_MAP = {
  warehouse: ['Motors', 'Controllers', 'Cables', 'Rails', 'Car Equipment', 'Safety Components', 'Door Systems', 'Fixtures', 'Tools', 'Hardware'],
  office: ['Stationery', 'Paper', 'Folders', 'Pens', 'Markers', 'Toner', 'Printer Supplies', 'Furniture', 'Electronics'],
  'service-van': ['Emergency Parts', 'Tools', 'Testing Equipment', 'Safety Gear', 'Sensors', 'Controllers', 'Cables', 'Car Parts', 'Door Parts'],
}
const categories = computed(() => CATEGORY_MAP[location.value] || CATEGORY_MAP.warehouse)

// ── Collections ────────────────────────────────────────────────────────────────
const { items: allItems, loading, add, edit, del } = useCollection(Collections.INVENTORY)
const { items: allProjects } = useCollection(Collections.PROJECTS)
const { items: allUsageLogs, loading: usageLoading, add: addUsage, edit: editUsage } = useCollection(Collections.INVENTORY_USAGE)

// Filter to this location
const items = computed(() => allItems.value.filter(i => i.location === location.value))
const locationUsageLogs = computed(() =>
  allUsageLogs.value
    .filter(l => l.location === location.value)
    .sort((a, b) => {
      const ta = a.usedAt?.toDate?.()?.getTime() || new Date(a.usedAt || 0).getTime()
      const tb = b.usedAt?.toDate?.()?.getTime() || new Date(b.usedAt || 0).getTime()
      return tb - ta
    })
)

// ── Inventory filters ──────────────────────────────────────────────────────────
const search = ref('')
const filterCategory = ref('')
const filterStock = ref('')
const page = ref(1)
const pageSize = 25

const filteredItems = computed(() => {
  let list = items.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(i => i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q) || i.barcode?.toLowerCase().includes(q))
  }
  if (filterCategory.value) list = list.filter(i => i.category === filterCategory.value)
  if (filterStock.value === 'low') list = list.filter(i => isLowStock(i))
  if (filterStock.value === 'ok') list = list.filter(i => !isLowStock(i))
  return list
})
watch([search, filterCategory, filterStock], () => { page.value = 1 })
const pagedItems = computed(() => filteredItems.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const lowStockItems = computed(() => items.value.filter(i => isLowStock(i)))
const inStockItems = computed(() => items.value.filter(i => !isLowStock(i)))

function isLowStock(item) { return item.minStock > 0 && item.quantity <= item.minStock }
function getStockClass(item) { return isLowStock(item) ? 'text-amber-400' : 'text-emerald-400' }
function formatDate(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}
function formatDateTime(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const columns = [
  { key: 'name', label: 'Item' },
  { key: 'category', label: 'Category', width: '140px' },
  { key: 'quantity', label: 'Qty', width: '100px' },
  { key: 'minStock', label: 'Min Stock', width: '100px' },
  { key: 'status', label: 'Status', width: '90px' },
  { key: 'lastUpdated', label: 'Last Updated', width: '130px' },
  { key: 'actions', label: 'Actions', width: '240px' },
]

// ── Add / Edit ─────────────────────────────────────────────────────────────────
const showItemModal = ref(false)
const editingItem = ref(null)
const saving = ref(false)
const defaultForm = () => ({ name: '', sku: '', barcode: '', category: '', quantity: 0, unit: 'pcs', minStock: 0, description: '', location: location.value, lastUpdated: null })
const form = ref(defaultForm())

function openAdd() { editingItem.value = null; form.value = defaultForm(); showItemModal.value = true }
function openEdit(item) { editingItem.value = item; form.value = { ...defaultForm(), ...item }; showItemModal.value = true }

async function saveItem() {
  if (!form.value.name || !form.value.category) { ui.error('Name and category are required.'); return }
  saving.value = true
  try {
    const data = { ...form.value, location: location.value, lastUpdated: new Date() }
    if (editingItem.value) { await edit(editingItem.value.id, data, { action: 'updated', module: 'inventory', tab: 'Warehouse', summary: `Updated inventory item: ${data.name}`, details: { itemName: data.name, category: data.category, location: data.location } }); ui.success('Item updated successfully.') }
    else { await add(data, { action: 'created', module: 'inventory', tab: 'Warehouse', summary: `Added ${data.name} to inventory`, details: { itemName: data.name, category: data.category, quantity: data.quantity, location: data.location } }); ui.success('Item added to inventory.') }
    showItemModal.value = false
  } catch { ui.error('Failed to save item.') } finally { saving.value = false }
}

// ── Service type config ────────────────────────────────────────────────────────
const SERVICE_TYPES = [
  { key: 'repairs',       label: 'Repairs',       col: Collections.REPAIRS },
  { key: 'installation',  label: 'Installation',  col: Collections.INSTALLATION },
  { key: 'complaints',    label: 'Complaints',    col: Collections.COMPLAINTS },
  { key: 'modernisation', label: 'Modernisation', col: Collections.MODERNISATION },
  { key: 'amc',           label: 'AMC',           col: Collections.AMC },
]

function getServiceSummary(type, svc) {
  if (!svc) return '—'
  switch (type) {
    case 'repairs':       return [svc.repairType, svc.faultDescription?.slice(0, 55)].filter(Boolean).join(' — ')
    case 'installation':  return [svc.liftType, svc.issueDescription?.slice(0, 55)].filter(Boolean).join(' — ')
    case 'complaints':    return [(svc.complaintNumber ? `#${svc.complaintNumber}` : ''), svc.issueType].filter(Boolean).join(' ')
    case 'modernisation': return [svc.liftType, svc.issueDescription?.slice(0, 55)].filter(Boolean).join(' — ')
    case 'amc':           return [svc.contractNumber, svc.clientName].filter(Boolean).join(' · ')
    default:              return svc.id
  }
}
function getServiceMeta(type, svc) {
  if (!svc) return ''
  switch (type) {
    case 'repairs':       return `${svc.repairDate || ''} · ${svc.status || ''} · ${(svc.technicians || [svc.technician]).filter(Boolean).join(', ')}`
    case 'installation':  return `${svc.activityDate || ''} · ${svc.status || ''} · ${(svc.technicians || []).join(', ')}`
    case 'complaints':    return `${svc.scheduledDate || ''} · Priority: ${svc.priority || ''} · ${svc.status || ''}`
    case 'modernisation': return `${svc.activityDate || ''} · ${svc.status || ''} · ${(svc.technicians || []).join(', ')}`
    case 'amc':           return `${svc.startDate || ''} → ${svc.endDate || ''} · ${svc.status || ''}`
    default:              return ''
  }
}
function svcLabel(type) { return SERVICE_TYPES.find(s => s.key === type)?.label || type }
function svcBadgeClass(type) {
  return { repairs: 'badge-warning', installation: 'badge-info', complaints: 'badge-warning', modernisation: 'badge-info', amc: 'badge-active' }[type] || 'badge-info'
}

// ── Consume (enhanced) ────────────────────────────────────────────────────────
const showConsumeModal = ref(false)
const consumeTarget = ref(null)
const consumeQty = ref(1)
const consumeRemarks = ref('')
const consumeProjectSearch = ref('')
const consumeProjectOpen = ref(false)
const consumeSelectedProject = ref(null)
const consumeServiceType = ref('')
const consumeServiceRecords = ref([])
const consumeServiceLoading = ref(false)
const consumeSelectedService = ref(null)

const filteredConsumeProjects = computed(() => {
  const q = consumeProjectSearch.value.toLowerCase()
  const list = q
    ? allProjects.value.filter(p => (p.projectName || '').toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q))
    : allProjects.value
  return list.slice(0, 8)
})

function delayCloseProjectDropdown() { setTimeout(() => { consumeProjectOpen.value = false }, 200) }

function selectConsumeProject(p) {
  consumeSelectedProject.value = p
  consumeProjectSearch.value = ''
  consumeProjectOpen.value = false
  consumeServiceType.value = ''
  consumeServiceRecords.value = []
  consumeSelectedService.value = null
}
function clearConsumeProject() {
  consumeSelectedProject.value = null
  consumeProjectSearch.value = ''
  consumeServiceType.value = ''
  consumeServiceRecords.value = []
  consumeSelectedService.value = null
}
async function selectServiceType(key) {
  consumeServiceType.value = key
  consumeSelectedService.value = null
  if (!consumeSelectedProject.value?.id) return
  consumeServiceLoading.value = true
  const st = SERVICE_TYPES.find(s => s.key === key)
  try {
    const all = await getAll(st.col)
    consumeServiceRecords.value = all.filter(r => r.projectId === consumeSelectedProject.value.id)
  } catch { consumeServiceRecords.value = [] } finally { consumeServiceLoading.value = false }
}
function openConsume(item) {
  consumeTarget.value = item
  consumeQty.value = 1
  consumeRemarks.value = ''
  consumeProjectSearch.value = ''
  consumeProjectOpen.value = false
  consumeSelectedProject.value = null
  consumeServiceType.value = ''
  consumeServiceRecords.value = []
  consumeSelectedService.value = null
  showConsumeModal.value = true
}
async function consumeStock() {
  if (!consumeQty.value || consumeQty.value < 1) { ui.error('Enter a valid quantity.'); return }
  if (consumeQty.value > consumeTarget.value.quantity) { ui.error('Cannot consume more than available stock.'); return }
  saving.value = true
  try {
    await edit(consumeTarget.value.id, { quantity: consumeTarget.value.quantity - consumeQty.value, lastUpdated: new Date() }, { action: 'used', module: 'inventory', tab: 'Warehouse', summary: `Consumed ${consumeQty.value} ${consumeTarget.value.unit || 'pcs'} of ${consumeTarget.value.name}`, details: { itemName: consumeTarget.value.name, quantityConsumed: consumeQty.value, remainingQty: consumeTarget.value.quantity - consumeQty.value } })
    await addUsage({
      itemId:        consumeTarget.value.id,
      itemName:      consumeTarget.value.name,
      itemSku:       consumeTarget.value.sku || '',
      location:      location.value,
      quantityUsed:  consumeQty.value,
      unit:          consumeTarget.value.unit || 'pcs',
      projectId:     consumeSelectedProject.value?.id || '',
      projectName:   consumeSelectedProject.value?.projectName || '',
      serviceType:   consumeServiceType.value || '',
      serviceId:     consumeSelectedService.value?.id || '',
      serviceLabel:  consumeSelectedService.value ? getServiceSummary(consumeServiceType.value, consumeSelectedService.value) : '',
      remarks:       consumeRemarks.value,
      usedBy:        auth.user?.id || '',
      usedByName:    auth.user?.fullName || auth.user?.username || '',
      date:          new Date().toISOString().split('T')[0],
      usedAt:        new Date(),
      sentBack:      0,
      sentBackHistory: [],
    })
    ui.success(`Consumed ${consumeQty.value} ${consumeTarget.value.unit} of ${consumeTarget.value.name}.`)
    showConsumeModal.value = false
  } catch { ui.error('Failed to update stock.') } finally { saving.value = false }
}

// ── Restock ────────────────────────────────────────────────────────────────────
const showRestockModal = ref(false)
const restockTarget = ref(null)
const restockQty = ref(1)
const restockRemarks = ref('')

function openRestock(item) { restockTarget.value = item; restockQty.value = 1; restockRemarks.value = ''; showRestockModal.value = true }
async function restockStock() {
  if (!restockQty.value || restockQty.value < 1) { ui.error('Enter a valid quantity.'); return }
  saving.value = true
  try {
    await edit(restockTarget.value.id, { quantity: restockTarget.value.quantity + restockQty.value, lastUpdated: new Date() })
    ui.success(`Restocked ${restockQty.value} ${restockTarget.value.unit} of ${restockTarget.value.name}.`)
    showRestockModal.value = false
  } catch { ui.error('Failed to restock item.') } finally { saving.value = false }
}

// ── Delete ─────────────────────────────────────────────────────────────────────
const showDeleteDialog = ref(false)
const deleteTarget = ref(null)
function confirmDelete(item) { deleteTarget.value = item; showDeleteDialog.value = true }
async function deleteItem() {
  try { await del(deleteTarget.value.id, { action: 'deleted', module: 'inventory', tab: 'Warehouse', summary: `Deleted inventory item: ${deleteTarget.value.name}`, details: { itemName: deleteTarget.value.name, category: deleteTarget.value.category } }); ui.success('Item deleted.') }
  catch { ui.error('Failed to delete item.') }
}

// ── Usage logs ─────────────────────────────────────────────────────────────────
const usageSearch = ref('')
const usageFilterType = ref('')
const usageFilterDate = ref('')

const filteredUsageLogs = computed(() => {
  let list = locationUsageLogs.value
  if (usageSearch.value) {
    const q = usageSearch.value.toLowerCase()
    list = list.filter(l =>
      l.itemName?.toLowerCase().includes(q) ||
      l.projectName?.toLowerCase().includes(q) ||
      l.serviceLabel?.toLowerCase().includes(q) ||
      l.remarks?.toLowerCase().includes(q)
    )
  }
  if (usageFilterType.value) list = list.filter(l => l.serviceType === usageFilterType.value)
  if (usageFilterDate.value) list = list.filter(l => l.date === usageFilterDate.value)
  return list
})
function clearUsageFilter() { usageSearch.value = ''; usageFilterType.value = ''; usageFilterDate.value = '' }

const totalQtyUsed = computed(() => locationUsageLogs.value.reduce((s, l) => s + (l.quantityUsed || 0), 0))
const totalQtyReturned = computed(() => locationUsageLogs.value.reduce((s, l) => s + (l.sentBack || 0), 0))
const logsWithProject = computed(() => locationUsageLogs.value.filter(l => l.projectId).length)

// Usage detail
const showUsageDetail = ref(false)
const viewUsageLog = ref(null)
function openUsageDetail(log) { viewUsageLog.value = log; showUsageDetail.value = true }

// Send back
const showSendBackModal = ref(false)
const sendBackTarget = ref(null)
const sendBackQty = ref(1)
const sendBackRemarks = ref('')

function openSendBack(log) { sendBackTarget.value = log; sendBackQty.value = 1; sendBackRemarks.value = ''; showSendBackModal.value = true }

async function confirmSendBack() {
  const avail = (sendBackTarget.value.quantityUsed || 0) - (sendBackTarget.value.sentBack || 0)
  if (!sendBackQty.value || sendBackQty.value < 1 || sendBackQty.value > avail) { ui.error('Invalid quantity.'); return }
  saving.value = true
  try {
    const invItem = allItems.value.find(i => i.id === sendBackTarget.value.itemId)
    if (invItem) await edit(invItem.id, { quantity: invItem.quantity + sendBackQty.value, lastUpdated: new Date() })
    const histEntry = { qty: sendBackQty.value, at: new Date(), by: auth.user?.fullName || auth.user?.username || 'Unknown', remarks: sendBackRemarks.value }
    await editUsage(sendBackTarget.value.id, {
      sentBack: (sendBackTarget.value.sentBack || 0) + sendBackQty.value,
      sentBackHistory: [...(sendBackTarget.value.sentBackHistory || []), histEntry],
    })
    ui.success(`${sendBackQty.value} ${sendBackTarget.value.unit} returned to ${locationLabel.value} inventory.`)
    showSendBackModal.value = false
  } catch { ui.error('Failed to send back.') } finally { saving.value = false }
}

// ── PDF Export ─────────────────────────────────────────────────────────────────
async function exportPDF() {
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFontSize(16); doc.setTextColor(40, 40, 60)
    doc.text(`${locationLabel.value} Inventory Report`, 14, 18)
    doc.setFontSize(9); doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} | Items: ${filteredItems.value.length}`, 14, 26)
    doc.autoTable({
      startY: 32,
      head: [['Name', 'SKU', 'Barcode', 'Category', 'Qty', 'Unit', 'Min Stock', 'Status']],
      body: filteredItems.value.map(item => [item.name, item.sku || '—', item.barcode || '—', item.category, item.quantity, item.unit, item.minStock || 0, isLowStock(item) ? 'Low Stock' : 'OK']),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 255] },
    })
    await savePDF(doc, `${location.value}-inventory-${Date.now()}.pdf`, ui)
    ui.success('PDF exported successfully.')
  } catch { ui.error('Failed to export PDF.') }
}
</script>

<style scoped>
/* ── Subtabs ────────────────────────────────────────────────────────── */
.inv-subtabs { display: flex; gap: 6px; margin-bottom: 20px; }
.inv-subtab-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; color: var(--ct-sub); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.15s; }
.inv-subtab-btn.active { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.35); color: var(--ct-accent); }
.usage-count-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px; background: rgba(99,102,241,0.25); color: var(--ct-accent); font-size: 10px; font-weight: 700; margin-left: 2px; }

/* ── Consume modal — project dropdown ───────────────────────────────── */
.consume-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #1e1b33; border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; z-index: 9999; box-shadow: 0 10px 32px rgba(0,0,0,0.6); overflow: hidden; }
.consume-dropdown-item { padding: 10px 14px; cursor: pointer; transition: background 0.12s; color: #e2e8f0; }
.consume-dropdown-item:hover { background: rgba(99,102,241,0.2); }
.consume-dropdown-item .proj-name { font-weight: 600; font-size: 13px; color: #f1f5f9; }
.consume-dropdown-item .proj-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
.consume-project-chip { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 5px 12px; border-radius: 8px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.28); font-size: 12px; color: var(--ct-accent); font-weight: 500; }
.chip-remove { display: inline-flex; align-items: center; background: none; border: none; cursor: pointer; color: var(--ct-muted); padding: 0; margin-left: 2px; }
.chip-remove:hover { color: #f87171; }

/* ── Service linking section ────────────────────────────────────────── */
.service-link-section { padding: 12px 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; }
.svc-type-btn { padding: 5px 13px; border-radius: 8px; font-size: 12px; font-weight: 500; color: var(--ct-sub); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.12s; }
.svc-type-btn.active { background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.4); color: var(--ct-accent); }
.svc-records-list { display: flex; flex-direction: column; gap: 6px; max-height: 230px; overflow-y: auto; }
.svc-record-item { position: relative; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); cursor: pointer; transition: all 0.12s; }
.svc-record-item:hover { border-color: rgba(99,102,241,0.28); background: rgba(99,102,241,0.06); }
.svc-record-item.selected { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.07); }

/* ── Usage log cards ────────────────────────────────────────────────── */
.usage-card { padding: 14px 16px; border-radius: 14px; }
.usage-card-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.usage-card-left { flex: 1; min-width: 0; }
.usage-item-name { font-size: 14px; font-weight: 600; color: var(--ct-primary); }
.usage-item-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 5px; }
.usage-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
.usage-return-log { margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 3px; }

/* ── Usage detail modal stats ───────────────────────────────────────── */
.detail-stat { padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
.detail-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--ct-muted); margin-bottom: 4px; }
.detail-stat-val { font-size: 13px; font-weight: 500; color: var(--ct-primary); }
</style>
