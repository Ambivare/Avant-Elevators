<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Live Tracking</h1>
        <p class="page-sub">Your field team, always visible, always connected.</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="badge badge-live"><span class="live-dot" />Live</span>
        <button class="btn-secondary btn-sm" @click="refreshLocations">
          <RefreshCw :size="13" :class="{ spin: refreshing }" /> Refresh
        </button>
      </div>
    </div>

    <!-- ═══════════════════════ ADMIN VIEW ═══════════════════════ -->
    <template v-if="isAdmin">

      <!-- Big Map -->
      <div class="glass map-panel-admin" style="position:relative;overflow:hidden;">
        <div ref="mapRef" class="map-container-admin" />
        <div class="map-live-badge">
          <span class="live-dot" style="width:8px;height:8px;" />
          {{ technicianLocations.filter(t => t.isActive !== false).length }} live
        </div>
        <div v-if="technicianLocations.length === 0" class="map-empty-overlay">
          <MapPin :size="40" style="color:#334155;" />
          <p style="color:#475569;font-size:13px;margin-top:8px;">No active technicians</p>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="glass filter-bar">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:1;">
          <div style="display:flex;align-items:center;gap:6px;">
            <CalendarDays :size="14" style="color:var(--ct-muted);" />
            <input type="date" v-model="filterDate" class="input input-sm" style="width:148px;" />
          </div>
          <select v-model="filterRole" class="input input-sm" style="width:140px;">
            <option value="">All Roles</option>
            <option v-for="r in trackingRoleOptions" :key="r.key" :value="r.key">{{ r.label }}</option>
          </select>
          <select v-model="filterTechId" class="input input-sm" style="width:180px;">
            <option value="">All Users</option>
            <option v-for="t in uniqueTechs" :key="t.userId" :value="t.userId">{{ t.userName }}</option>
          </select>
          <button class="btn-secondary btn-sm" @click="filterDate = todayStr">Today</button>
          <button class="btn-secondary btn-sm" @click="filterDate = yesterdayStr">Yesterday</button>
          <button class="btn-secondary btn-sm" @click="clearFilter">Clear</button>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          <button class="btn-secondary btn-sm" @click="exportAllExcel">
            <Download :size="13" /> Excel All
          </button>
          <button class="btn-secondary btn-sm" @click="exportAllPDF">
            <FileText :size="13" /> PDF All
          </button>
        </div>
      </div>

      <!-- Overview Stats -->
      <div class="overview-stats-row">
        <div class="ov-chip"><div class="ov-val">{{ overviewStats.liveNow }}</div><div class="ov-lbl">Live Now</div></div>
        <div class="ov-chip"><div class="ov-val">{{ overviewStats.siteHours }}h</div><div class="ov-lbl">Site Hours</div></div>
        <div class="ov-chip"><div class="ov-val">{{ overviewStats.visits }}</div><div class="ov-lbl">Site Visits</div></div>
        <div class="ov-chip"><div class="ov-val">{{ overviewStats.techsToday }}</div><div class="ov-lbl">Techs Active</div></div>
        <div class="ov-chip"><div class="ov-val">{{ overviewStats.avgSite }}</div><div class="ov-lbl">Avg On-Site</div></div>
        <div class="ov-chip"><div class="ov-val">{{ overviewStats.totalBetween }}</div><div class="ov-lbl">Total Transit</div></div>
        <div class="ov-chip ov-chip-dist"><div class="ov-val ov-val-dist">{{ overviewStats.totalDistanceKm }}</div><div class="ov-lbl">Total Distance</div></div>
      </div>

      <!-- Tech Cards -->
      <div v-if="filteredTechCards.length === 0" class="glass empty-state" style="margin-top:16px;padding:48px;">
        <MapPin :size="32" />
        <p>No tracking data for selected filters</p>
        <span>Technicians appear here when sharing location or when they have site visits</span>
      </div>

      <div class="tech-cards-list">
        <div v-for="card in filteredTechCards" :key="card.techId" class="glass tech-analytics-card">

          <!-- Card Header -->
          <div class="tac-header" @click="toggleCard(card.techId)">
            <div class="tac-avatar" :class="card.isLive ? 'tac-avatar-live' : (card.isStale ? 'tac-avatar-stale' : 'tac-avatar-off')">
              {{ getInitials(card.userName) }}
              <span class="tac-dot" :class="card.isLive ? 'dot-online' : (card.isStale ? 'dot-job' : 'dot-offline')" />
            </div>

            <div class="tac-name-block">
              <div class="tac-name">{{ card.userName }}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
                <span class="badge" :class="card.isLive ? getStatusBadgeClass(card.liveStatus) : (card.isStale ? 'badge-amber' : 'badge-slate')">
                  {{ card.isLive ? (card.liveStatus || 'online') : (card.isStale ? 'lost signal' : 'offline') }}
                </span>
                <span v-if="card.isLive" style="font-size:11px;color:var(--ct-muted);">
                  {{ formatTime(card.lastSeen) }}
                </span>
                <span v-if="card.battery !== undefined" style="font-size:11px;color:var(--ct-muted);display:flex;align-items:center;gap:3px;">
                  <Battery :size="11" /> {{ card.battery }}%
                </span>
              </div>
            </div>

            <div class="tac-chips-row">
              <div class="tac-chip chip-site">
                <span class="tac-chip-val">{{ formatHm(card.daySiteMs) }}</span>
                <span class="tac-chip-lbl">On Site</span>
              </div>
              <div class="tac-chip chip-transit">
                <span class="tac-chip-val">{{ formatHm(card.dayBetweenMs) }}</span>
                <span class="tac-chip-lbl">Transit</span>
              </div>
              <div class="tac-chip chip-visits">
                <span class="tac-chip-val">{{ card.dayVisits }}</span>
                <span class="tac-chip-lbl">Visits</span>
              </div>
              <div class="tac-chip chip-distance">
                <span class="tac-chip-val">{{ formatDistance(card.dayDistanceM) }}</span>
                <span class="tac-chip-lbl">Distance</span>
              </div>
              <div class="tac-chip chip-session">
                <span class="tac-chip-val">{{ formatHm(card.daySessionMs) }}</span>
                <span class="tac-chip-lbl">Session</span>
              </div>
            </div>

            <div class="tac-actions" @click.stop>
              <button class="btn-secondary btn-xs" :disabled="!card.isLive" @click="focusTechnician(card)" title="Focus on map">
                <Crosshair :size="12" />
              </button>
              <button class="btn-secondary btn-xs btn-reconnect" @click="sendReconnectRequest(card)" title="Send reconnect request">
                <Bell :size="12" />
              </button>
              <button class="btn-secondary btn-xs" @click="exportTechExcel(card)" title="Export Excel">
                <Download :size="12" />
              </button>
              <ChevronDown :size="16" class="tac-chevron" :class="{ 'tac-chevron-open': expandedCards.has(card.techId) }" />
            </div>
          </div>

          <!-- Expanded Body -->
          <div v-show="expandedCards.has(card.techId)" class="tac-body">
            <!-- Tabs -->
            <div class="tac-tabs">
              <button v-for="t in cardTabs" :key="t.key"
                class="tac-tab" :class="{ active: (cardActiveTab[card.techId] || 'today') === t.key }"
                @click="setCardTab(card.techId, t.key)">
                {{ t.label }}
              </button>
              <div style="flex:1;" />
              <button v-if="(cardActiveTab[card.techId]||'today')==='monthly'" class="btn-secondary btn-xs" @click="exportTechMonthExcel(card)">
                <Download :size="12" /> Export Month
              </button>
            </div>

            <!-- TODAY TAB -->
            <div v-if="(cardActiveTab[card.techId] || 'today') === 'today'" class="tab-content">
              <div v-if="card.dayEvents.length === 0" class="tac-empty">No site events recorded for this date.</div>
              <div v-else>
                <!-- Day summary chips -->
                <div class="day-summary-chips">
                  <div class="ds-chip ds-site">
                    <MapPin :size="13" /> On Site: <strong>{{ formatHm(card.daySiteMs) }}</strong>
                  </div>
                  <div class="ds-chip ds-transit">
                    <Navigation :size="13" /> Transit: <strong>{{ formatHm(card.dayBetweenMs) }}</strong>
                  </div>
                  <div class="ds-chip ds-dist">
                    <Signal :size="13" /> Distance: <strong>{{ formatDistance(card.dayDistanceM) }}</strong>
                  </div>
                  <div class="ds-chip ds-session">
                    <Clock :size="13" /> Session: <strong>{{ formatHm(card.daySessionMs) }}</strong>
                  </div>
                  <div v-if="card.longestSite" class="ds-chip ds-best">
                    <CheckCircle2 :size="13" /> Longest: <strong>{{ card.longestSite }}</strong>
                  </div>
                </div>

                <!-- Per-site breakdown -->
                <div class="per-site-table">
                  <div class="pst-header">
                    <span>Project</span><span>Arrived</span><span>Left</span><span>On Site</span>
                  </div>
                  <div v-for="row in card.siteBreakdown" :key="row.projectId + row.arrivedAt" class="pst-row">
                    <span class="pst-name">{{ row.projectName }}</span>
                    <span>{{ row.arrivedAt }}</span>
                    <span>{{ row.leftAt || '—' }}</span>
                    <span class="pst-dur" :class="row.durationMs ? 'dur-green' : 'dur-muted'">{{ row.durationMs ? formatDuration(row.durationMs) : 'in progress' }}</span>
                  </div>
                </div>

                <!-- Event Timeline -->
                <div class="timeline-label"><AlignLeft :size="13" /> Full Timeline</div>
                <div class="event-timeline">
                  <div v-for="(evt, idx) in card.dayEvents" :key="evt.id" class="te-row">
                    <div class="te-line-wrap">
                      <div class="te-dot" :class="evt.event === 'arrived' ? 'te-dot-green' : 'te-dot-red'" />
                      <div v-if="idx < card.dayEvents.length - 1" class="te-line" />
                    </div>
                    <div class="te-content">
                      <div class="te-head">
                        <span class="te-event-badge" :class="evt.event === 'arrived' ? 'teb-arrived' : 'teb-left'">
                          {{ evt.event === 'arrived' ? '→ Arrived' : '← Left' }}
                        </span>
                        <span class="te-project">{{ evt.projectName }}</span>
                        <span class="te-time">{{ formatTime(evt.timestamp) }}</span>
                      </div>
                      <div v-if="evt.event === 'left' && evt.durationMs" class="te-sub">
                        {{ formatDuration(evt.durationMs) }} on site
                      </div>
                      <div v-if="evt.gapAfterMs > 60000" class="te-gap-row">
                        <ArrowDown :size="11" style="color:var(--ct-muted);" />
                        <span class="te-gap-text">
                          {{ formatDuration(evt.gapAfterMs) }} between sites
                          <span v-if="evt.gapNote" style="color:var(--ct-muted);">· {{ evt.gapNote }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- MONTHLY TAB -->
            <div v-if="(cardActiveTab[card.techId] || 'today') === 'monthly'" class="tab-content">
              <div class="month-nav">
                <button class="btn-secondary btn-xs" @click="changeMonth(card.techId, -1)">‹ Prev</button>
                <span class="month-label">{{ getMonthLabel(card.techId) }}</span>
                <button class="btn-secondary btn-xs" @click="changeMonth(card.techId, 1)">Next ›</button>
              </div>

              <!-- Monthly stats chips -->
              <div class="day-summary-chips" style="margin-bottom:12px;">
                <div class="ds-chip ds-site">
                  <MapPin :size="13" /> Total On Site:
                  <strong>{{ formatHm(getMonthTotals(card.techId, card.userId).siteMs) }}</strong>
                </div>
                <div class="ds-chip ds-transit">
                  <Navigation :size="13" /> Total Transit:
                  <strong>{{ formatHm(getMonthTotals(card.techId, card.userId).betweenMs) }}</strong>
                </div>
                <div class="ds-chip ds-session">
                  <Clock :size="13" /> Working Days:
                  <strong>{{ getMonthTotals(card.techId, card.userId).workingDays }}</strong>
                </div>
                <div class="ds-chip ds-best">
                  <CheckCircle2 :size="13" /> Total Visits:
                  <strong>{{ getMonthTotals(card.techId, card.userId).visits }}</strong>
                </div>
              </div>

              <!-- Mini bar chart -->
              <div class="mini-chart-wrap">
                <template v-for="day in getMonthlyData(card.techId, card.userId)" :key="day.date">
                  <div v-if="day.siteMs > 0" class="mini-bar-col" :title="`${day.dateLabel}: ${formatHm(day.siteMs)} on site, ${day.visits} visits`">
                    <div class="mini-bar-inner">
                      <div class="mini-bar-fill" :style="{ height: barPct(day.siteMs, card.techId, card.userId) + '%' }" />
                    </div>
                    <div class="mini-bar-lbl">{{ day.dayNum }}</div>
                  </div>
                </template>
              </div>

              <!-- Monthly table -->
              <div class="monthly-table-wrap">
                <table class="monthly-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Day</th><th>Visits</th><th>On Site</th><th>Transit</th><th>Distance</th><th>Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="day in getMonthlyData(card.techId, card.userId)" :key="day.date"
                      :class="{ 'row-today': day.date === todayStr, 'row-empty': day.visits === 0 }">
                      <td>{{ day.dateLabel }}</td>
                      <td style="color:var(--ct-muted);font-size:11px;">{{ day.weekDay }}</td>
                      <td>{{ day.visits || '—' }}</td>
                      <td class="td-site">{{ day.siteMs ? formatHm(day.siteMs) : '—' }}</td>
                      <td class="td-transit">{{ day.betweenMs ? formatHm(day.betweenMs) : '—' }}</td>
                      <td class="td-dist">{{ getTechDayDistance(card.userId, day.date) ? formatDistance(getTechDayDistance(card.userId, day.date)) : '—' }}</td>
                      <td class="td-session">{{ day.sessionMs ? formatHm(day.sessionMs) : '—' }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="2"><strong>Total</strong></td>
                      <td><strong>{{ getMonthTotals(card.techId, card.userId).visits }}</strong></td>
                      <td class="td-site"><strong>{{ formatHm(getMonthTotals(card.techId, card.userId).siteMs) }}</strong></td>
                      <td class="td-transit"><strong>{{ formatHm(getMonthTotals(card.techId, card.userId).betweenMs) }}</strong></td>
                      <td class="td-dist"><strong>{{ formatDistance(getMonthTotals(card.techId, card.userId).distanceM) }}</strong></td>
                      <td class="td-session"><strong>{{ formatHm(getMonthTotals(card.techId, card.userId).sessionMs) }}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <!-- HISTORY TAB -->
            <div v-if="(cardActiveTab[card.techId] || 'today') === 'history'" class="tab-content">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
                <CalendarDays :size="14" style="color:var(--ct-muted);" />
                <input type="date" class="input input-sm" style="width:160px;"
                  :value="historyDate[card.techId] || filterDate"
                  :max="todayStr"
                  @input="historyDate[card.techId] = $event.target.value; loadAndDrawRoute(card.userId, $event.target.value)" />
                <button class="btn-secondary btn-xs" @click="loadAndDrawRoute(card.userId, historyDate[card.techId] || filterDate)">
                  <MapPin :size="12" /> Show Route
                </button>
                <button class="btn-secondary btn-xs" @click="exportHistoryDayExcel(card)">
                  <Download :size="12" /> Export Day
                </button>
              </div>
              <div v-if="getHistoryEvents(card.userId, historyDate[card.techId] || filterDate).length === 0" class="tac-empty">
                No events for this date.
              </div>
              <div v-else>
                <div class="day-summary-chips">
                  <div class="ds-chip ds-site">On Site: <strong>{{ formatHm(getHistoryAnalytics(card.userId, historyDate[card.techId] || filterDate).siteMs) }}</strong></div>
                  <div class="ds-chip ds-transit">Transit: <strong>{{ formatHm(getHistoryAnalytics(card.userId, historyDate[card.techId] || filterDate).betweenMs) }}</strong></div>
                  <div class="ds-chip ds-session">Visits: <strong>{{ getHistoryAnalytics(card.userId, historyDate[card.techId] || filterDate).visits }}</strong></div>
                </div>
                <div class="event-timeline">
                  <div v-for="(evt, idx) in getHistoryEvents(card.userId, historyDate[card.techId] || filterDate)" :key="evt.id" class="te-row">
                    <div class="te-line-wrap">
                      <div class="te-dot" :class="evt.event === 'arrived' ? 'te-dot-green' : 'te-dot-red'" />
                      <div v-if="idx < getHistoryEvents(card.userId, historyDate[card.techId] || filterDate).length - 1" class="te-line" />
                    </div>
                    <div class="te-content">
                      <div class="te-head">
                        <span class="te-event-badge" :class="evt.event === 'arrived' ? 'teb-arrived' : 'teb-left'">
                          {{ evt.event === 'arrived' ? '→ Arrived' : '← Left' }}
                        </span>
                        <span class="te-project">{{ evt.projectName }}</span>
                        <span class="te-time">{{ formatTime(evt.timestamp) }}</span>
                      </div>
                      <div v-if="evt.event === 'left' && evt.durationMs" class="te-sub">
                        {{ formatDuration(evt.durationMs) }} on site
                      </div>
                      <div v-if="evt.gapAfterMs > 60000" class="te-gap-row">
                        <ArrowDown :size="11" style="color:var(--ct-muted);" />
                        <span class="te-gap-text">{{ formatDuration(evt.gapAfterMs) }} between sites</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div><!-- /tac-body -->
        </div><!-- /card -->
      </div><!-- /tech-cards-list -->

    </template>
    <!-- ═══════════════════ END ADMIN VIEW ═══════════════════ -->

    <!-- ════════════════ TECHNICIAN SELF VIEW ════════════════ -->
    <template v-else>
      <div class="tech-self-layout">
        <div class="glass p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-base font-semibold text-slate-200">Location Sharing</h3>
              <p class="text-slate-500 text-sm mt-1">
                {{ isSharing ? 'Your location is visible to admin' : 'Start sharing to go live' }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="isSharing" class="badge badge-live"><span class="live-dot" />Live</span>
              <span v-else class="badge badge-offline">Offline</span>
            </div>
          </div>

          <div class="location-status-grid">
            <div class="location-stat">
              <MapPin :size="16" style="color:#6366f1;" />
              <div><div class="stat-label">Latitude</div><div class="stat-value">{{ currentLocation ? formatCoord(currentLocation.lat) : '—' }}</div></div>
            </div>
            <div class="location-stat">
              <Navigation :size="16" style="color:#6366f1;" />
              <div><div class="stat-label">Longitude</div><div class="stat-value">{{ currentLocation ? formatCoord(currentLocation.lng) : '—' }}</div></div>
            </div>
            <div class="location-stat">
              <Clock :size="16" style="color:#6366f1;" />
              <div><div class="stat-label">Last Updated</div><div class="stat-value">{{ lastUpdated || '—' }}</div></div>
            </div>
            <div class="location-stat">
              <Battery :size="16" style="color:#6366f1;" />
              <div><div class="stat-label">Battery</div><div class="stat-value">{{ batteryLevel !== null ? batteryLevel + '%' : '—' }}</div></div>
            </div>
            <div class="location-stat" style="grid-column:span 2;">
              <Signal :size="16" style="color:#10b981;" />
              <div>
                <div class="stat-label">Distance Traveled (this session)</div>
                <div class="stat-value" style="color:#10b981;">
                  {{ distanceTraveled >= 1000 ? (distanceTraveled / 1000).toFixed(2) + ' km' : distanceTraveled + ' m' }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="isSharing" class="mt-4">
            <label class="label">Current Status</label>
            <div class="status-btn-group">
              <button v-for="s in selfStatuses" :key="s.value"
                class="status-opt-btn" :class="{ 'status-opt-active': selfStatus === s.value }"
                @click="updateSelfStatus(s.value)">
                <component :is="s.icon" :size="13" />{{ s.label }}
              </button>
            </div>
          </div>

          <div v-if="geoError" class="geo-error"><AlertTriangle :size="14" />{{ geoError }}</div>

          <div class="flex gap-3 mt-6">
            <button v-if="!isSharing" class="btn-primary" :disabled="starting" @click="startSharing">
              <Loader2 v-if="starting" :size="14" class="spin" />
              <MapPin v-else :size="14" />
              {{ starting ? 'Getting Location...' : 'Start Sharing Location' }}
            </button>
            <button v-else class="btn-danger" :class="{ 'btn-danger-confirm': stoppingConfirm }" @click="handleStopClick">
              <XCircle :size="14" />{{ stoppingConfirm ? 'Tap again to confirm' : 'Stop Sharing' }}
            </button>
          </div>
        </div>

        <div class="glass map-panel-self">
          <div ref="selfMapRef" class="map-container" />
          <div v-if="!currentLocation" class="map-empty-overlay">
            <MapPin :size="40" style="color:#334155;" />
            <p style="color:#475569;font-size:13px;margin-top:8px;">Start sharing to see your location</p>
          </div>
        </div>
      </div>

      <div v-if="sessionStartTime" class="glass" style="margin-top:20px;padding:20px;">
        <div style="font-size:13px;font-weight:600;color:var(--ct-primary);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <Clock :size="15" style="color:#6366f1;" />Session Summary
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <div v-for="(mins, label) in selfSessionSummary" :key="label" class="visit-summary-chip"
            :class="label === 'Outside' ? 'chip-outside' : 'chip-site'">
            <span class="chip-label">{{ label }}</span>
            <span class="chip-mins">{{ mins }} min</span>
          </div>
        </div>
        <div v-if="sessionVisits.length" class="visit-feed" style="margin-top:14px;">
          <div v-for="evt in sessionVisits" :key="evt.id" class="visit-event"
            :class="evt.event === 'arrived' ? 'evt-arrived' : 'evt-left'">
            <div class="evt-icon">
              <CheckCircle2 v-if="evt.event === 'arrived'" :size="13" />
              <XCircle v-else :size="13" />
            </div>
            <div class="evt-body">
              <div class="evt-title">
                {{ evt.event === 'arrived' ? 'Reached site:' : 'Left site:' }}
                <strong>{{ evt.projectName }}</strong>
              </div>
              <div class="evt-meta">{{ evt.timeLabel }}<span v-if="evt.durationMs"> &bull; {{ formatDuration(evt.durationMs) }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="siteProjects.length" class="glass" style="margin-top:20px;padding:20px;">
        <div style="font-size:13px;font-weight:600;color:var(--ct-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <MapPin :size="15" style="color:#6366f1;" />Site Locations
          <span style="font-size:11px;color:var(--ct-muted);margin-left:auto;">{{ siteProjects.length }} site(s)</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div v-for="project in siteProjects" :key="project.id"
            class="site-location-card" :class="{ 'site-arrived': arrivedProjectIds.has(project.id) }">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:500;color:var(--ct-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ project.projectName }}</div>
              <div style="font-size:11px;color:var(--ct-muted);margin-top:3px;">
                {{ project.clientName }}<span v-if="project.city"> · {{ project.city }}</span>
                <span style="margin-left:8px;">Radius: {{ project.locationRadius || 0.5 }} km</span>
              </div>
              <div style="font-size:10px;color:#334155;margin-top:2px;">{{ project.locationLat }}, {{ project.locationLng }}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <span v-if="arrivedProjectIds.has(project.id)" class="badge badge-arrived">
                <CheckCircle2 :size="11" />Arrived
              </span>
              <button class="btn-go-to-site" @click="openSiteMap(project)">
                <ExternalLink :size="13" />Go to Site
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
    <!-- ════════════════ END TECH SELF VIEW ════════════════ -->

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  MapPin, RefreshCw, Battery, Navigation, Clock, AlertTriangle,
  Loader2, XCircle, Wifi, Briefcase, Circle, ExternalLink,
  CheckCircle2, Download, FileText, CalendarDays, ChevronDown,
  Crosshair, ArrowDown, AlignLeft, Signal, Bell,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useTrackingConfig } from '@/composables/useTrackingConfig'
import { savePDF } from '@/utils/saveFile'
import { subscribe, getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { db, auth as firebaseAuth } from '@/firebase/config'
import { signInAnonymously } from 'firebase/auth'
import { Capacitor, registerPlugin } from '@capacitor/core'
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation')
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Standard Google Maps light style (empty = default roadmap look)
const GOOGLE_DARK_STYLE = []

const auth = useAuthStore()
const ui   = useUIStore()
const { isRoleEnabled: isTrackingRoleEnabled, enabledRoles: trackingEnabledRoles, load: loadTrackingConfig } = useTrackingConfig()
// Non-technician roles see the admin overview panel; technicians see self-tracking
const isAdmin = computed(() => auth.user?.role !== 'technician')

// ── Map config ────────────────────────────────────────────────────────────────
let mapProvider = 'openstreetmap', googleMapsApiKey = '', mapboxToken = '', hereApiKey = ''
let adminMapType = 'leaflet', selfMapType = 'leaflet'

function docTsMs(ts) {
  if (!ts) return 0
  if (typeof ts.toDate === 'function') return ts.toDate().getTime()
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return new Date(ts).getTime()
}

async function loadMapConfig() {
  try {
    const docs = await getAll(Collections.CONFIGURATIONS)
    if (docs.length) {
      const cfg = docs.sort((a, b) => docTsMs(b.updatedAt) - docTsMs(a.updatedAt))[0]
      if (cfg.maps) {
        mapProvider = cfg.maps.provider || 'openstreetmap'
        googleMapsApiKey = cfg.maps.googleMapsApiKey || ''
        mapboxToken = cfg.maps.mapboxToken || ''
        hereApiKey = cfg.maps.hereApiKey || ''
      }
    }
  } catch { /* keep defaults */ }
}

async function loadGoogleMapsScript(apiKey) {
  if (window.google?.maps) return true
  try {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
      s.async = true; s.defer = true
      s.onload = res; s.onerror = () => rej(new Error('Google Maps failed'))
      document.head.appendChild(s)
    })
    return true
  } catch { return false }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateStr(d) { return d.toISOString().split('T')[0] }
const todayStr     = toDateStr(new Date())
const yesterdayStr = toDateStr(new Date(Date.now() - 86400000))

// ── Filter state ─────────────────────────────────────────────────────────────
const filterDate   = ref(todayStr)
const filterTechId = ref('')
const filterRole   = ref('')

// ── Card state ────────────────────────────────────────────────────────────────
const expandedCards  = ref(new Set())
const cardActiveTab  = reactive({})  // techId → 'today'|'monthly'|'history'
const cardMonth      = reactive({})  // techId → Date (for monthly nav)
const historyDate    = reactive({})  // techId → date string
const cardTabs = [
  { key: 'today',   label: 'Today / Selected' },
  { key: 'monthly', label: 'Monthly Report' },
  { key: 'history', label: 'History' },
]

function toggleCard(techId) {
  const s = new Set(expandedCards.value)
  if (s.has(techId)) {
    s.delete(techId)
  } else {
    s.add(techId)
    if (adminMap) loadAndDrawRoute(techId, filterDate.value)
  }
  expandedCards.value = s
}
function setCardTab(techId, key) { cardActiveTab[techId] = key }
function changeMonth(techId, delta) {
  const cur = cardMonth[techId] || new Date()
  const d = new Date(cur); d.setMonth(d.getMonth() + delta)
  cardMonth[techId] = d
}
function getMonthLabel(techId) {
  const d = cardMonth[techId] || new Date()
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
function clearFilter() { filterDate.value = todayStr; filterTechId.value = ''; filterRole.value = '' }

// ── Map refs / instances ──────────────────────────────────────────────────────
const mapRef     = ref(null)
const selfMapRef = ref(null)
let adminMap = null, selfMap = null, selfMarker = null
const markers         = {}
const siteMarkers     = {}
const adminSiteMarkers = {}
let unsubReconnect = null
let reconnectLastHandledMs = 0

// ── Core state ────────────────────────────────────────────────────────────────
const technicianLocations = ref([])
const siteVisitEvents     = ref([])
const selectedTech        = ref(null)
const refreshing          = ref(false)
const isSharing           = ref(false)
const stoppingConfirm = ref(false)
let stopConfirmTimer = null
const starting            = ref(false)
const currentLocation     = ref(null)
const lastUpdated         = ref(null)
const selfStatus          = ref('online')
const batteryLevel        = ref(null)
const geoError            = ref('')
let watchId = null, watcherId = null  // watchId = browser API, watcherId = background plugin
let unsubLocations = null, unsubVisits = null, unsubProjects = null, unsubSessions = null
let locationDocId = null
let lastHistoryWriteMs = 0
let lastPosition = null  // { lat, lng } — for distance accumulation
let lastLocationMs = 0   // timestamp of last GPS update — used by watchdog
let wakeLockSentinel = null
let watchdogInterval  = null
const HISTORY_INTERVAL = 60 * 1000  // 1 min — more accurate route reconstruction
const distanceTraveled = ref(0)  // meters traveled this session

// ── Admin: session history, route drawing, staleness ─────────────────────────
const STALE_THRESHOLD_MS = 5 * 60 * 1000   // 5 min without update = lost signal
const trackingSessions   = ref([])
const routePolylines     = {}               // userId → polyline instance
const liveRouteBuffer    = reactive({})     // userId → [[lat,lng], ...] real-time buffer
const loadingRoutes      = reactive({})
let   heartbeatInterval  = null
const offlineEventQueue  = []   // { docId, data } — geofence events queued while offline

// ── Session checkpoint (localStorage — survives app kills, updated every GPS point) ──
function _ckKey() { return `avant_ck_${auth.user?.id || auth.user?.username || 'anon'}` }
function saveSessionCheckpoint() {
  try {
    localStorage.setItem(_ckKey(), JSON.stringify({
      date: toDateStr(new Date()),
      distanceTraveled: distanceTraveled.value,
      sessionStartTime,
      lat: lastPosition?.lat ?? null,
      lng: lastPosition?.lng ?? null,
    }))
  } catch {}
}
function loadSessionCheckpoint() {
  try {
    const raw = localStorage.getItem(_ckKey())
    if (!raw) return null
    const c = JSON.parse(raw)
    return c.date === toDateStr(new Date()) ? c : null
  } catch { return null }
}
function clearSessionCheckpoint() {
  try { localStorage.removeItem(_ckKey()) } catch {}
}

// ── Offline location queue (localStorage-backed, survives app kills) ──────────
function _lqKey() { return `avant_locq_${auth.user?.id || auth.user?.username || 'anon'}` }
function loadOfflineLocationQueue() { try { return JSON.parse(localStorage.getItem(_lqKey()) || '[]') } catch { return [] } }
function saveOfflineLocationQueue(q) { try { localStorage.setItem(_lqKey(), JSON.stringify(q.slice(-300))) } catch {} }
async function flushOfflineLocationQueue() {
  const q = loadOfflineLocationQueue()
  if (!q.length) return
  const done = []
  for (const item of q) {
    try {
      await setDoc(doc(db, 'locationHistory', item.docId), {
        ...item.data,
        timestamp: new Date(item.ts),
      })
      done.push(item.docId)
    } catch { break }  // still offline — stop and retry next time
  }
  if (done.length) saveOfflineLocationQueue(q.filter(i => !done.includes(i.docId)))
}

let sessionStartTime = null
const arrivalTimes  = {}
const sessionVisits = ref([])
const allProjects   = ref([])
const arrivedProjectIds = ref(new Set())

const selfStatuses = [
  { value: 'online',  label: 'Online',  icon: Wifi },
  { value: 'on-job',  label: 'On Job',  icon: Briefcase },
  { value: 'offline', label: 'Offline', icon: Circle },
]

const siteProjects = computed(() => allProjects.value.filter(p => p.locationLat && p.locationLng))

// ── Analytics helpers ─────────────────────────────────────────────────────────
function getEventsForDay(userId, dateStr) {
  return siteVisitEvents.value
    .filter(e => {
      const d = e.timestamp?.toDate?.() || new Date(e.timestamp || 0)
      return e.userId === userId && toDateStr(d) === dateStr
    })
    .sort((a, b) => {
      const ta = (a.timestamp?.toDate?.() || new Date(a.timestamp)).getTime()
      const tb = (b.timestamp?.toDate?.() || new Date(b.timestamp)).getTime()
      return ta - tb
    })
}

function enrichWithGaps(events) {
  return events.map((evt, i) => {
    const next = events[i + 1]
    let gapAfterMs = 0, gapNote = ''
    if (evt.event === 'left' && next) {
      const tLeft   = (evt.timestamp?.toDate?.() || new Date(evt.timestamp)).getTime()
      const tNext   = (next.timestamp?.toDate?.() || new Date(next.timestamp)).getTime()
      gapAfterMs = Math.max(0, tNext - tLeft)
      if (gapAfterMs > 60 * 60 * 1000) gapNote = 'possible break'
    }
    return { ...evt, gapAfterMs, gapNote }
  })
}

function dayAnalytics(userId, dateStr) {
  const raw    = getEventsForDay(userId, dateStr)
  const events = enrichWithGaps(raw)
  const siteMs = raw.filter(e => e.event === 'left' && e.durationMs).reduce((s, e) => s + e.durationMs, 0)
  const betweenMs = events.filter(e => e.event === 'left' && e.gapAfterMs).reduce((s, e) => s + e.gapAfterMs, 0)
  const visits = raw.filter(e => e.event === 'left').length
  const times  = raw.map(e => (e.timestamp?.toDate?.() || new Date(e.timestamp)).getTime())
  const sessionMs = times.length >= 2 ? (Math.max(...times) - Math.min(...times)) + (raw[raw.length - 1]?.durationMs || 0) : siteMs

  // Per-site breakdown (pair arrived+left)
  const siteBreakdown = []
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].event === 'arrived') {
      const left = raw.find((e, j) => j > i && e.event === 'left' && e.projectId === raw[i].projectId)
      siteBreakdown.push({
        projectId:   raw[i].projectId,
        projectName: raw[i].projectName,
        arrivedAt:   formatTime(raw[i].timestamp),
        leftAt:      left ? formatTime(left.timestamp) : null,
        durationMs:  left?.durationMs || 0,
      })
    }
  }

  const longestSite = siteBreakdown.reduce((best, r) => r.durationMs > (best?.durationMs || 0) ? r : best, null)

  return { siteMs, betweenMs, visits, sessionMs, events, siteBreakdown, longestSite }
}

// ── Distance helpers (admin) ──────────────────────────────────────────────────

/**
 * Returns total distance (meters) traveled by a tech on a given date.
 * - For today with an active session: completed sessions + live running odometer.
 * - For past dates: sums totalDistanceM from stop events only.
 */
function getTechDayDistance(userId, dateStr) {
  const completedM = trackingSessions.value
    .filter(s => s.userId === userId && s.event === 'stop' && s.date === dateStr)
    .reduce((sum, s) => sum + (s.totalDistanceM || 0), 0)

  if (dateStr === todayStr) {
    const techDoc = technicianLocations.value.find(t => t.userId === userId)
    if (techDoc?.distanceTraveled) {
      if (techDoc.isActive !== false) {
        // Active session — live odometer on top of any already-completed sessions today
        return completedM + techDoc.distanceTraveled
      } else {
        // Stopped session — location doc distance is the fallback if the stop event write failed
        return Math.max(completedM, techDoc.distanceTraveled)
      }
    }
  }
  return completedM
}

function formatDistance(m) {
  if (!m || m <= 0) return '0m'
  return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m'
}

/**
 * Load locationHistory points for a tech on a date, draw route polyline on admin map.
 * Called on card expand and on focusTechnician.
 */
async function loadAndDrawRoute(userId, dateStr) {
  if (!adminMap || loadingRoutes[userId]) return
  loadingRoutes[userId] = true
  try {
    // No orderBy → avoids composite-index requirement; sort client-side instead
    const qRef = query(
      collection(db, 'locationHistory'),
      where('userId', '==', userId),
      where('date',   '==', dateStr),
    )
    const snap = await getDocs(qRef)
    const historical = snap.docs
      .map(d => {
        const v = d.data()
        const ts = v.timestamp?.seconds ?? (v.timestamp?.toDate ? v.timestamp.toDate().getTime() / 1000 : 0)
        return { lat: Number(v.lat), lng: Number(v.lng), ts }
      })
      .filter(p => p.lat && p.lng)
      .sort((a, b) => a.ts - b.ts)
      .map(p => [p.lat, p.lng])

    // For today, fall back to / append in-memory live buffer
    const live = dateStr === todayStr ? (liveRouteBuffer[userId] || []) : []
    const points = historical.length >= 2 ? historical : (live.length >= 2 ? live : [...historical, ...live])

    // Remove previous polyline
    if (routePolylines[userId]) {
      if (adminMapType === 'google') routePolylines[userId].setMap(null)
      else routePolylines[userId].remove()
      delete routePolylines[userId]
    }
    if (points.length < 2) return

    if (adminMapType === 'google') {
      routePolylines[userId] = new window.google.maps.Polyline({
        path: points.map(([lat, lng]) => ({ lat, lng })),
        geodesic: true, strokeColor: '#6366f1', strokeOpacity: 0.8, strokeWeight: 3, map: adminMap,
      })
    } else {
      routePolylines[userId] = L.polyline(points, { color: '#6366f1', weight: 3, opacity: 0.8 }).addTo(adminMap)
    }
  } catch (e) {
    console.warn('[Tracking] route load failed:', e)
  } finally {
    loadingRoutes[userId] = false
  }
}

function clearAllRoutePolylines() {
  Object.values(routePolylines).forEach(pl => {
    if (adminMapType === 'google') pl.setMap(null)
    else pl.remove()
  })
  Object.keys(routePolylines).forEach(k => delete routePolylines[k])
  Object.keys(liveRouteBuffer).forEach(k => delete liveRouteBuffer[k])
}

// Pre-seed liveRouteBuffer from Firestore so routes appear on fresh page load / reconnect
async function seedLiveRouteBuffers(dateStr) {
  const techs = technicianLocations.value.filter(t => t.userId)
  for (const tech of techs) {
    if ((liveRouteBuffer[tech.userId] || []).length > 1) continue  // already seeded
    try {
      const snap = await getDocs(query(
        collection(db, 'locationHistory'),
        where('userId', '==', tech.userId),
        where('date',   '==', dateStr),
      ))
      const pts = snap.docs
        .map(d => { const v = d.data(); return { lat: Number(v.lat), lng: Number(v.lng), ts: v.timestamp?.seconds || 0 } })
        .filter(p => p.lat && p.lng)
        .sort((a, b) => a.ts - b.ts)
        .map(p => [p.lat, p.lng])
      if (pts.length) liveRouteBuffer[tech.userId] = pts
    } catch {}
  }
}

// ── Wake lock — prevent device sleep while tracking ───────────────────────────
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return
  try { wakeLockSentinel = await navigator.wakeLock.request('screen') } catch {}
}
function releaseWakeLock() {
  if (wakeLockSentinel) { wakeLockSentinel.release().catch(() => {}); wakeLockSentinel = null }
}

// ── Watchdog — detect silent GPS failure and restart native watcher ───────────
function startWatchdog() {
  if (watchdogInterval) return
  watchdogInterval = setInterval(async () => {
    if (!isSharing.value) { stopWatchdog(); return }
    if (lastLocationMs > 0 && Date.now() - lastLocationMs > 3 * 60 * 1000) {
      console.warn('[Tracking] Watchdog: no GPS for 3min, restarting watcher')
      await restartNativeWatcher()
    }
  }, 60 * 1000)
}
function stopWatchdog() {
  if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null }
}
async function restartNativeWatcher() {
  if (!Capacitor.isNativePlatform()) return
  if (watcherId !== null) {
    await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {})
    watcherId = null
  }
  watcherId = await BackgroundGeolocation.addWatcher(
    { backgroundMessage: 'Avant Elevators is tracking your location for site visits.', backgroundTitle: 'Location Sharing Active', requestPermissions: false, stale: false, distanceFilter: 10 },
    async (location, error) => {
      if (error) { if (error.code !== 'NOT_AUTHORIZED') setTimeout(() => restartNativeWatcher(), 15000); return }
      await handleLocationUpdate(location.latitude, location.longitude, location.speed, location.accuracy)
    }
  )
}

// ── Heartbeat — writes a fresh timestamp every 30 s so admin detects stale status ──
function startHeartbeat() {
  if (heartbeatInterval) return
  heartbeatInterval = setInterval(() => {
    if (!isSharing.value || !locationDocId) return
    const userId = auth.user?.id || auth.user?.username
    setDoc(doc(db, 'technicianLocations', userId), { timestamp: serverTimestamp() }, { merge: true }).catch(() => {})
  }, 30000)
}
function stopHeartbeat() {
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null }
}

// ── Offline-resilient geofence writer ─────────────────────────────────────────
// Queues events if the network is down; flushed on reconnect.
async function writeGeofenceEvent(docId, data) {
  try {
    await setDoc(doc(db, 'siteVisitEvents', docId), data)
  } catch {
    offlineEventQueue.push({ docId, data })
  }
}

async function flushOfflineQueue() {
  if (!offlineEventQueue.length) return
  const pending = offlineEventQueue.splice(0)
  for (const item of pending) {
    try {
      await setDoc(doc(db, 'siteVisitEvents', item.docId), item.data)
    } catch {
      offlineEventQueue.unshift(item)  // re-queue at front if still failing
      break
    }
  }
}

// Called when browser/Android fires the 'online' event
function handleNetworkReconnect() {
  flushOfflineQueue()
  flushOfflineLocationQueue()
  if (isSharing.value) {
    // Immediately push current in-memory state so Firestore is up to date for any future resume
    const userId = auth.user?.id || auth.user?.username
    if (userId) {
      const patch = { distanceTraveled: distanceTraveled.value, timestamp: serverTimestamp(), isActive: true, status: selfStatus.value }
      if (lastPosition) { patch.lat = lastPosition.lat; patch.lng = lastPosition.lng }
      setDoc(doc(db, 'technicianLocations', userId), patch, { merge: true }).catch(() => {})
    }
    checkGeofencing()
  }
}

// ── Enabled tracking roles for filter (non-admin roles that have tracking enabled) ─
const trackingRoleOptions = computed(() =>
  trackingEnabledRoles().filter(r => r !== 'admin').map(r => ({ key: r, label: ROLES[r]?.label || r }))
)

// ── uniqueTechs for filter dropdown ──────────────────────────────────────────
const uniqueTechs = computed(() => {
  const map = {}
  siteVisitEvents.value.forEach(e => { if (!map[e.userId]) map[e.userId] = { userId: e.userId, userName: e.userName, role: e.role || 'technician' } })
  technicianLocations.value.forEach(t => { if (!map[t.userId]) map[t.userId] = { userId: t.userId, userName: t.userName, role: t.role || 'technician' } })
  return Object.values(map).sort((a, b) => a.userName.localeCompare(b.userName))
})

// ── filteredTechCards ─────────────────────────────────────────────────────────
const filteredTechCards = computed(() => {
  const date = filterDate.value
  const techMap = {}
  // Build role lookup from live location docs (role is stored when sharing starts)
  const roleByUserId = {}
  technicianLocations.value.forEach(t => { roleByUserId[t.userId] = t.role || 'technician' })

  // Collect from events for the date
  siteVisitEvents.value.forEach(e => {
    const d = e.timestamp?.toDate?.() || new Date(e.timestamp || 0)
    if (toDateStr(d) === date) {
      if (!techMap[e.userId]) techMap[e.userId] = { userId: e.userId, userName: e.userName, role: roleByUserId[e.userId] || e.role || 'technician' }
    }
  })
  // Always include live technicians
  technicianLocations.value.forEach(t => {
    if (!techMap[t.userId]) techMap[t.userId] = { userId: t.userId, userName: t.userName, role: t.role || 'technician' }
  })

  let techs = Object.values(techMap)
  if (filterTechId.value) techs = techs.filter(t => t.userId === filterTechId.value)
  if (filterRole.value) techs = techs.filter(t => t.role === filterRole.value)

  return techs.map(tech => {
    const live = technicianLocations.value.find(t => t.userId === tech.userId)
    const a    = dayAnalytics(tech.userId, date)
    return {
      techId:       tech.userId,
      userId:       tech.userId,
      userName:     tech.userName,
      isLive:       !!live && live.isActive !== false && (Date.now() - docTsMs(live.timestamp)) < STALE_THRESHOLD_MS,
      isStale:      !!live && live.isActive !== false && (Date.now() - docTsMs(live.timestamp)) >= STALE_THRESHOLD_MS,
      liveStatus:   live?.status,
      lastSeen:     live?.timestamp,
      battery:      live?.battery,
      lat:          live?.lat,
      lng:          live?.lng,
      daySiteMs:    a.siteMs,
      dayBetweenMs: a.betweenMs,
      dayVisits:    a.visits,
      daySessionMs: a.sessionMs,
      dayDistanceM: getTechDayDistance(tech.userId, date),
      dayEvents:    a.events,
      siteBreakdown: a.siteBreakdown,
      longestSite:  a.longestSite ? `${a.longestSite.projectName} (${formatDuration(a.longestSite.durationMs)})` : null,
    }
  }).sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1
    return b.daySiteMs - a.daySiteMs
  })
})

// ── Overview stats ────────────────────────────────────────────────────────────
const overviewStats = computed(() => {
  const cards = filteredTechCards.value
  const totalSiteMs    = cards.reduce((s, c) => s + c.daySiteMs, 0)
  const totalBetweenMs = cards.reduce((s, c) => s + c.dayBetweenMs, 0)
  const totalVisits    = cards.reduce((s, c) => s + c.dayVisits, 0)
  const totalDistanceM = cards.reduce((s, c) => s + (c.dayDistanceM || 0), 0)
  const activeTechs    = cards.filter(c => c.dayVisits > 0 || c.isLive).length
  const avgSite        = totalVisits > 0 ? Math.round(totalSiteMs / totalVisits / 60000) : 0
  return {
    liveNow:          technicianLocations.value.filter(t => t.isActive !== false && (Date.now() - docTsMs(t.timestamp)) < STALE_THRESHOLD_MS).length,
    siteHours:        (totalSiteMs / 3600000).toFixed(1),
    visits:           totalVisits,
    techsToday:       activeTechs,
    avgSite:          avgSite + 'm',
    totalBetween:     formatHm(totalBetweenMs),
    totalDistanceKm:  formatDistance(totalDistanceM),
  }
})

// ── Monthly helpers ───────────────────────────────────────────────────────────
function getMonthlyData(techId, userId) {
  const ref = cardMonth[techId] || new Date()
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const days = new Date(year, month + 1, 0).getDate()
  const result = []
  for (let d = 1; d <= days; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dt = new Date(dateStr + 'T12:00:00')
    const a  = dayAnalytics(userId, dateStr)
    result.push({
      date: dateStr,
      dateLabel: dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      weekDay: dt.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: d,
      ...a,
    })
  }
  return result
}

function getMonthTotals(techId, userId) {
  const data = getMonthlyData(techId, userId)
  return {
    siteMs:      data.reduce((s, d) => s + d.siteMs, 0),
    betweenMs:   data.reduce((s, d) => s + d.betweenMs, 0),
    sessionMs:   data.reduce((s, d) => s + d.sessionMs, 0),
    visits:      data.reduce((s, d) => s + d.visits, 0),
    workingDays: data.filter(d => d.visits > 0).length,
    distanceM:   data.reduce((s, d) => s + getTechDayDistance(userId, d.date), 0),
  }
}

function barPct(siteMs, techId, userId) {
  const data = getMonthlyData(techId, userId)
  const max  = Math.max(...data.map(d => d.siteMs), 1)
  return Math.round((siteMs / max) * 90)
}

function getHistoryEvents(userId, dateStr) {
  return enrichWithGaps(getEventsForDay(userId, dateStr))
}

function getHistoryAnalytics(userId, dateStr) {
  return dayAnalytics(userId, dateStr)
}

// ── Format helpers ────────────────────────────────────────────────────────────
function formatHm(ms) {
  if (!ms || ms <= 0) return '0m'
  const total = Math.round(ms / 60000)
  if (total < 60) return `${total}m`
  const h = Math.floor(total / 60), m = total % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
function formatDuration(ms) {
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}
function getInitials(name) {
  return (name || 'T').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function formatCoord(val) { return Number(val).toFixed(5) }
function formatTime(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
function getStatusBadgeClass(status) {
  return { online: 'badge-green', 'on-job': 'badge-amber', offline: 'badge-slate' }[status] || 'badge-green'
}
function getStatusClass(status) {
  return { online: 'dot-online', 'on-job': 'dot-job', offline: 'dot-offline' }[status] || 'dot-online'
}

// ── Export ────────────────────────────────────────────────────────────────────
async function exportTechExcel(card) {
  const XLSX = await import('xlsx')
  const wb   = XLSX.utils.book_new()

  // Events sheet
  const evRows = card.dayEvents.map(e => ({
    Time: formatTime(e.timestamp), Event: e.event === 'arrived' ? 'Arrived' : 'Left',
    Project: e.projectName,
    'On Site': e.event === 'left' && e.durationMs ? formatDuration(e.durationMs) : '—',
    'Transit After': e.gapAfterMs > 0 ? formatDuration(e.gapAfterMs) : '—',
  }))
  evRows.push({}, { Time: 'Summary', Project: '', Event: '' },
    { Time: 'On Site',  Event: formatHm(card.daySiteMs) },
    { Time: 'Transit',  Event: formatHm(card.dayBetweenMs) },
    { Time: 'Distance', Event: formatDistance(card.dayDistanceM) },
    { Time: 'Visits',   Event: String(card.dayVisits) })

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evRows), filterDate.value)

  // Monthly sheet
  const monthRows = getMonthlyData(card.techId, card.userId).map(d => ({
    Date: d.dateLabel, Day: d.weekDay, Visits: d.visits || 0,
    'On Site (hrs)': +(d.siteMs / 3600000).toFixed(2),
    'Transit (hrs)': +(d.betweenMs / 3600000).toFixed(2),
    'Session (hrs)': +(d.sessionMs / 3600000).toFixed(2),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthRows), getMonthLabel(card.techId).replace(' ', '_'))

  XLSX.utils.writeFile(wb, `${card.userName.replace(/\s+/g, '_')}_Tracking.xlsx`)
  ui.success(`Exported ${card.userName}'s report`)
}

async function exportTechMonthExcel(card) {
  const XLSX  = await import('xlsx')
  const wb    = XLSX.utils.book_new()
  const rows  = getMonthlyData(card.techId, card.userId).map(d => ({
    Date: d.dateLabel, Day: d.weekDay, Visits: d.visits || 0,
    'On Site': formatHm(d.siteMs), Transit: formatHm(d.betweenMs), Session: formatHm(d.sessionMs),
    Distance: formatDistance(getTechDayDistance(card.userId, d.date)),
  }))
  const totals = getMonthTotals(card.techId, card.userId)
  rows.push({}, { Date: 'TOTAL', Day: '', Visits: totals.visits,
    'On Site': formatHm(totals.siteMs), Transit: formatHm(totals.betweenMs), Session: formatHm(totals.sessionMs),
    Distance: formatDistance(totals.distanceM) })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Monthly')
  XLSX.utils.writeFile(wb, `${card.userName.replace(/\s+/g, '_')}_${getMonthLabel(card.techId).replace(' ', '_')}.xlsx`)
}

async function exportHistoryDayExcel(card) {
  const date = historyDate[card.techId] || filterDate.value
  const fakeCard = { ...card, daySiteMs: 0, dayBetweenMs: 0, dayVisits: 0, dayEvents: getHistoryEvents(card.userId, date) }
  const a = getHistoryAnalytics(card.userId, date)
  fakeCard.daySiteMs = a.siteMs; fakeCard.dayBetweenMs = a.betweenMs; fakeCard.dayVisits = a.visits
  await exportTechExcel({ ...fakeCard, dayEvents: fakeCard.dayEvents })
}

async function exportAllExcel() {
  const XLSX = await import('xlsx')
  const wb   = XLSX.utils.book_new()
  const summaryRows = filteredTechCards.value.map(c => ({
    Technician: c.userName, Date: filterDate.value, Visits: c.dayVisits,
    'On Site': formatHm(c.daySiteMs), Transit: formatHm(c.dayBetweenMs),
    Distance: formatDistance(c.dayDistanceM),
    Session: formatHm(c.daySessionMs), Status: c.isLive ? 'Live' : 'Offline',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary')

  for (const card of filteredTechCards.value) {
    if (card.dayEvents.length === 0) continue
    const rows = card.dayEvents.map(e => ({
      Time: formatTime(e.timestamp), Event: e.event, Project: e.projectName,
      'On Site': e.event === 'left' && e.durationMs ? formatDuration(e.durationMs) : '—',
      'Transit After': e.gapAfterMs > 0 ? formatDuration(e.gapAfterMs) : '—',
    }))
    const sheetName = card.userName.slice(0, 28).replace(/[/:*?[\]\\]/g, '')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName)
  }

  XLSX.utils.writeFile(wb, `Tracking_${filterDate.value}.xlsx`)
  ui.success('Exported all technician data')
}

async function exportAllPDF() {
  const { jsPDF } = await import('jspdf')
  const autoTable  = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFontSize(14)
  doc.text(`Tracking Report — ${filterDate.value}`, 14, 15)

  const body = filteredTechCards.value.map(c => [
    c.userName, String(c.dayVisits), formatHm(c.daySiteMs),
    formatHm(c.dayBetweenMs), formatHm(c.daySessionMs), c.isLive ? 'Live' : 'Offline',
  ])

  autoTable(doc, {
    head: [['Technician', 'Visits', 'On Site', 'Transit', 'Session', 'Status']],
    body,
    startY: 22,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  await savePDF(doc, `Tracking_${filterDate.value}.pdf`, ui)
  ui.success('PDF exported')
}

// ── Map init (admin) ──────────────────────────────────────────────────────────
async function initAdminMap() {
  if (!mapRef.value || adminMap) return
  if (mapProvider === 'google' && googleMapsApiKey) {
    const loaded = await loadGoogleMapsScript(googleMapsApiKey)
    if (loaded) {
      adminMap = new window.google.maps.Map(mapRef.value, {
        center: { lat: 20.5937, lng: 78.9629 }, zoom: 5,
        styles: GOOGLE_DARK_STYLE, mapTypeControl: false, streetViewControl: false,
      })
      adminMapType = 'google'; return
    }
  }
  adminMap = L.map(mapRef.value, { zoomControl: true, attributionControl: false }).setView([20.5937, 78.9629], 5)
  addLeafletTiles(adminMap); adminMapType = 'leaflet'
}

function addLeafletTiles(map) {
  if (mapProvider === 'mapbox' && mapboxToken) {
    // Mapbox Streets — light, Google Maps-like
    L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
      { maxZoom: 22, tileSize: 512, zoomOffset: -1 },
    ).addTo(map)
  } else if (mapProvider === 'here' && hereApiKey) {
    // HERE Explore Day — light style
    L.tileLayer(
      `https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png8?style=explore.day&apiKey=${hereApiKey}`,
      { maxZoom: 20 },
    ).addTo(map)
  } else {
    // CartoDB Voyager — free, no API key, clean Google Maps-like appearance
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, subdomains: 'abcd', attribution: '© OpenStreetMap contributors © CARTO' },
    ).addTo(map)
  }
}

function updateAdminMarkers() {
  if (!adminMap) return
  // Only show markers for techs that are actively sharing (not stopped sessions)
  const activeTechs = technicianLocations.value.filter(t => t.isActive !== false)
  const activeIds = new Set(activeTechs.map(t => t.userId))
  Object.keys(markers).forEach(id => {
    if (!activeIds.has(id)) {
      adminMapType === 'google' ? markers[id].setMap(null) : markers[id].remove()
      delete markers[id]
    }
  })
  activeTechs.forEach(tech => {
    if (!tech.lat || !tech.lng) return
    const color = tech.status === 'on-job' ? '#f59e0b' : '#6366f1'
    const initials = getInitials(tech.userName)
    const popup = `<b>${tech.userName}</b><br>${tech.status || 'online'}<br>${formatTime(tech.timestamp)}`
    if (adminMapType === 'google') {
      const pos = { lat: Number(tech.lat), lng: Number(tech.lng) }
      if (markers[tech.userId]) { markers[tech.userId].setPosition(pos) }
      else {
        const m = new window.google.maps.Marker({
          position: pos, map: adminMap, title: tech.userName,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 18, fillColor: color, fillOpacity: 1, strokeColor: 'rgba(255,255,255,0.4)', strokeWeight: 2 },
          label: { text: initials, color: '#fff', fontWeight: '700', fontSize: '11px' },
        })
        const iw = new window.google.maps.InfoWindow({ content: `<div style="color:#1e293b;padding:4px;">${popup}</div>` })
        m.addListener('click', () => iw.open(adminMap, m)); m._iw = iw
        markers[tech.userId] = m
      }
    } else {
      const icon = L.divIcon({ html: `<div class="tech-map-pin" style="background:${color}">${initials}</div>`, className: '', iconSize: [36, 36], iconAnchor: [18, 18] })
      if (markers[tech.userId]) markers[tech.userId].setLatLng([tech.lat, tech.lng]).setIcon(icon)
      else markers[tech.userId] = L.marker([tech.lat, tech.lng], { icon }).addTo(adminMap).bindPopup(popup)
    }
  })
  const pts = activeTechs.filter(t => t.lat && t.lng)
  if (!pts.length) return
  if (adminMapType === 'google') {
    if (pts.length === 1) { adminMap.setCenter({ lat: Number(pts[0].lat), lng: Number(pts[0].lng) }); adminMap.setZoom(13) }
    else { const b = new window.google.maps.LatLngBounds(); pts.forEach(t => b.extend({ lat: Number(t.lat), lng: Number(t.lng) })); adminMap.fitBounds(b) }
  } else {
    adminMap.fitBounds(pts.map(t => [t.lat, t.lng]), { padding: [40, 40] })
  }
}

function focusTechnician(card) {
  selectedTech.value = card
  if (!adminMap || !card.lat || !card.lng) return
  if (adminMapType === 'google') {
    adminMap.setCenter({ lat: Number(card.lat), lng: Number(card.lng) }); adminMap.setZoom(15)
    markers[card.techId]?._iw?.open(adminMap, markers[card.techId])
  } else {
    adminMap.setView([card.lat, card.lng], 15)
    markers[card.techId]?.openPopup()
  }
  loadAndDrawRoute(card.techId, filterDate.value)
}

async function sendReconnectRequest(card) {
  try {
    const adminName = auth.user?.fullName || auth.user?.username || 'Admin'
    await setDoc(doc(db, 'technicianLocations', card.userId), {
      reconnectRequest: { at: serverTimestamp(), by: adminName },
    }, { merge: true })
    ui.success(`Reconnect request sent to ${card.userName}`)
  } catch (e) {
    ui.error('Failed to send reconnect request: ' + e.message)
  }
}

async function refreshLocations() {
  refreshing.value = true; updateAdminMarkers()
  setTimeout(() => { refreshing.value = false }, 700)
}

// ── Self map ──────────────────────────────────────────────────────────────────
async function initSelfMap() {
  if (!selfMapRef.value || selfMap) return
  if (mapProvider === 'google' && googleMapsApiKey) {
    const loaded = await loadGoogleMapsScript(googleMapsApiKey)
    if (loaded) {
      selfMap = new window.google.maps.Map(selfMapRef.value, {
        center: { lat: 20.5937, lng: 78.9629 }, zoom: 13,
        styles: GOOGLE_DARK_STYLE, mapTypeControl: false, streetViewControl: false,
      })
      selfMapType = 'google'; updateSiteMarkers(); return
    }
  }
  selfMap = L.map(selfMapRef.value, { zoomControl: true, attributionControl: false }).setView([20.5937, 78.9629], 13)
  addLeafletTiles(selfMap); selfMapType = 'leaflet'; updateSiteMarkers()
}

function updateAdminSiteMarkers() {
  if (!adminMap) return
  siteProjects.value.forEach(project => {
    const { locationLat: lat, locationLng: lng, locationRadius: radius, projectName, clientName, id } = project
    if (!lat || !lng || adminSiteMarkers[id]) return
    const popupHtml = `<b>${projectName}</b>${clientName ? '<br>' + clientName : ''}<br>Radius: ${radius || 0.5} km`
    if (adminMapType === 'google') {
      const pos = { lat: Number(lat), lng: Number(lng) }
      const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#f59e0b" stroke="white" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
      const m = new window.google.maps.Marker({
        position: pos, map: adminMap, title: projectName,
        icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgPin), scaledSize: new window.google.maps.Size(30, 30), anchor: new window.google.maps.Point(15, 30) },
      })
      const iw = new window.google.maps.InfoWindow({ content: `<div style="color:#1e293b;padding:4px;font-size:12px;">${popupHtml}</div>` })
      m.addListener('click', () => iw.open(adminMap, m))
      const c = new window.google.maps.Circle({ center: pos, radius: (radius || 0.5) * 1000, map: adminMap, strokeColor: '#f59e0b', strokeOpacity: 0.6, strokeWeight: 1.5, fillColor: '#f59e0b', fillOpacity: 0.08 })
      adminSiteMarkers[id] = { marker: m, circle: c }
    } else {
      const icon = L.divIcon({ html: `<div style="background:#f59e0b;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid white;"><span style="transform:rotate(45deg);font-size:13px;">🏗</span></div>`, className: '', iconSize: [28, 28], iconAnchor: [14, 28] })
      const m = L.marker([Number(lat), Number(lng)], { icon }).addTo(adminMap).bindPopup(popupHtml)
      const c = L.circle([Number(lat), Number(lng)], { radius: (radius || 0.5) * 1000, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.08, weight: 1.5, dashArray: '6 4' }).addTo(adminMap)
      adminSiteMarkers[id] = { marker: m, circle: c }
    }
  })
}

function updateSiteMarkers() {
  if (!selfMap) return
  siteProjects.value.forEach(({ locationLat: lat, locationLng: lng, locationRadius: radius, projectName, id }) => {
    if (!lat || !lng || siteMarkers[id]) return
    if (selfMapType === 'google') {
      const pos = { lat: Number(lat), lng: Number(lng) }
      const m = new window.google.maps.Marker({ position: pos, map: selfMap, title: projectName })
      const c = new window.google.maps.Circle({ center: pos, radius: (radius || 0.5) * 1000, map: selfMap, strokeColor: '#6366f1', strokeOpacity: 0.6, strokeWeight: 1.5, fillColor: '#6366f1', fillOpacity: 0.1 })
      siteMarkers[id] = { marker: m, circle: c }
    } else {
      const icon = L.divIcon({ html: `<div class="site-map-pin">📍</div>`, className: '', iconSize: [30, 30], iconAnchor: [15, 15] })
      const m = L.marker([lat, lng], { icon }).addTo(selfMap).bindPopup(`<b>${projectName}</b><br>Radius: ${radius || 0.5} km`)
      const c = L.circle([lat, lng], { radius: (radius || 0.5) * 1000, color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1, weight: 1.5, dashArray: '6 4' }).addTo(selfMap)
      siteMarkers[id] = { marker: m, circle: c }
    }
  })
}

function updateSelfMarker(lat, lng) {
  if (!selfMap) return
  const initials = getInitials(auth.user?.fullName || auth.user?.username)
  if (selfMapType === 'google') {
    const pos = { lat: Number(lat), lng: Number(lng) }
    if (selfMarker) selfMarker.setPosition(pos)
    else selfMarker = new window.google.maps.Marker({ position: pos, map: selfMap, icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 18, fillColor: '#6366f1', fillOpacity: 1, strokeColor: 'rgba(255,255,255,0.4)', strokeWeight: 2 }, label: { text: initials, color: '#fff', fontWeight: '700', fontSize: '11px' } })
    selfMap.setCenter(pos); selfMap.setZoom(15)
  } else {
    const icon = L.divIcon({ html: `<div class="tech-map-pin" style="background:#6366f1">${initials}</div>`, className: '', iconSize: [36, 36], iconAnchor: [18, 18] })
    if (selfMarker) selfMarker.setLatLng([lat, lng])
    else selfMarker = L.marker([lat, lng], { icon }).addTo(selfMap)
    selfMap.setView([lat, lng], 15)
  }
}

watch(siteProjects, () => { if (selfMap) updateSiteMarkers() })

// ── Battery ───────────────────────────────────────────────────────────────────
async function readBattery() {
  try {
    if ('getBattery' in navigator) {
      const b = await navigator.getBattery()
      batteryLevel.value = Math.round(b.level * 100)
      b.addEventListener('levelchange', () => { batteryLevel.value = Math.round(b.level * 100) })
      return batteryLevel.value
    }
  } catch { /* not supported */ }
  return null
}

// ── Geofence ──────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
function isWithinRadius(project) {
  if (!currentLocation.value || !project.locationLat || !project.locationLng) return false
  return haversineKm(currentLocation.value.lat, currentLocation.value.lng, project.locationLat, project.locationLng) <= (project.locationRadius || 0.5)
}
function openSiteMap(project) {
  window.open(project.locationLink || `https://www.google.com/maps?q=${project.locationLat},${project.locationLng}`, '_blank')
}
function checkGeofencing() {
  if (!isSharing.value || !currentLocation.value) return
  const userId = auth.user?.id || auth.user?.username
  const userName = auth.user?.fullName || auth.user?.username
  siteProjects.value.forEach(project => {
    const wasInside = arrivedProjectIds.value.has(project.id)
    const isInside  = isWithinRadius(project)
    if (isInside && !wasInside) {
      arrivedProjectIds.value = new Set([...arrivedProjectIds.value, project.id])
      arrivalTimes[project.id] = Date.now()
      const timeLabel = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      const docId = `${userId}_${project.id}_arr_${Date.now()}`
      sessionVisits.value = [...sessionVisits.value, { id: docId, userId, userName, projectId: project.id, projectName: project.projectName, event: 'arrived', timeLabel, durationMs: 0 }]
      writeGeofenceEvent(docId, { userId, userName, projectId: project.id, projectName: project.projectName, event: 'arrived', timestamp: serverTimestamp(), durationMs: 0 })
      ui.success(`Reached site: ${project.projectName}`)
    } else if (!isInside && wasInside) {
      const next = new Set(arrivedProjectIds.value); next.delete(project.id); arrivedProjectIds.value = next
      const durationMs = arrivalTimes[project.id] ? Date.now() - arrivalTimes[project.id] : 0
      delete arrivalTimes[project.id]
      const timeLabel = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      const docId = `${userId}_${project.id}_left_${Date.now()}`
      sessionVisits.value = [...sessionVisits.value, { id: docId, userId, userName, projectId: project.id, projectName: project.projectName, event: 'left', timeLabel, durationMs }]
      writeGeofenceEvent(docId, { userId, userName, projectId: project.id, projectName: project.projectName, event: 'left', timestamp: serverTimestamp(), durationMs })
      ui.success(`Left site: ${project.projectName} · ${formatDuration(durationMs)}`)
    }
  })
}

const selfSessionSummary = computed(() => {
  const siteMins = {}; let totalSiteMs = 0
  sessionVisits.value.forEach(e => { if (e.event === 'left' && e.durationMs) { siteMins[e.projectName] = (siteMins[e.projectName] || 0) + Math.round(e.durationMs / 60000); totalSiteMs += e.durationMs } })
  const outsideMins = Math.max(0, Math.round(((sessionStartTime ? Date.now() - sessionStartTime : 0) - totalSiteMs) / 60000))
  const result = {}
  Object.entries(siteMins).forEach(([n, m]) => { result[n] = m })
  result['Outside'] = outsideMins
  return result
})

// ── Shared location update handler (used by both native plugin + web fallback) ─
async function handleLocationUpdate(lat, lng, speed, accuracy) {
  // Accumulate distance — ignore GPS jumps > 500 m between consecutive pings
  if (lastPosition) {
    const d = haversineKm(lastPosition.lat, lastPosition.lng, lat, lng) * 1000
    if (d > 0 && d < 500) distanceTraveled.value = Math.round(distanceTraveled.value + d)
  }
  lastPosition = { lat, lng }
  lastLocationMs = Date.now()
  saveSessionCheckpoint()  // persist to localStorage every GPS point — survives app kills

  currentLocation.value = { lat, lng }
  lastUpdated.value = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  updateSelfMarker(lat, lng)
  checkGeofencing()

  const userId   = auth.user?.id || auth.user?.username
  const docRef   = doc(db, 'technicianLocations', userId)
  const upd = { lat, lng, status: selfStatus.value, timestamp: serverTimestamp(), distanceTraveled: distanceTraveled.value, isActive: true }
  if (batteryLevel.value !== null) upd.battery = batteryLevel.value
  try { await setDoc(docRef, upd, { merge: true }) } catch { /* network down — next update will retry */ }

  // Throttled history write every 1 minute — queued locally if offline
  const now = Date.now()
  if (now - lastHistoryWriteMs >= HISTORY_INTERVAL) {
    lastHistoryWriteMs = now
    const userName = auth.user?.fullName || auth.user?.username
    const histDocId = `${userId}_${now}`
    const histDate  = toDateStr(new Date())
    setDoc(doc(db, 'locationHistory', histDocId), {
      userId, userName, lat, lng,
      speed: speed ?? null, accuracy: accuracy ?? null,
      timestamp: serverTimestamp(), date: histDate,
    }).catch(() => {
      // Network down — save to localStorage for flush on reconnect
      const q = loadOfflineLocationQueue()
      q.push({ docId: histDocId, ts: now, data: { userId, userName, lat, lng, speed: speed ?? null, accuracy: accuracy ?? null, date: histDate } })
      saveOfflineLocationQueue(q)
    })
  }
}

// ── Start / Stop sharing ──────────────────────────────────────────────────────
async function startSharing() {
  starting.value = true; geoError.value = ''
  const battery = await readBattery()

  try {
    if (!firebaseAuth.currentUser) await signInAnonymously(firebaseAuth)

    const userId   = auth.user?.id  || auth.user?.username
    const userName = auth.user?.fullName || auth.user?.username
    const today    = toDateStr(new Date())

    locationDocId = userId
    distanceTraveled.value = 0
    lastPosition = null
    isSharing.value = true
    startHeartbeat()
    startWatchdog()
    requestWakeLock()
    sessionStartTime = Date.now()
    // Listen for network recovery — flush queued geofence events and re-check geofences
    window.addEventListener('online', handleNetworkReconnect)

    // ── Restore interrupted session ───────────────────────────────────────────
    // Priority: localStorage checkpoint (saved every GPS point, survives kills + offline)
    // then Firestore (network-dependent, may be behind if offline before kill)
    const ck = loadSessionCheckpoint()
    if (ck) {
      distanceTraveled.value = ck.distanceTraveled || 0
      sessionStartTime = ck.sessionStartTime || Date.now()
      if (typeof ck.lat === 'number' && typeof ck.lng === 'number') {
        lastPosition = { lat: ck.lat, lng: ck.lng }
      }
    }
    // Also check Firestore — prefer whichever distance value is higher
    try {
      const prevDoc = await getDoc(doc(db, 'technicianLocations', userId))
      if (prevDoc.exists()) {
        const prev = prevDoc.data()
        const prevTs = prev.timestamp?.toDate?.() || (prev.timestamp ? new Date(prev.timestamp) : null)
        if (prevTs && toDateStr(prevTs) === today && (prev.distanceTraveled || 0) > distanceTraveled.value) {
          distanceTraveled.value = prev.distanceTraveled
          if (!lastPosition && typeof prev.lat === 'number' && typeof prev.lng === 'number') {
            lastPosition = { lat: prev.lat, lng: prev.lng }
          }
        }
      }
    } catch {}
    // Flush any GPS points queued offline (won't block UI if network still down)
    flushOfflineLocationQueue()

    const docRef = doc(db, 'technicianLocations', userId)
    // Full overwrite (no merge) so any stale isActive:false from a killed session is cleared
    const initPayload = { userId, userName, role: auth.user?.role || 'technician', status: selfStatus.value, timestamp: serverTimestamp(), distanceTraveled: distanceTraveled.value, isActive: true }
    if (battery !== null) initPayload.battery = battery
    await setDoc(docRef, initPayload)

    setDoc(doc(db, 'trackingSessions', `${userId}_start_${Date.now()}`),
      { userId, userName, event: 'start', timestamp: serverTimestamp(), date: today }).catch(() => {})

    await nextTick(); initSelfMap()

    if (Capacitor.isNativePlatform()) {
      // ── Native: use background-geolocation plugin (survives background) ──
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Avant Elevators is tracking your location for site visits.',
          backgroundTitle: 'Location Sharing Active',
          requestPermissions: true,
          stale: false,
          distanceFilter: 10,  // fire every 10 m moved
        },
        async (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              geoError.value = 'Location permission denied. Go to Settings → Apps → Avant Elevators → Permissions → Location → Allow always.'
              if (window.confirm('Location permission is required. Open device settings?')) {
                BackgroundGeolocation.openSettings?.()
              }
            } else {
              geoError.value = 'Location error: ' + (error.message || error.code)
              // Auto-retry non-permission errors
              if (isSharing.value) setTimeout(() => restartNativeWatcher(), 15000)
            }
            return
          }
          geoError.value = ''
          await handleLocationUpdate(location.latitude, location.longitude, location.speed, location.accuracy)
        }
      )
    } else {
      // ── Web/desktop fallback: navigator.geolocation ────────────────────────
      if (!navigator.geolocation) {
        geoError.value = 'Geolocation not supported in this browser.'
        starting.value = false; isSharing.value = false; return
      }
      watchId = navigator.geolocation.watchPosition(
        async (p) => {
          await handleLocationUpdate(p.coords.latitude, p.coords.longitude, p.coords.speed, p.coords.accuracy)
        },
        (err) => {
          const msgs = { 1: 'Location permission revoked.', 2: 'GPS signal lost. Move to open area.', 3: 'Location timed out.' }
          geoError.value = msgs[err.code] || `Location error: ${err.message}`
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      )
    }

    ui.success('Location sharing started — runs in background')
  } catch (e) {
    isSharing.value = false; sessionStartTime = null
    if (e?.code === 'permission-denied') {
      geoError.value = 'Firestore permission denied. Check Firebase rules.'
    } else {
      geoError.value = 'Failed to start sharing: ' + (e?.message || e?.code || 'unknown error')
    }
  }
  starting.value = false
}

async function stopSharing() {
  stopHeartbeat()
  // Stop native background watcher
  if (watcherId !== null) {
    try { await BackgroundGeolocation.removeWatcher({ id: watcherId }) } catch { /* ignore */ }
    watcherId = null
  }
  // Stop web fallback watcher
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null }

  window.removeEventListener('online', handleNetworkReconnect)
  await flushOfflineQueue()  // best-effort flush before marking stopped

  if (locationDocId) {
    const userId   = auth.user?.id || auth.user?.username
    const userName = auth.user?.fullName || auth.user?.username
    const finalDist = distanceTraveled.value
    // Mark doc as inactive FIRST (preserves distanceTraveled on admin side even if stop event write fails)
    try {
      await setDoc(doc(db, 'technicianLocations', locationDocId),
        { isActive: false, status: 'stopped', stoppedAt: serverTimestamp(), distanceTraveled: finalDist },
        { merge: true })
    } catch { /* ignore */ }
    // Write stop session event (admin uses this for historical distance)
    setDoc(doc(db, 'trackingSessions', `${userId}_stop_${Date.now()}`),
      { userId, userName, event: 'stop', timestamp: serverTimestamp(), date: toDateStr(new Date()),
        totalDistanceM: finalDist }).catch(() => {})
  }
  isSharing.value = false; currentLocation.value = null; selfStatus.value = 'online'
  sessionStartTime = null; sessionVisits.value = []; arrivedProjectIds.value = new Set()
  distanceTraveled.value = 0; lastPosition = null; lastLocationMs = 0
  stoppingConfirm.value = false
  Object.keys(arrivalTimes).forEach(k => delete arrivalTimes[k])
  stopWatchdog()
  releaseWakeLock()
  clearSessionCheckpoint()
  ui.success('Location sharing stopped')
}

function handleVisibilityResume() {
  if (document.visibilityState !== 'visible' || !isSharing.value) return
  requestWakeLock()
  if (lastLocationMs > 0 && Date.now() - lastLocationMs > 5 * 60 * 1000) {
    restartNativeWatcher()
  }
}

function handleStopClick() {
  if (!stoppingConfirm.value) {
    stoppingConfirm.value = true
    stopConfirmTimer = setTimeout(() => { stoppingConfirm.value = false }, 3000)
  } else {
    clearTimeout(stopConfirmTimer)
    stoppingConfirm.value = false
    stopSharing()
  }
}

async function updateSelfStatus(status) {
  selfStatus.value = status
  if (locationDocId) {
    try { await setDoc(doc(db, 'technicianLocations', locationDocId), { status, timestamp: serverTimestamp() }, { merge: true }) } catch { /* ignore */ }
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadMapConfig(), loadTrackingConfig()])
  if (isAdmin.value) {
    let routeBufferSeeded = false
    unsubLocations = subscribe('technicianLocations', docs => {
      // Maintain live route buffer — extend polylines in real-time
      docs.forEach(tech => {
        if (!tech.lat || !tech.lng) return
        const pt = [Number(tech.lat), Number(tech.lng)]
        if (!liveRouteBuffer[tech.userId]) liveRouteBuffer[tech.userId] = []
        const buf = liveRouteBuffer[tech.userId]
        const last = buf[buf.length - 1]
        if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
          buf.push(pt)
          // Extend existing polyline without a full reload
          if (routePolylines[tech.userId]) {
            if (adminMapType === 'leaflet') {
              routePolylines[tech.userId].addLatLng(pt)
            } else if (adminMapType === 'google' && window.google?.maps) {
              routePolylines[tech.userId].getPath().push(new window.google.maps.LatLng(pt[0], pt[1]))
            }
          }
        }
      })
      technicianLocations.value = docs
      nextTick(updateAdminMarkers)
      // On first data arrival, seed route buffers from Firestore history
      if (!routeBufferSeeded && adminMap) {
        routeBufferSeeded = true
        seedLiveRouteBuffers(filterDate.value)
        if (filterTechId.value) loadAndDrawRoute(filterTechId.value, filterDate.value)
      }
    })
    unsubVisits    = subscribe('siteVisitEvents',     docs => { siteVisitEvents.value = docs })
    unsubSessions  = subscribe('trackingSessions',    docs => { trackingSessions.value = docs })
    unsubProjects  = subscribe('projects',            docs => { allProjects.value = docs; if (adminMap) nextTick(updateAdminSiteMarkers) })
    await nextTick()
    await initAdminMap()
    updateAdminSiteMarkers()
  } else {
    unsubProjects = subscribe('projects', docs => { allProjects.value = docs; if (selfMap) nextTick(updateSiteMarkers) })
    // Listen for admin reconnect requests
    const myId = auth.user?.id || auth.user?.username
    if (myId) {
      unsubReconnect = onSnapshot(doc(db, 'technicianLocations', myId), snap => {
        if (!snap.exists()) return
        const reqAt = snap.data()?.reconnectRequest?.at?.toDate?.()?.getTime() || 0
        if (reqAt > reconnectLastHandledMs) {
          reconnectLastHandledMs = reqAt
          if (!isSharing.value) {
            ui.success('Admin requested reconnect — restarting location…')
            nextTick(() => startSharing())
          }
        }
      })
    }
    // Re-acquire wake lock and restart watcher on app foreground
    document.addEventListener('visibilitychange', handleVisibilityResume)
    await nextTick(); initSelfMap()
  }
})

watch(filterDate, newDate => {
  if (!isAdmin.value) return
  clearAllRoutePolylines()
  // If a specific tech is selected, always show their route for the new date
  if (filterTechId.value) loadAndDrawRoute(filterTechId.value, newDate)
  // Reload routes for any already-expanded cards
  expandedCards.value.forEach(techId => loadAndDrawRoute(techId, newDate))
})

watch(filterTechId, newId => {
  if (!isAdmin.value || !adminMap) return
  clearAllRoutePolylines()
  if (newId) loadAndDrawRoute(newId, filterDate.value)
  expandedCards.value.forEach(techId => loadAndDrawRoute(techId, filterDate.value))
})

onUnmounted(() => {
  stopHeartbeat()
  window.removeEventListener('online', handleNetworkReconnect)
  if (unsubLocations) unsubLocations()
  if (unsubVisits)    unsubVisits()
  if (unsubProjects)  unsubProjects()
  if (unsubSessions)  unsubSessions()
  if (unsubReconnect) unsubReconnect()
  stopWatchdog()
  releaseWakeLock()
  document.removeEventListener('visibilitychange', handleVisibilityResume)
  if (watcherId !== null) { BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {}); watcherId = null }
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  clearAllRoutePolylines()
  if (adminMap) { if (adminMapType !== 'google') adminMap.remove(); adminMap = null }
  if (selfMap)  { if (selfMapType  !== 'google') selfMap.remove();  selfMap  = null }
  Object.values(siteMarkers).forEach(({ marker, circle }) => {
    if (selfMapType === 'google') { marker.setMap(null); circle.setMap(null) }
    else { marker.remove(); circle.remove() }
  })
})

// Leaflet glitch fix: invalidate map size whenever the sidebar toggles
// so tiles re-render correctly after the nav overlay appears/disappears
watch(() => ui.sidebarOpen, () => {
  nextTick(() => {
    if (adminMap && adminMapType !== 'google') adminMap.invalidateSize()
    if (selfMap  && selfMapType  !== 'google') selfMap.invalidateSize()
    if (adminMap && adminMapType === 'google') google.maps.event.trigger(adminMap, 'resize')
    if (selfMap  && selfMapType  === 'google') google.maps.event.trigger(selfMap,  'resize')
  })
})
</script>

<style scoped>
.page-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
.page-sub { font-size: 13px; color: var(--ct-muted); margin-top: 4px; }

/* ── Admin map ─────────────────────────────────────────────────────────── */
.map-panel-admin { margin-top: 20px; border-radius: 16px; overflow: hidden; position: relative; }
.map-container-admin { width: 100%; height: 460px; border-radius: 16px; }
.map-live-badge {
  position: absolute; top: 14px; left: 14px;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
  border: 1px solid rgba(16,185,129,0.3);
  color: #10b981; font-size: 12px; font-weight: 600;
  padding: 5px 12px; border-radius: 99px;
  display: flex; align-items: center; gap: 6px;
}

/* ── Filter bar ────────────────────────────────────────────────────────── */
.filter-bar {
  margin-top: 14px; display: flex; align-items: center;
  gap: 12px; padding: 14px 18px; flex-wrap: wrap;
}
.input-sm { height: 32px; font-size: 12px; padding: 0 10px; border-radius: 8px; }

/* ── Overview stats ────────────────────────────────────────────────────── */
.overview-stats-row {
  display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap;
}
.ov-chip {
  flex: 1; min-width: 100px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 14px 16px; text-align: center;
}
.ov-val { font-size: 22px; font-weight: 700; color: var(--ct-primary); }
.ov-lbl { font-size: 10px; color: var(--ct-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }

/* ── Tech cards ────────────────────────────────────────────────────────── */
.tech-cards-list { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }

.tech-analytics-card { border-radius: 16px; overflow: hidden; }

.tac-header {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 20px; cursor: pointer;
  transition: background 0.15s;
}
.tac-header:hover { background: rgba(255,255,255,0.03); }

.tac-avatar {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #fff;
  flex-shrink: 0; position: relative;
}
.tac-avatar-live  { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.tac-avatar-off   { background: #1e293b; color: var(--ct-muted); }
.tac-avatar-stale { background: linear-gradient(135deg, #f59e0b, #d97706); }

.tac-dot {
  position: absolute; bottom: -2px; right: -2px;
  width: 11px; height: 11px; border-radius: 50%; border: 2px solid #0d0d1a;
}

.tac-name-block { min-width: 140px; flex-shrink: 0; }
.tac-name { font-size: 14px; font-weight: 600; color: var(--ct-primary); }

.tac-chips-row { display: flex; gap: 8px; flex: 1; flex-wrap: wrap; }
.tac-chip {
  display: flex; flex-direction: column; align-items: center;
  padding: 8px 14px; border-radius: 10px; min-width: 72px; flex: 1; max-width: 110px;
  border: 1px solid transparent;
}
.tac-chip-val { font-size: 15px; font-weight: 700; }
.tac-chip-lbl { font-size: 10px; color: var(--ct-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

.chip-site    { background: rgba(99,102,241,0.1);  border-color: rgba(99,102,241,0.2);  }
.chip-site    .tac-chip-val { color: var(--ct-accent); }
.chip-transit { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.2);  }
.chip-transit .tac-chip-val { color: #fbbf24; }
.chip-visits  { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.2);  }
.chip-visits  .tac-chip-val { color: #10b981; }
.chip-distance { background: rgba(6,182,212,0.08);  border-color: rgba(6,182,212,0.2);  }
.chip-distance .tac-chip-val { color: #22d3ee; }
.chip-session { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
.chip-session .tac-chip-val { color: var(--ct-primary); }

.tac-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.btn-xs {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 10px; font-size: 11px; border-radius: 8px; font-weight: 500;
}
.tac-chevron { color: var(--ct-muted); transition: transform 0.2s; flex-shrink: 0; }
.tac-chevron-open { transform: rotate(180deg); }

/* ── Card body ─────────────────────────────────────────────────────────── */
.tac-body { border-top: 1px solid rgba(255,255,255,0.06); padding: 16px 20px; }

.tac-tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0; }
.tac-tab {
  padding: 8px 14px; font-size: 12px; font-weight: 500; border: none;
  border-bottom: 2px solid transparent; background: transparent; color: var(--ct-muted);
  cursor: pointer; border-radius: 6px 6px 0 0; transition: all 0.15s;
}
.tac-tab:hover { color: var(--ct-sub); }
.tac-tab.active { color: var(--ct-accent); border-bottom-color: #6366f1; background: rgba(99,102,241,0.06); }

.tab-content { padding-top: 4px; }
.tac-empty { color: var(--ct-muted); font-size: 13px; padding: 24px; text-align: center; }

/* ── Day summary chips ─────────────────────────────────────────────────── */
.day-summary-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.ds-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 10px; font-size: 12px; border: 1px solid transparent;
}
.ds-site    { background: rgba(99,102,241,0.1);  border-color: rgba(99,102,241,0.2);  color: var(--ct-accent); }
.ds-transit { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.2);  color: #fbbf24; }
.ds-dist    { background: rgba(6,182,212,0.08);  border-color: rgba(6,182,212,0.2);   color: #22d3ee; }
.ds-session { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: var(--ct-sub); }
.ds-best    { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.2);  color: #10b981; }

/* ── Per-site breakdown table ─────────────────────────────────────────── */
.per-site-table { margin-bottom: 16px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07); }
.pst-header, .pst-row { display: grid; grid-template-columns: 1fr 80px 80px 100px; padding: 8px 14px; font-size: 12px; }
.pst-header { background: rgba(255,255,255,0.05); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ct-muted); }
.pst-row { border-top: 1px solid rgba(255,255,255,0.04); }
.pst-name { font-weight: 500; color: var(--ct-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dur-green { color: #10b981; font-weight: 600; }
.dur-muted { color: var(--ct-muted); font-style: italic; }

/* ── Timeline ──────────────────────────────────────────────────────────── */
.timeline-label { font-size: 11px; font-weight: 600; color: var(--ct-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
.event-timeline { display: flex; flex-direction: column; }
.te-row { display: flex; gap: 12px; }
.te-line-wrap { display: flex; flex-direction: column; align-items: center; width: 16px; flex-shrink: 0; }
.te-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; border: 2px solid; }
.te-dot-green { background: rgba(16,185,129,0.2); border-color: #10b981; }
.te-dot-red   { background: rgba(239,68,68,0.2);  border-color: #f87171; }
.te-line { flex: 1; width: 2px; background: rgba(255,255,255,0.06); margin: 4px 0; min-height: 24px; }
.te-content { flex: 1; padding-bottom: 14px; }
.te-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.te-event-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
.teb-arrived { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
.teb-left    { background: rgba(239,68,68,0.1);  color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
.te-project { font-size: 13px; font-weight: 500; color: var(--ct-primary); }
.te-time    { font-size: 11px; color: var(--ct-muted); margin-left: auto; }
.te-sub     { font-size: 11px; color: var(--ct-muted); margin-top: 4px; }
.te-gap-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.te-gap-text { font-size: 11px; color: #f59e0b; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); padding: 3px 10px; border-radius: 99px; }

/* ── Monthly ───────────────────────────────────────────────────────────── */
.month-nav { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.month-label { font-size: 13px; font-weight: 600; color: var(--ct-primary); min-width: 140px; text-align: center; }

.mini-chart-wrap { display: flex; gap: 4px; align-items: flex-end; height: 72px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; }
.mini-bar-col { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 20px; height: 100%; cursor: default; }
.mini-bar-inner { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.mini-bar-fill { width: 100%; border-radius: 3px 3px 0 0; background: #6366f1; min-height: 2px; transition: height 0.3s; }
.mini-bar-lbl { font-size: 9px; color: var(--ct-muted); margin-top: 2px; }

.monthly-table-wrap { overflow-x: auto; }
.monthly-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.monthly-table thead tr { background: rgba(255,255,255,0.05); }
.monthly-table th { padding: 9px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ct-muted); }
.monthly-table td { padding: 8px 12px; border-top: 1px solid rgba(255,255,255,0.04); color: var(--ct-sub); }
.monthly-table tfoot tr { background: rgba(99,102,241,0.08); }
.monthly-table tfoot td { border-top: 1px solid rgba(99,102,241,0.2); color: var(--ct-primary); }
.row-today td { background: rgba(99,102,241,0.06); }
.row-empty td { color: #334155; }
.td-site    { color: var(--ct-accent) !important; font-weight: 600; }
.td-transit { color: #fbbf24 !important; }
.td-dist    { color: #22d3ee !important; }
.td-session { color: var(--ct-primary) !important; }

/* ── Overview distance chip ──────────────────────────────────────────────── */
.ov-chip-dist { border-color: rgba(6,182,212,0.2) !important; background: rgba(6,182,212,0.06) !important; }
.ov-val-dist  { color: #22d3ee !important; }

/* ── Self view ─────────────────────────────────────────────────────────── */
.tech-self-layout { display: flex; flex-direction: column; gap: 20px; margin-top: 20px; }
.map-panel-self { position: relative; overflow: hidden; border-radius: 16px; }
.map-container { width: 100%; height: 380px; border-radius: 16px; }

.location-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.location-stat { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 12px; }
.stat-label { font-size: 11px; color: var(--ct-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 13px; font-weight: 600; color: var(--ct-primary); margin-top: 2px; }

.status-btn-group { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.status-opt-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 10px; font-size: 12px; font-weight: 500; color: var(--ct-muted); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.15s; }
.status-opt-active { background: rgba(99,102,241,0.15); color: var(--ct-accent); border-color: rgba(99,102,241,0.35); }

.geo-error { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; padding: 10px 14px; border-radius: 10px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; font-size: 12px; }

/* ── Shared badges / utilities ─────────────────────────────────────────── */
.badge { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.badge-live    { background: rgba(16,185,129,0.12); color: var(--ct-green); border: 1px solid rgba(16,185,129,0.25); }
.badge-offline { background: rgba(100,116,139,0.12); color: var(--ct-sub); border: 1px solid rgba(100,116,139,0.2); }
.badge-green   { background: rgba(16,185,129,0.12); color: var(--ct-green); border: 1px solid rgba(16,185,129,0.2); }
.badge-amber   { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
.badge-slate   { background: rgba(100,116,139,0.12); color: var(--ct-sub); border: 1px solid rgba(100,116,139,0.2); }

.live-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; animation: pulse 1.5s infinite; display: inline-block; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

.dot-online  { background: #10b981; }
.dot-job     { background: #f59e0b; }
.dot-offline { background: #64748b; }

.map-empty-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: var(--ct-muted); text-align: center; }
.empty-state p    { font-size: 14px; color: var(--ct-muted); margin: 10px 0 4px; }
.empty-state span { font-size: 12px; color: var(--ct-muted); }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }

/* Session / visit log (tech self-view) */
.visit-summary-chip { display: flex; flex-direction: column; align-items: center; padding: 8px 16px; border-radius: 12px; min-width: 80px; }
.chip-site    { background: rgba(99,102,241,0.1);  border: 1px solid rgba(99,102,241,0.2); }
.chip-outside { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); }
.chip-label { font-size: 10px; color: var(--ct-muted); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
.chip-site .chip-mins    { font-size: 16px; font-weight: 700; color: var(--ct-accent); }
.chip-outside .chip-mins { font-size: 16px; font-weight: 700; color: #fbbf24; }

.visit-feed { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.visit-event { display: flex; align-items: flex-start; gap: 10px; padding: 9px 12px; border-radius: 10px; border: 1px solid transparent; }
.evt-arrived { background: rgba(16,185,129,0.05); border-color: rgba(16,185,129,0.15); }
.evt-left    { background: rgba(239,68,68,0.05);  border-color: rgba(239,68,68,0.12); }
.evt-icon { margin-top: 1px; flex-shrink: 0; }
.evt-arrived .evt-icon { color: var(--ct-green); }
.evt-left    .evt-icon { color: #f87171; }
.evt-body { flex: 1; min-width: 0; }
.evt-title { font-size: 12px; color: var(--ct-secondary); }
.evt-title strong { color: var(--ct-primary); }
.evt-meta  { font-size: 11px; color: var(--ct-muted); margin-top: 2px; }

.site-location-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); transition: border-color 0.2s; }
.site-arrived { background: rgba(16,185,129,0.06); border-color: rgba(16,185,129,0.25); }
.badge-arrived { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; background: rgba(16,185,129,0.15); color: var(--ct-green); border: 1px solid rgba(16,185,129,0.3); padding: 3px 9px; border-radius: 99px; }
.btn-danger-confirm { background: rgba(239,68,68,0.25) !important; border-color: rgba(239,68,68,0.5) !important; animation: pulse-danger 0.6s ease infinite alternate; }
@keyframes pulse-danger { from { opacity: 0.8; } to { opacity: 1; } }
.btn-reconnect { color: #818cf8 !important; }
.btn-reconnect:hover { background: rgba(99,102,241,0.15) !important; }
.btn-go-to-site { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 10px; font-size: 12px; font-weight: 600; color: var(--ct-accent); background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25); cursor: pointer; transition: all 0.15s; }

:global(.tech-map-pin) { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 2px solid rgba(255,255,255,0.3); }
:global(.site-map-pin) { font-size: 22px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
</style>
