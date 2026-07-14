<template>
  <div class="att-view">

    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <UserCheck :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Attendance
        </h1>
        <p class="page-sub">Punctuality made transparent, effortlessly.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button v-if="isAdmin" class="btn-secondary btn-sm" @click="triggerExport('excel')">
          <FileText :size="14" /> Excel
        </button>
        <button v-if="isAdmin" class="btn-secondary btn-sm" @click="triggerExport('pdf')">
          <FileDown :size="14" /> PDF
        </button>
      </div>
    </div>

    <!-- Tab switcher (admin only) -->
    <div v-if="isAdmin" class="tabs-nav" style="margin-bottom:20px;">
      <button :class="['tab-btn', activeTab==='mine' && 'active']" @click="activeTab='mine'">
        <User :size="13" /> My Attendance
      </button>
      <button :class="['tab-btn', activeTab==='team' && 'active']" @click="activeTab='team'; loadTeam()">
        <Users :size="13" /> Team Overview
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════
         MY ATTENDANCE TAB  — completely redesigned
    ═══════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'mine'">

      <!-- ── PUNCH SECTION ─────────────────────────────────────────────── -->
      <div class="punch-hero" :class="heroClass">
        <!-- Header row -->
        <div class="ph-top">
          <div>
            <div class="ph-greeting">{{ punchGreeting }}</div>
            <div class="ph-date">{{ todayLabel }}</div>
          </div>
          <button class="ph-refresh" @click="loadMyAttendance" :disabled="myLoading" title="Refresh">
            <RefreshCw :size="15" :class="{ spin: myLoading }" />
          </button>
        </div>

        <!-- Times row (shown once checked in) -->
        <div v-if="todayRecord" class="ph-times-row">
          <div class="ph-time-block">
            <div class="ph-time-label">
              <LogIn :size="12" /> Check In
            </div>
            <div class="ph-time-val">{{ formatTime(todayRecord.checkInTime) }}</div>
            <div v-if="todayRecord.checkInLocation" class="ph-loc">
              <MapPin :size="9" /> {{ todayRecord.checkInLocation }}
            </div>
          </div>
          <div class="ph-time-sep">
            <div class="ph-sep-line" />
            <span v-if="todayRecord.checkOutTime" class="ph-sep-hrs">
              {{ calcHours(todayRecord.checkInTime, todayRecord.checkOutTime) }}h
            </span>
          </div>
          <div class="ph-time-block">
            <div class="ph-time-label">
              <LogOut :size="12" /> Check Out
            </div>
            <div class="ph-time-val" :style="{ opacity: todayRecord.checkOutTime ? 1 : 0.35 }">
              {{ todayRecord.checkOutTime ? formatTime(todayRecord.checkOutTime) : '—' }}
            </div>
            <div v-if="todayRecord.checkOutLocation" class="ph-loc">
              <MapPin :size="9" /> {{ todayRecord.checkOutLocation }}
            </div>
          </div>
        </div>

        <!-- Selfie row -->
        <div v-if="todayRecord && (todayRecord.checkInSelfie || todayRecord.checkOutSelfie)" class="ph-selfies">
          <div v-if="todayRecord.checkInSelfie" class="ph-selfie-wrap" @click="viewSelfie(todayRecord.checkInSelfie)">
            <img :src="todayRecord.checkInSelfie" class="ph-selfie" />
            <span>In</span>
          </div>
          <div v-if="todayRecord.checkOutSelfie" class="ph-selfie-wrap" @click="viewSelfie(todayRecord.checkOutSelfie)">
            <img :src="todayRecord.checkOutSelfie" class="ph-selfie" />
            <span>Out</span>
          </div>
        </div>

        <!-- Action button -->
        <div class="ph-action">
          <button v-if="!todayRecord" class="ph-btn ph-btn-in" :disabled="punching" @click="startPunch('checkin')">
            <Fingerprint :size="20" />
            {{ punching ? 'Processing…' : 'Check In' }}
          </button>
          <button v-else-if="!todayRecord.checkOutTime" class="ph-btn ph-btn-out" :disabled="punching" @click="startPunch('checkout')">
            <LogOut :size="20" />
            {{ punching ? 'Processing…' : 'Check Out' }}
          </button>
          <div v-else style="display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;">
            <div class="ph-done">
              <CheckCircle :size="18" /> Attendance complete for today
            </div>
            <!-- Overtime re-punch -->
            <template v-if="!todayRecord.otPunchIn">
              <button class="ph-btn" style="background:rgba(251,191,36,0.18);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);"
                :disabled="punching" @click="startPunch('ot-in')">
                <Zap :size="18" /> {{ punching ? 'Processing…' : 'Start Overtime' }}
              </button>
            </template>
            <template v-else-if="!todayRecord.otPunchOut">
              <div style="font-size:12px;color:#fbbf24;">OT started: {{ formatTime(todayRecord.otPunchIn) }}</div>
              <button class="ph-btn" style="background:rgba(251,191,36,0.18);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);"
                :disabled="punching" @click="startPunch('ot-out')">
                <ZapOff :size="18" /> {{ punching ? 'Processing…' : 'End Overtime' }}
              </button>
            </template>
            <template v-else>
              <div style="font-size:12px;color:#fbbf24;text-align:center;">
                OT: {{ formatTime(todayRecord.otPunchIn) }} → {{ formatTime(todayRecord.otPunchOut) }}
                ({{ todayRecord.otHours }}h)
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- ── MONTHLY ATTENDANCE LOG (admin only) ───────────────────────────── -->
      <div v-if="isAdmin" class="monthly-log-wrap">
        <div class="monthly-log-bar">
          <span class="section-title" style="margin:0;flex:1;">Monthly Attendance Log</span>
          <input v-model="logMonth" type="month" class="input" style="width:155px;" />
          <button class="btn-secondary btn-sm" @click="downloadMonthlyExcel(null)">
            <FileText :size="13" /> All Excel
          </button>
          <button class="btn-secondary btn-sm" @click="downloadMonthlyPDF(null)">
            <FileDown :size="13" /> All PDF
          </button>
        </div>

        <input v-model="monthLogSearch" class="input" placeholder="Search employee…" style="width:100%;margin-bottom:12px;" />

        <div v-if="monthLogLoading" class="empty-state" style="padding:32px 0;">
          <Loader2 :size="24" class="spin" />
          <p style="margin-top:10px;color:var(--ct-muted);font-size:13px;">Loading monthly log…</p>
        </div>
        <div v-else class="table-container" style="margin-bottom:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th style="text-align:center;">Working Days</th>
                <th style="text-align:center;">Present</th>
                <th style="text-align:center;">Late</th>
                <th style="text-align:center;">Absent</th>
                <th style="text-align:center;">Total Hours</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="emp in monthLogEmployees" :key="emp.id">
                <tr @click="emp._logOpen = !emp._logOpen" style="cursor:pointer;">
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <ChevronDown :size="13" style="color:var(--ct-muted);transition:transform 0.2s;flex-shrink:0;"
                        :style="{ transform: emp._logOpen ? 'rotate(180deg)' : '' }" />
                      <div>
                        <div style="font-weight:500;color:var(--ct-primary);">{{ emp.name }}</div>
                        <div style="font-size:11px;color:var(--ct-muted);">{{ emp.role }}</div>
                      </div>
                    </div>
                  </td>
                  <td style="text-align:center;">{{ emp.totalWorkingDays }}</td>
                  <td style="text-align:center;color:#4ade80;font-weight:600;">{{ emp.present }}</td>
                  <td style="text-align:center;color:#fbbf24;font-weight:600;">{{ emp.late }}</td>
                  <td style="text-align:center;color:#f87171;font-weight:600;">{{ emp.absent }}</td>
                  <td style="text-align:center;color:var(--ct-accent);">{{ emp.totalHours }} h</td>
                  <td>
                    <div style="display:flex;gap:6px;" @click.stop>
                      <button class="btn-secondary btn-sm" @click="downloadMonthlyExcel(emp)" title="Excel">
                        <FileText :size="11" />
                      </button>
                      <button class="btn-secondary btn-sm" @click="downloadMonthlyPDF(emp)" title="PDF">
                        <FileDown :size="11" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="emp._logOpen">
                  <td colspan="7" style="padding:0;background:rgba(255,255,255,0.015);">
                    <div class="log-detail-inner">
                      <table class="data-table" style="margin:0;">
                        <thead>
                          <tr>
                            <th>Date</th><th>Day</th><th>Check In</th><th>Check Out</th>
                            <th>Hours</th><th>OT</th><th>Status</th><th>Location</th><th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="rec in emp.empRecs" :key="rec.id">
                            <td style="font-size:12px;">{{ rec.date }}</td>
                            <td style="font-size:12px;color:var(--ct-muted);">{{ getDayName(rec.date) }}</td>
                            <td style="color:#4ade80;font-size:12px;">{{ formatTime(rec.checkInTime) }}</td>
                            <td style="font-size:12px;" :style="{ color: rec.checkOutTime ? '#f87171' : 'var(--ct-muted)' }">
                              {{ rec.checkOutTime ? formatTime(rec.checkOutTime) : '—' }}
                            </td>
                            <td style="color:var(--ct-accent);font-size:12px;">
                              {{ rec.checkInTime && rec.checkOutTime ? calcHours(rec.checkInTime, rec.checkOutTime) + 'h' : '—' }}
                            </td>
                            <td style="color:#fbbf24;font-size:12px;">
                              {{ rec.otHours ? rec.otHours + 'h' : '—' }}
                            </td>
                            <td><span :class="['status-pill', statusPill(rec.status)]" style="font-size:10px;">{{ rec.status || 'present' }}</span></td>
                            <td style="font-size:11px;color:var(--ct-muted);">{{ rec.checkInLocation || '—' }}</td>
                            <td v-if="isAdmin">
                              <div style="display:flex;gap:4px;">
                                <button class="btn-secondary btn-sm" style="padding:3px 7px;" @click.stop="openEditRecord(rec, emp)" title="Edit times">
                                  <Pencil :size="10" />
                                </button>
                                <button v-if="rec.status !== 'absent'" class="btn-danger btn-sm" style="padding:3px 7px;" @click.stop="markAbsent(rec)" title="Mark absent">
                                  <UserX :size="10" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr v-if="!emp.empRecs.length">
                            <td colspan="9" style="text-align:center;color:var(--ct-muted);padding:14px 0;font-size:12px;">
                              No records for this month.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="!monthLogEmployees.length">
                <td colspan="7" style="text-align:center;color:var(--ct-muted);padding:24px 0;">No employees found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════
         TEAM OVERVIEW TAB (admin only)
    ═══════════════════════════════════════════════════════════════════════ -->
    <div v-if="isAdmin && activeTab === 'team'">

      <!-- Filters row -->
      <div class="filters-row">
        <input v-model="teamSearch" class="input" style="flex:1;min-width:160px;" placeholder="Search employee…" />
        <input v-model="filterDate" type="date" class="input" style="width:160px;" />
        <select v-model="filterStatus" class="input" style="width:140px;">
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="absent">Absent</option>
        </select>
        <button class="btn-secondary btn-sm" @click="loadTeam">
          <RefreshCw :size="13" :class="{ spin: teamLoading }" /> Refresh
        </button>
      </div>

      <!-- Stats row -->
      <div class="team-stats-grid">
        <div class="team-stat glass">
          <div class="ts-icon" style="background:rgba(74,222,128,0.12);border-color:rgba(74,222,128,0.25);">
            <UserCheck :size="18" style="color:#4ade80;" />
          </div>
          <div>
            <div class="ts-val">{{ teamStats.present }}</div>
            <div class="ts-lbl">Present Today</div>
          </div>
        </div>
        <div class="team-stat glass">
          <div class="ts-icon" style="background:rgba(248,113,113,0.12);border-color:rgba(248,113,113,0.25);">
            <UserX :size="18" style="color:#f87171;" />
          </div>
          <div>
            <div class="ts-val">{{ teamStats.absent }}</div>
            <div class="ts-lbl">Absent</div>
          </div>
        </div>
        <div class="team-stat glass">
          <div class="ts-icon" style="background:rgba(251,191,36,0.12);border-color:rgba(251,191,36,0.25);">
            <Clock :size="18" style="color:#fbbf24;" />
          </div>
          <div>
            <div class="ts-val">{{ teamStats.late }}</div>
            <div class="ts-lbl">Late</div>
          </div>
        </div>
        <div class="team-stat glass">
          <div class="ts-icon" style="background:rgba(129,140,248,0.12);border-color:rgba(129,140,248,0.25);">
            <Users :size="18" style="color:#818cf8;" />
          </div>
          <div>
            <div class="ts-val">{{ teamStats.total }}</div>
            <div class="ts-lbl">Total Staff</div>
          </div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="charts-row">
        <div class="chart-card glass">
          <div class="chart-card-title">Today's Breakdown</div>
          <div style="height:180px;">
            <Doughnut v-if="todayChartData" :data="todayChartData" :options="doughnutOpts" />
            <div v-else class="empty-state" style="height:100%;font-size:12px;">No data</div>
          </div>
        </div>
        <div class="chart-card glass">
          <div class="chart-card-title">Last 7 Days Attendance</div>
          <div style="height:180px;">
            <Bar v-if="weekChartData" :data="weekChartData" :options="barOpts" />
            <div v-else class="empty-state" style="height:100%;font-size:12px;">No data</div>
          </div>
        </div>
      </div>

      <!-- View toggle -->
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
        <div class="section-title" style="margin:0;flex:1;">
          {{ filterDate ? `Attendance — ${filterDate}` : "Today's Attendance" }}
        </div>
        <button :class="['btn-secondary btn-sm', teamView==='cards' && 'active-view']" @click="teamView='cards'">
          <LayoutGrid :size="13" /> Cards
        </button>
        <button :class="['btn-secondary btn-sm', teamView==='table' && 'active-view']" @click="teamView='table'">
          <TableIcon :size="13" /> Table
        </button>
      </div>

      <div v-if="teamLoading" class="empty-state"><Loader2 :size="28" class="spin" /></div>

      <!-- ── CARDS VIEW ── -->
      <div v-else-if="teamView === 'cards'" class="emp-cards-grid">
        <div v-for="emp in filteredEmployeeCards" :key="emp.id" class="emp-card glass">
          <div class="emp-card-header" @click="emp._open = !emp._open">
            <div class="emp-avatar" :style="avatarStyle(emp.name)">{{ initials(emp.name) }}</div>
            <div class="emp-info">
              <div class="emp-name">{{ emp.name }}</div>
              <div class="emp-role">{{ emp.role }}</div>
            </div>
            <div class="emp-today-status">
              <span :class="['status-pill', statusPill(emp.todayStatus)]">
                {{ emp.todayStatus || 'absent' }}
              </span>
              <div v-if="emp.todayRecord" class="emp-today-time">
                {{ formatTime(emp.todayRecord.checkInTime) }}
                <span v-if="emp.todayRecord.checkOutTime"> → {{ formatTime(emp.todayRecord.checkOutTime) }}</span>
              </div>
              <div v-if="emp.todayRecord?.checkInLocation" class="emp-today-loc">
                <MapPin :size="10" style="display:inline;vertical-align:-1px;" /> {{ emp.todayRecord.checkInLocation }}
              </div>
            </div>
            <ChevronDown :size="16" style="color:var(--ct-muted);transition:transform 0.2s;"
              :style="{ transform: emp._open ? 'rotate(180deg)' : '' }" />
          </div>

          <div v-if="emp._open" class="emp-card-body">
            <div v-if="emp.todayRecord?.checkInLat || emp.todayRecord?.checkInLocation" class="emp-loc-row">
              <MapPin :size="13" style="color:#818cf8;flex-shrink:0;" />
              <div style="flex:1;min-width:0;">
                <div class="emp-loc-label">Check In</div>
                <div class="emp-loc-name">{{ emp.todayRecord.checkInLocation || `${emp.todayRecord.checkInLat?.toFixed(5)}, ${emp.todayRecord.checkInLng?.toFixed(5)}` }}</div>
              </div>
              <button class="btn-secondary btn-sm" style="padding:3px 8px;font-size:11px;flex-shrink:0;"
                @click.stop="openMap(emp.todayRecord.checkInLat, emp.todayRecord.checkInLng)">
                <MapIcon :size="11" /> Map
              </button>
            </div>
            <div v-if="emp.todayRecord?.checkOutLat || emp.todayRecord?.checkOutLocation" class="emp-loc-row">
              <MapPin :size="13" style="color:#f87171;flex-shrink:0;" />
              <div style="flex:1;min-width:0;">
                <div class="emp-loc-label">Check Out</div>
                <div class="emp-loc-name">{{ emp.todayRecord.checkOutLocation || `${emp.todayRecord.checkOutLat?.toFixed(5)}, ${emp.todayRecord.checkOutLng?.toFixed(5)}` }}</div>
              </div>
              <button class="btn-secondary btn-sm" style="padding:3px 8px;font-size:11px;flex-shrink:0;"
                @click.stop="openMap(emp.todayRecord.checkOutLat, emp.todayRecord.checkOutLng)">
                <MapIcon :size="11" /> Map
              </button>
            </div>

            <div v-if="emp.todayRecord && (emp.todayRecord.checkInSelfie || emp.todayRecord.checkOutSelfie)" class="emp-selfie-row">
              <div v-if="emp.todayRecord.checkInSelfie" class="emp-selfie-wrap">
                <img :src="emp.todayRecord.checkInSelfie" class="emp-selfie" @click="viewSelfie(emp.todayRecord.checkInSelfie)" />
                <span class="emp-selfie-lbl">Check In</span>
              </div>
              <div v-if="emp.todayRecord.checkOutSelfie" class="emp-selfie-wrap">
                <img :src="emp.todayRecord.checkOutSelfie" class="emp-selfie" @click="viewSelfie(emp.todayRecord.checkOutSelfie)" />
                <span class="emp-selfie-lbl">Check Out</span>
              </div>
            </div>

            <div class="month-label">{{ currentMonthLabel }} Attendance</div>
            <div class="att-calendar">
              <div
                v-for="day in emp.monthCalendar"
                :key="day.date"
                :class="['cal-day', day.status]"
                :title="day.date + ' — ' + (day.status || 'absent')"
              >{{ day.d }}</div>
            </div>
            <div class="att-month-stats">
              <span style="color:#4ade80;">✓ {{ emp.monthStats.present }} present</span>
              <span style="color:#fbbf24;">⏱ {{ emp.monthStats.late }} late</span>
              <span style="color:#f87171;">✗ {{ emp.monthStats.absent }} absent</span>
            </div>
            <div v-if="isAdmin && emp.todayRecord" style="display:flex;gap:6px;margin-top:10px;">
              <button class="btn-secondary btn-sm" style="flex:1;justify-content:center;" @click.stop="openEditRecord(emp.todayRecord, emp)">
                <Pencil :size="11" /> Edit Today's Record
              </button>
              <button v-if="emp.todayStatus !== 'absent'" class="btn-danger btn-sm" style="padding:4px 10px;" @click.stop="markAbsent(emp.todayRecord)" title="Mark absent">
                <UserX :size="11" />
              </button>
            </div>
          </div>
        </div>
        <div v-if="!filteredEmployeeCards.length" class="empty-state" style="grid-column:1/-1;">
          <Users :size="36" style="opacity:.3;margin-bottom:10px;" />
          <p>No employees found.</p>
        </div>
      </div>

      <!-- ── TABLE VIEW ── -->
      <div v-else class="table-container">
        <table v-if="filteredTeamRecords.length" class="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Hours</th>
              <th>Status</th>
              <th>Location</th>
              <th>Selfies</th>
              <th v-if="isAdmin">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rec in filteredTeamRecords" :key="rec.id">
              <td>
                <div style="font-weight:500;color:var(--ct-primary);">{{ rec.employeeName }}</div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                  <span style="font-size:11px;color:var(--ct-muted);">{{ rec.employeeRole }}</span>
                  <span v-if="rec._isDuplicate" style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 6px;border-radius:99px;background:rgba(251,191,36,0.12);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);">Duplicate</span>
                </div>
              </td>
              <td style="font-size:12px;color:var(--ct-muted);">{{ rec.date }}</td>
              <td style="color:#4ade80;font-weight:500;">{{ formatTime(rec.checkInTime) }}</td>
              <td :style="{ color: rec.checkOutTime ? '#f87171' : 'var(--ct-muted)' }">
                {{ rec.checkOutTime ? formatTime(rec.checkOutTime) : '—' }}
              </td>
              <td style="color:var(--ct-accent);">
                {{ rec.checkInTime && rec.checkOutTime ? calcHours(rec.checkInTime, rec.checkOutTime) + ' h' : '—' }}
              </td>
              <td><span :class="['status-pill', statusPill(rec.status)]">{{ rec.status || 'present' }}</span></td>
              <td>
                <div style="display:flex;flex-direction:column;gap:4px;min-width:120px;">
                  <div v-if="rec.checkInLat || rec.checkInLocation" style="display:flex;align-items:center;gap:4px;">
                    <MapPin :size="10" style="color:#4ade80;flex-shrink:0;" />
                    <span style="font-size:10px;color:var(--ct-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      {{ rec.checkInLocation || `${rec.checkInLat?.toFixed(4)},${rec.checkInLng?.toFixed(4)}` }}
                    </span>
                    <button v-if="rec.checkInLat" class="btn-secondary btn-sm" style="padding:2px 5px;font-size:10px;" @click="openMap(rec.checkInLat, rec.checkInLng)">
                      <MapIcon :size="10" />
                    </button>
                  </div>
                  <div v-if="rec.checkOutLat || rec.checkOutLocation" style="display:flex;align-items:center;gap:4px;">
                    <MapPin :size="10" style="color:#f87171;flex-shrink:0;" />
                    <span style="font-size:10px;color:var(--ct-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      {{ rec.checkOutLocation || `${rec.checkOutLat?.toFixed(4)},${rec.checkOutLng?.toFixed(4)}` }}
                    </span>
                    <button v-if="rec.checkOutLat" class="btn-secondary btn-sm" style="padding:2px 5px;font-size:10px;" @click="openMap(rec.checkOutLat, rec.checkOutLng)">
                      <MapIcon :size="10" />
                    </button>
                  </div>
                  <span v-if="!rec.checkInLat && !rec.checkInLocation && !rec.checkOutLat" style="font-size:10px;color:var(--ct-muted);">—</span>
                </div>
              </td>
              <td>
                <div style="display:flex;gap:6px;">
                  <img v-if="rec.checkInSelfie"  :src="rec.checkInSelfie"  class="selfie-mini" @click="viewSelfie(rec.checkInSelfie)" />
                  <img v-if="rec.checkOutSelfie" :src="rec.checkOutSelfie" class="selfie-mini" @click="viewSelfie(rec.checkOutSelfie)" />
                </div>
              </td>
              <td v-if="isAdmin">
                <div style="display:flex;gap:4px;">
                  <button class="btn-secondary btn-sm" style="padding:3px 7px;" @click.stop="openEditRecord(rec, null)" title="Edit times">
                    <Pencil :size="10" />
                  </button>
                  <button v-if="rec.status !== 'absent'" class="btn-danger btn-sm" style="padding:3px 7px;" @click.stop="markAbsent(rec)" title="Mark absent">
                    <UserX :size="10" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <ClipboardList :size="36" style="opacity:.3;margin-bottom:10px;" />
          <p>No attendance records for this date.</p>
        </div>
      </div>
    </div>

    <!-- ═══════ SELFIE CAPTURE MODAL ═══════ -->
    <SelfieCapture
      v-if="showSelfie"
      :title="selfieMode === 'checkin' ? 'Check In Selfie' : 'Check Out Selfie'"
      :instruction="selfieMode === 'checkin' ? 'Take a live selfie to mark your attendance' : 'Take a selfie to log your check-out'"
      @captured="onSelfieCapture"
      @cancel="showSelfie = false"
    />

    <!-- ═══════ SELFIE LIGHTBOX ═══════ -->
    <div v-if="lightboxUrl" class="lightbox" @click="lightboxUrl = ''">
      <img :src="lightboxUrl" class="lightbox-img" />
      <button class="lightbox-close" @click.stop="lightboxUrl = ''"><X :size="20" /></button>
    </div>

    <!-- ═══════ EDIT ATTENDANCE MODAL (admin) ═══════ -->
    <AppModal v-if="isAdmin" v-model="showEditModal" title="Edit Attendance Record" width="480px">
      <div v-if="editRec" class="form-grid">
        <div class="form-group form-full">
          <label class="label">Employee</label>
          <input :value="editRec.employeeName" class="input" readonly style="opacity:.7;" />
        </div>
        <div class="form-group form-full">
          <label class="label">Date</label>
          <input :value="editRec.date" class="input" readonly style="opacity:.7;" />
        </div>
        <div class="form-group">
          <label class="label">Check In Time</label>
          <input v-model="editForm.checkInTime" class="input" type="time" />
        </div>
        <div class="form-group">
          <label class="label">Check Out Time</label>
          <input v-model="editForm.checkOutTime" class="input" type="time" />
        </div>
        <div class="form-group form-full">
          <label class="label">Status</label>
          <select v-model="editForm.status" class="input">
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
          </select>
        </div>
        <div class="form-group" style="border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;grid-column:1/-1;">
          <div style="font-size:11px;font-weight:600;color:#fbbf24;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Overtime (optional)</div>
        </div>
        <div class="form-group">
          <label class="label">OT Punch In</label>
          <input v-model="editForm.otPunchIn" class="input" type="time" />
        </div>
        <div class="form-group">
          <label class="label">OT Punch Out</label>
          <input v-model="editForm.otPunchOut" class="input" type="time" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showEditModal = false">Cancel</button>
        <button class="btn-primary" :disabled="editSaving" @click="saveEditRecord">
          {{ editSaving ? 'Saving…' : 'Save Changes' }}
        </button>
      </template>
    </AppModal>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { mediaStorage } from '@/firebase/storage-config'
import { uploadToR2 } from '@/composables/useR2Storage'
import { getAll, create, update, where, orderBy } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import SelfieCapture from '@/components/ui/SelfieCapture.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { Doughnut, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
} from 'chart.js'
import * as XLSX from 'xlsx'
import { savePDF, saveExcel } from '@/utils/saveFile'
import {
  UserCheck, User, Users, UserX, LogIn, LogOut, Fingerprint,
  CheckCircle, Clock, ClipboardList, Loader2, FileText, FileDown,
  RefreshCw, ChevronDown, LayoutGrid, X, MapPin, CalendarX,
  Map as MapIcon, Table as TableIcon, Pencil, Zap, ZapOff,
} from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const auth     = useAuthStore()
const ui       = useUIStore()
const activity = useActivityStore()
const route    = useRoute()

const isAdmin   = computed(() => auth.user?.role === 'admin')
const activeTab = ref('mine')

// ── Dates ─────────────────────────────────────────────────────────────────────
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayStr = localDateStr()
const todayLabel = computed(() => new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
const currentMonthLabel = computed(() => new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }))

// ── My attendance ─────────────────────────────────────────────────────────────
const myLoading   = ref(false)
const myRecords   = ref([])
const todayRecord = ref(null)
const histFilter  = ref('month')

async function loadMyAttendance() {
  if (!auth.user?.id) return
  myLoading.value = true
  try {
    const recs = await getAll(Collections.ATTENDANCE, [
      where('employeeId', '==', auth.user.id),
    ])
    recs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    myRecords.value = recs
    todayRecord.value = recs.find(r => r.date === todayStr) || null
  } catch (e) {
    console.error('[loadMyAttendance]', e)
    ui.error('Could not load attendance records.')
  } finally {
    myLoading.value = false
  }
}

const filteredMyRecords = computed(() => {
  if (histFilter.value === 'month') {
    const thisMonth = todayStr.slice(0, 7)
    return myRecords.value.filter(r => r.date?.startsWith(thisMonth))
  }
  return myRecords.value
})

const myMonthStats = computed(() => {
  const thisMonth = todayStr.slice(0, 7)
  const monthRecs = myRecords.value.filter(r => r.date?.startsWith(thisMonth))
  const present = monthRecs.filter(r => r.status !== 'absent').length
  const late    = monthRecs.filter(r => r.status === 'late').length

  // Count absent only from the first attendance record date in this month
  // to avoid inflating absent count for employees who joined mid-month or
  // started using the app mid-month.
  let absent = 0
  if (monthRecs.length > 0) {
    const sortedDates = monthRecs.map(r => r.date).filter(Boolean).sort()
    const firstDate = sortedDates[0]
    absent = Math.max(0, getWorkingDaysSince(firstDate) - present)
  }

  const withHours = monthRecs.filter(r => r.checkInTime && r.checkOutTime)
  const totalH  = withHours.reduce((s, r) => s + Number(calcHours(r.checkInTime, r.checkOutTime)), 0)
  return {
    present,
    late,
    absent,
    avgHours: withHours.length ? (totalH / withHours.length).toFixed(1) : '—',
  }
})

// ── Month calendar (My Attendance) ────────────────────────────────────────────
const calendarStartOffset = computed(() => {
  const now  = new Date()
  const dayOfWeek = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
  // Convert Sun=0..Sat=6 → Mon=0..Sun=6
  return (dayOfWeek + 6) % 7
})

const monthCalendarDays = computed(() => {
  const now  = new Date()
  const year = now.getFullYear()
  const mon  = now.getMonth()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()
  const today = now.getDate()
  const days = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr   = `${year}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(year, mon, d).getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const past      = d < today
    const isToday   = d === today
    if (isWeekend) { days.push({ d, date: dateStr, status: 'weekend', past }); continue }
    const rec = myRecords.value.find(r => r.date === dateStr)
    let status = 'future'
    if (rec) status = rec.status || 'present'
    else if (isToday) status = 'today'
    else if (past) status = 'absent'
    days.push({ d, date: dateStr, status, past })
  }
  return days
})

// ── Punch UI helpers ──────────────────────────────────────────────────────────
const heroClass = computed(() => {
  if (!todayRecord.value) return 'hero-none'
  if (!todayRecord.value.checkOutTime) return 'hero-in'
  return 'hero-done'
})
const punchGreeting = computed(() => {
  if (!todayRecord.value) return 'Not checked in yet'
  if (!todayRecord.value.checkOutTime) return 'Checked in ✓'
  return 'Day complete ✓'
})

const showSelfie  = ref(false)
const selfieMode  = ref('checkin')
const punching    = ref(false)
const lightboxUrl = ref('')

function startPunch(mode) {
  selfieMode.value = mode
  showSelfie.value = true
}
function viewSelfie(url) { lightboxUrl.value = url }

// ── Location ──────────────────────────────────────────────────────────────────
async function getLocation() {
  if (!navigator.geolocation) return null
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords
        let name = null
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const d = await r.json()
          const a = d.address || {}
          name = d.name || a.road || a.neighbourhood || a.suburb ||
                 a.village || a.town || a.city_district || a.city || null
          if (!name && d.display_name) name = d.display_name.split(',')[0].trim()
        } catch { /* fallback to coords */ }
        resolve({ lat, lng, name })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

function openMap(lat, lng) {
  const url = `https://www.google.com/maps?q=${lat},${lng}`
  Capacitor.isNativePlatform() ? window.open(url, '_system') : window.open(url, '_blank')
}

// ── Selfie capture → save attendance ─────────────────────────────────────────
async function onSelfieCapture(blob) {
  showSelfie.value = false
  punching.value   = true
  try {
    const [locResult, uploadResult] = await Promise.allSettled([
      getLocation(),
      (async () => {
        const now  = new Date()
        const ts   = now.toISOString().replace(/[:.]/g, '-')
        const path = `attendance-selfies/${auth.user.id}/${localDateStr()}_${selfieMode.value}_${ts}.jpg`
        try {
          const sRef = storageRef(mediaStorage, path)
          await uploadBytes(sRef, blob, { contentType: 'image/jpeg' })
          return { url: await getDownloadURL(sRef), now }
        } catch (fbErr) {
          console.warn('[Storage] Firebase failed, falling back to R2:', fbErr.code || fbErr.message)
          try {
            const url = await uploadToR2(blob, path, 'image/jpeg')
            return { url, now }
          } catch (r2Err) {
            console.error('[Storage] R2 fallback also failed:', r2Err.message)
            throw new Error('Photo upload failed. Check your connection and try again.')
          }
        }
      })(),
    ])

    const loc = locResult.status === 'fulfilled' ? locResult.value : null
    if (uploadResult.status === 'rejected') throw uploadResult.reason
    const { url, now } = uploadResult.value
    const todayDateStr = localDateStr(now)

    if (selfieMode.value === 'checkin') {
      // Duplicate check
      if (myRecords.value.find(r => r.date === todayDateStr)) {
        ui.error('You have already checked in today.')
        return
      }
      const h = now.getHours(), m = now.getMinutes()
      const status = (h > 9 || (h === 9 && m >= 30)) ? 'late' : 'present'
      const newId = await create(Collections.ATTENDANCE, {
        employeeId:      auth.user.id,
        employeeName:    auth.user.fullName || auth.user.username,
        employeeRole:    auth.user.role,
        date:            todayDateStr,
        checkInTime:     now,
        checkInSelfie:   url,
        checkInLat:      loc?.lat ?? null,
        checkInLng:      loc?.lng ?? null,
        checkInLocation: loc?.name ?? null,
        checkOutTime:    null,
        checkOutSelfie:  null,
        checkOutLat:     null,
        checkOutLng:     null,
        checkOutLocation: null,
        status,
        workingHours:    null,
      })
      const rec = {
        id: newId, employeeId: auth.user.id,
        employeeName: auth.user.fullName || auth.user.username,
        date: todayDateStr, checkInTime: now, checkInSelfie: url,
        checkInLat: loc?.lat, checkInLng: loc?.lng, checkInLocation: loc?.name,
        status,
      }
      myRecords.value = [rec, ...myRecords.value]
      todayRecord.value = rec
      activity.log({ action: 'created', module: 'attendance', tab: 'Attendance', summary: `${auth.user.fullName || auth.user.username} checked in at ${formatTime(now)}`, details: { employeeName: auth.user.fullName || auth.user.username, date: todayDateStr, checkInTime: now.toISOString(), status, location: loc?.name } })
      ui.success(`Checked in at ${formatTime(now)}${status === 'late' ? ' — Late arrival' : ''}${loc?.name ? ' · ' + loc.name : ''}`)
    } else if (selfieMode.value === 'checkout') {
      if (!todayRecord.value?.id) throw new Error('No check-in record found')
      const checkOutTime = now
      const hrs = Number(calcHours(todayRecord.value.checkInTime, checkOutTime))
      await update(Collections.ATTENDANCE, todayRecord.value.id, {
        checkOutTime,
        checkOutSelfie:   url,
        checkOutLat:      loc?.lat ?? null,
        checkOutLng:      loc?.lng ?? null,
        checkOutLocation: loc?.name ?? null,
        workingHours:     hrs,
      })
      todayRecord.value = {
        ...todayRecord.value, checkOutTime, checkOutSelfie: url,
        checkOutLat: loc?.lat, checkOutLng: loc?.lng, checkOutLocation: loc?.name, workingHours: hrs,
      }
      myRecords.value = myRecords.value.map(r => r.id === todayRecord.value.id ? todayRecord.value : r)
      ui.success(`Checked out at ${formatTime(now)} — ${hrs} hrs worked${loc?.name ? ' · ' + loc.name : ''}`)
    } else if (selfieMode.value === 'ot-in') {
      if (!todayRecord.value?.id) throw new Error('No attendance record found')
      await update(Collections.ATTENDANCE, todayRecord.value.id, {
        otPunchIn: now,
        otPunchInSelfie: url,
        otPunchInLat: loc?.lat ?? null,
        otPunchInLng: loc?.lng ?? null,
      })
      todayRecord.value = { ...todayRecord.value, otPunchIn: now, otPunchInSelfie: url }
      myRecords.value = myRecords.value.map(r => r.id === todayRecord.value.id ? todayRecord.value : r)
      ui.success(`Overtime started at ${formatTime(now)}${loc?.name ? ' · ' + loc.name : ''}`)
    } else if (selfieMode.value === 'ot-out') {
      if (!todayRecord.value?.id || !todayRecord.value.otPunchIn) throw new Error('No OT punch-in found')
      const otHrs = Number(calcHours(todayRecord.value.otPunchIn, now))
      await update(Collections.ATTENDANCE, todayRecord.value.id, {
        otPunchOut: now,
        otPunchOutSelfie: url,
        otHours: otHrs,
      })
      todayRecord.value = { ...todayRecord.value, otPunchOut: now, otPunchOutSelfie: url, otHours: otHrs }
      myRecords.value = myRecords.value.map(r => r.id === todayRecord.value.id ? todayRecord.value : r)
      ui.success(`Overtime ended at ${formatTime(now)} — ${otHrs}h OT recorded`)
    }
  } catch (e) {
    ui.error(`Failed to record attendance: ${e.message}`)
  } finally {
    punching.value = false
  }
}

// ── Monthly log (admin) ───────────────────────────────────────────────────────
const logMonth        = ref(todayStr.slice(0, 7))
const monthLogRecords = ref([])
const monthLogLoading = ref(false)
const monthLogSearch  = ref('')

function getWorkingDaysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const now = new Date()
  const isCurrentMonth = yearMonth === todayStr.slice(0, 7)
  const lastDay = isCurrentMonth ? now.getDate() : daysInMonth
  let count = 0
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(y, m - 1, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

function getMonthLabel(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const monthLogEmployees = computed(() => {
  const search = monthLogSearch.value.toLowerCase()
  const workingDays = getWorkingDaysInMonth(logMonth.value)
  return allEmployees.value
    .filter(e => !search || e.name?.toLowerCase().includes(search))
    .map(emp => {
      const empRecs = monthLogRecords.value
        .filter(r => r.employeeId === emp.id)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      const present = empRecs.filter(r => r.status !== 'absent').length
      const late    = empRecs.filter(r => r.status === 'late').length
      const absent  = Math.max(0, workingDays - present)
      const withHours = empRecs.filter(r => r.checkInTime && r.checkOutTime)
      const totalHours = withHours.reduce((s, r) => s + Number(calcHours(r.checkInTime, r.checkOutTime)), 0)
      const totalOT = empRecs.reduce((s, r) => s + (Number(r.otHours) || 0), 0)
      return reactive({ ...emp, empRecs, present, late, absent, totalHours: totalHours.toFixed(1), totalOT: totalOT.toFixed(2), totalWorkingDays: workingDays, _logOpen: false })
    })
})

async function loadMonthLog() {
  if (!isAdmin.value) return
  monthLogLoading.value = true
  try {
    if (!allEmployees.value.length) {
      const employees = await getAll(Collections.EMPLOYEES)
      allEmployees.value = employees
        .filter(e => e.status !== 'inactive')
        .map(e => ({ id: e.id, name: e.fullName || e.username || e.name, role: e.role || 'user' }))
    }
    const [y, m] = logMonth.value.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const startDate = `${logMonth.value}-01`
    const endDate   = `${logMonth.value}-${String(daysInMonth).padStart(2, '0')}`
    monthLogRecords.value = await getAll(Collections.ATTENDANCE, [
      where('date', '>=', startDate),
      where('date', '<=', endDate),
    ])
  } catch (e) {
    ui.error('Failed to load monthly log')
  } finally {
    monthLogLoading.value = false
  }
}

// ── Admin edit attendance ─────────────────────────────────────────────────────
const showEditModal = ref(false)
const editRec = ref(null)
const editForm = ref({ checkInTime: '', checkOutTime: '', status: 'present', otPunchIn: '', otPunchOut: '' })
const editSaving = ref(false)

function timeToDate(dateStr, timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(dateStr + 'T00:00:00')
  d.setHours(h, m, 0, 0)
  return d
}

function dateToTimeStr(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function openEditRecord(rec, emp) {
  editRec.value = { ...rec, employeeName: emp?.name || rec.employeeName }
  editForm.value = {
    checkInTime: dateToTimeStr(rec.checkInTime),
    checkOutTime: dateToTimeStr(rec.checkOutTime),
    status: rec.status || 'present',
    otPunchIn: dateToTimeStr(rec.otPunchIn),
    otPunchOut: dateToTimeStr(rec.otPunchOut),
  }
  showEditModal.value = true
}

async function saveEditRecord() {
  if (!editRec.value?.id) return
  editSaving.value = true
  try {
    const rec = editRec.value
    const checkInDate = editForm.value.checkInTime ? timeToDate(rec.date, editForm.value.checkInTime) : null
    const checkOutDate = editForm.value.checkOutTime ? timeToDate(rec.date, editForm.value.checkOutTime) : null
    const workingHours = checkInDate && checkOutDate
      ? Number(((checkOutDate - checkInDate) / 3600000).toFixed(1))
      : null
    const otInDate = editForm.value.otPunchIn ? timeToDate(rec.date, editForm.value.otPunchIn) : null
    const otOutDate = editForm.value.otPunchOut ? timeToDate(rec.date, editForm.value.otPunchOut) : null
    const otHours = otInDate && otOutDate
      ? Number(((otOutDate - otInDate) / 3600000).toFixed(2))
      : (rec.otHours ?? null)
    await update(Collections.ATTENDANCE, rec.id, {
      checkInTime: checkInDate,
      checkOutTime: checkOutDate,
      workingHours,
      status: editForm.value.status,
      ...(otInDate  !== undefined && { otPunchIn:  otInDate  }),
      ...(otOutDate !== undefined && { otPunchOut: otOutDate }),
      ...(otHours   !== null      && { otHours }),
      adminEdited: true,
      editedAt: new Date(),
      editedBy: auth.user?.fullName || auth.user?.username,
    })
    activity.log({ action: 'updated', module: 'attendance', tab: 'Attendance', summary: `Updated attendance record for ${rec.employeeName || rec.employeeId} on ${rec.date}`, details: { employeeName: rec.employeeName, date: rec.date, status: editForm.value.status, editedBy: auth.user?.fullName || auth.user?.username } })
    ui.success('Attendance record updated.')
    showEditModal.value = false
    // Reload monthly log to reflect changes
    await loadMonthLog()
  } catch (e) {
    ui.error('Failed to update record: ' + (e?.message || e))
  } finally {
    editSaving.value = false
  }
}

async function markAbsent(rec) {
  if (!rec?.id) return
  try {
    await update(Collections.ATTENDANCE, rec.id, {
      status: 'absent',
      checkInTime: null,
      checkOutTime: null,
      workingHours: null,
      adminEdited: true,
      editedAt: new Date(),
      editedBy: auth.user?.fullName || auth.user?.username,
    })
    ui.success('Marked as absent.')
    await loadMonthLog()
  } catch (e) {
    ui.error('Failed to mark absent: ' + (e?.message || e))
  }
}

async function downloadMonthlyExcel(emp) {
  let rows
  if (emp) {
    rows = emp.empRecs.map(r => ({
      Employee:    emp.name,
      Role:        emp.role,
      Date:        r.date,
      Day:         getDayName(r.date),
      'Check In':  formatTime(r.checkInTime),
      'Check Out': r.checkOutTime ? formatTime(r.checkOutTime) : '—',
      Hours:       r.checkInTime && r.checkOutTime ? calcHours(r.checkInTime, r.checkOutTime) : '—',
      Status:      r.status || 'present',
      Location:    r.checkInLocation || '—',
    }))
  } else {
    rows = monthLogEmployees.value.map(e => ({
      Employee:       e.name,
      Role:           e.role,
      'Working Days': e.totalWorkingDays,
      Present:        e.present,
      Late:           e.late,
      Absent:         e.absent,
      'Total Hours':  e.totalHours,
    }))
  }
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
  const fname = emp
    ? `Attendance_${emp.name.replace(/\s+/g, '_')}_${logMonth.value}.xlsx`
    : `Attendance_${logMonth.value}.xlsx`
  await saveExcel(wb, fname, ui)
}

async function downloadMonthlyPDF(emp) {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  const label = getMonthLabel(logMonth.value)
  const doc = new jsPDF({ orientation: emp ? 'portrait' : 'landscape' })
  if (emp) {
    doc.setFontSize(14)
    doc.text(`Attendance Report — ${emp.name}`, 14, 16)
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text(`${label}   |   Present: ${emp.present}   Late: ${emp.late}   Absent: ${emp.absent}   Total: ${emp.totalHours}h`, 14, 24)
    doc.setTextColor(0, 0, 0)
    doc.autoTable({
      startY: 30,
      head: [['Date', 'Day', 'Check In', 'Check Out', 'Hours', 'Status', 'Location']],
      body: emp.empRecs.map(r => [
        r.date, getDayName(r.date), formatTime(r.checkInTime),
        r.checkOutTime ? formatTime(r.checkOutTime) : '—',
        r.checkInTime && r.checkOutTime ? calcHours(r.checkInTime, r.checkOutTime) + 'h' : '—',
        r.status || 'present', r.checkInLocation || '—',
      ]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [30, 41, 59] },
    })
    await savePDF(doc, `Attendance_${emp.name.replace(/\s+/g, '_')}_${logMonth.value}.pdf`, ui)
  } else {
    doc.setFontSize(14)
    doc.text(`Monthly Attendance Summary — ${label}`, 14, 16)
    doc.autoTable({
      startY: 22,
      head: [['Employee', 'Role', 'Working Days', 'Present', 'Late', 'Absent', 'Total Hours']],
      body: monthLogEmployees.value.map(e => [
        e.name, e.role, e.totalWorkingDays, e.present, e.late, e.absent, e.totalHours + 'h',
      ]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [30, 41, 59] },
    })
    await savePDF(doc, `Attendance_Summary_${logMonth.value}.pdf`, ui)
  }
}

// ── Team overview (admin) ─────────────────────────────────────────────────────
const teamLoading  = ref(false)
const teamView     = ref('cards')
const teamSearch   = ref('')
const filterDate   = ref(todayStr)
const filterStatus = ref('')

const allEmployees  = ref([])
const teamRecords   = ref([])
const weeklyRecords = ref([])

const uniqueTodayByEmployee = computed(() => {
  const map = new Map()
  for (const rec of teamRecords.value) {
    if (!map.has(rec.employeeId)) {
      map.set(rec.employeeId, rec)
    } else {
      const ex = map.get(rec.employeeId)
      if (rec.status === 'late' && ex.status === 'present') map.set(rec.employeeId, rec)
    }
  }
  return [...map.values()]
})

const teamStats = computed(() => {
  const total   = allEmployees.value.length
  const present = uniqueTodayByEmployee.value.filter(r => r.status !== 'absent').length
  const late    = uniqueTodayByEmployee.value.filter(r => r.status === 'late').length
  const absent  = Math.max(0, total - present)
  return { total, present, late, absent }
})

const filteredTeamRecords = computed(() => {
  const empCount = {}
  for (const r of teamRecords.value) empCount[r.employeeId] = (empCount[r.employeeId] || 0) + 1
  let recs = teamRecords.value.map(r => ({ ...r, _isDuplicate: empCount[r.employeeId] > 1 }))
  if (filterStatus.value) recs = recs.filter(r => r.status === filterStatus.value)
  if (teamSearch.value) {
    const q = teamSearch.value.toLowerCase()
    recs = recs.filter(r => r.employeeName?.toLowerCase().includes(q))
  }
  return recs
})

const filteredEmployeeCards = computed(() => {
  let emps = employeeCards.value
  const q = teamSearch.value.toLowerCase()
  if (q) emps = emps.filter(e => e.name?.toLowerCase().includes(q))
  return emps
})

const employeeCards = computed(() =>
  allEmployees.value.map(emp => {
    const todayRec    = uniqueTodayByEmployee.value.find(r => r.employeeId === emp.id)
    const todayStatus = todayRec ? todayRec.status : 'absent'
    const monthCalendar = buildMonthCalendar(emp.id)
    const monthStats = {
      present: monthCalendar.filter(d => d.status === 'present').length,
      late:    monthCalendar.filter(d => d.status === 'late').length,
      absent:  monthCalendar.filter(d => d.status === 'absent' && d.past).length,
    }
    return reactive({ ...emp, todayRecord: todayRec || null, todayStatus, monthCalendar, monthStats, _open: false })
  })
)

function buildMonthCalendar(empId) {
  const now  = new Date()
  const year = now.getFullYear()
  const mon  = now.getMonth()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()
  const today = now.getDate()
  const days = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr   = `${year}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(year, mon, d).getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const past      = d < today
    if (isWeekend) { days.push({ d, date: dateStr, status: 'weekend', past }); continue }
    const rec = weeklyRecords.value.find(r => r.employeeId === empId && r.date === dateStr)
    days.push({ d, date: dateStr, status: rec ? (rec.status || 'present') : (past ? 'absent' : 'future'), past })
  }
  return days
}

async function loadTeam() {
  teamLoading.value = true
  try {
    const employees = await getAll(Collections.EMPLOYEES)
    allEmployees.value = employees
      .filter(e => e.status !== 'inactive')
      .map(e => ({ id: e.id, name: e.fullName || e.username || e.name, role: e.role || 'user' }))

    const date = filterDate.value || todayStr
    teamRecords.value = await getAll(Collections.ATTENDANCE, [where('date', '==', date)])

    const since = new Date(); since.setDate(since.getDate() - 35)
    weeklyRecords.value = await getAll(Collections.ATTENDANCE, [
      where('date', '>=', localDateStr(since)),
      orderBy('date', 'desc'),
    ])
  } catch (e) {
    ui.error('Failed to load team attendance: ' + e.message)
  } finally {
    teamLoading.value = false
  }
}

// ── Charts ────────────────────────────────────────────────────────────────────
const todayChartData = computed(() => {
  const { present, late, absent } = teamStats.value
  if (!teamStats.value.total) return null
  return {
    labels: ['On Time', 'Late', 'Absent'],
    datasets: [{
      data: [present - late, late, absent],
      backgroundColor: ['rgba(74,222,128,0.75)', 'rgba(251,191,36,0.75)', 'rgba(248,113,113,0.75)'],
      borderWidth: 0,
    }],
  }
})

const weekChartData = computed(() => {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dateStr = localDateStr(d)
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' })
    const count = new Set(
      weeklyRecords.value.filter(r => r.date === dateStr && r.status !== 'absent').map(r => r.employeeId)
    ).size
    days.push({ label, count })
  }
  return {
    labels: days.map(d => d.label),
    datasets: [{
      label: 'Present',
      data: days.map(d => d.count),
      backgroundColor: 'rgba(99,102,241,0.65)',
      borderRadius: 6, borderWidth: 0,
    }],
  }
})

const doughnutOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } },
}
const barOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
    y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
  },
}

// ── Export ────────────────────────────────────────────────────────────────────
async function triggerExport(type) { type === 'excel' ? exportExcel() : exportPDF() }

async function exportExcel() {
  const rows = teamRecords.value.map(r => ({
    Employee:    r.employeeName,
    Role:        r.employeeRole,
    Date:        r.date,
    'Check In':  formatTime(r.checkInTime),
    'Check Out': r.checkOutTime ? formatTime(r.checkOutTime) : '—',
    Hours:       r.checkInTime && r.checkOutTime ? calcHours(r.checkInTime, r.checkOutTime) : '—',
    Status:      r.status || 'present',
  }))
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [20, 14, 12, 10, 10, 8, 10].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
  await saveExcel(wb, `Attendance_${filterDate.value || todayStr}.xlsx`, ui)
}

async function exportPDF() {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(`Attendance Report — ${filterDate.value || todayStr}`, 14, 16)
  doc.autoTable({
    startY: 22,
    head: [['Employee', 'Role', 'Date', 'Check In', 'Check Out', 'Hours', 'Status']],
    body: teamRecords.value.map(r => [
      r.employeeName, r.employeeRole, r.date,
      formatTime(r.checkInTime),
      r.checkOutTime ? formatTime(r.checkOutTime) : '—',
      r.checkInTime && r.checkOutTime ? calcHours(r.checkInTime, r.checkOutTime) + 'h' : '—',
      r.status || 'present',
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  })
  await savePDF(doc, `Attendance_${filterDate.value || todayStr}.pdf`, ui)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDayNum(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').getDate()
}

function formatMonthShort(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })
}

function getDayName(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })
}

function calcHours(inTs, outTs) {
  if (!inTs || !outTs) return 0
  const i = (inTs?.toDate ? inTs.toDate() : new Date(inTs)).getTime()
  const o = (outTs?.toDate ? outTs.toDate() : new Date(outTs)).getTime()
  return ((o - i) / 3600000).toFixed(1)
}

function statusPill(status) {
  if (status === 'present') return 'sp-won'
  if (status === 'late')    return 'sp-proposal'
  if (status === 'absent')  return 'sp-lost'
  return 'sp-won'
}

function getWorkingDaysPassed() {
  const now = new Date()
  let count = 0
  for (let d = 1; d <= now.getDate(); d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

// Count working days from a given date string (inclusive) up to today
function getWorkingDaysSince(dateStr) {
  if (!dateStr) return 0
  const start = new Date(dateStr + 'T00:00:00')
  const now   = new Date()
  // Clamp to today
  if (start > now) return 0
  let count = 0
  const cur = new Date(start)
  while (cur <= now) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function avatarStyle(name) {
  const colors = [
    ['rgba(99,102,241,0.2)', '#818cf8'],
    ['rgba(168,85,247,0.2)', '#c084fc'],
    ['rgba(16,185,129,0.2)', '#34d399'],
    ['rgba(245,158,11,0.2)', '#fbbf24'],
    ['rgba(239,68,68,0.2)',  '#f87171'],
  ]
  const idx = (name || '').charCodeAt(0) % colors.length
  return { background: colors[idx][0], color: colors[idx][1], borderColor: colors[idx][1] + '44' }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  loadMyAttendance()
  if (isAdmin.value) { loadTeam(); loadMonthLog() }
})

watch(() => auth.user?.id, (id, prev) => {
  if (id && !prev) {
    loadMyAttendance()
    if (isAdmin.value) loadTeam()
  }
})

watch(isAdmin, val => { if (val && !allEmployees.value.length) { loadTeam(); loadMonthLog() } })
watch(logMonth, () => { if (isAdmin.value) loadMonthLog() })

watch(() => route.path, path => {
  if (path === '/attendance') {
    loadMyAttendance()
    if (isAdmin.value) loadTeam()
  }
})
</script>

<style scoped>
.att-view { padding-bottom: 40px; }

/* ── Punch Hero ───────────────────────────────────────────────────────────────── */
.punch-hero {
  border-radius: 22px; padding: 22px 20px 20px;
  margin-bottom: 14px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03);
  transition: border-color 0.3s, background 0.3s;
}
.hero-none { border-color: rgba(255,255,255,0.07); }
.hero-in   { border-color: rgba(74,222,128,0.3); background: rgba(74,222,128,0.04); }
.hero-done { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.04); }

.ph-top {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 18px;
}
.ph-greeting { font-size: 17px; font-weight: 700; color: var(--ct-primary); }
.ph-date     { font-size: 12px; color: var(--ct-muted); margin-top: 4px; }
.ph-refresh  {
  width: 34px; height: 34px; border-radius: 10px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  color: var(--ct-muted); display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0; transition: background 0.15s;
}
.ph-refresh:hover { background: rgba(255,255,255,0.1); }
.ph-refresh:disabled { opacity: 0.4; cursor: wait; }

.ph-times-row {
  display: grid; grid-template-columns: 1fr 32px 1fr;
  align-items: center; gap: 10px; margin-bottom: 14px;
}
.ph-time-block { }
.ph-time-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .06em; color: var(--ct-muted); margin-bottom: 4px;
}
.ph-time-val { font-size: 20px; font-weight: 800; color: var(--ct-primary); letter-spacing: -0.5px; }
.ph-loc {
  display: flex; align-items: center; gap: 3px;
  font-size: 10px; color: var(--ct-muted); margin-top: 3px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ph-time-sep { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.ph-sep-line { width: 1px; height: 32px; background: rgba(255,255,255,0.12); }
.ph-sep-hrs  { font-size: 10px; color: #4ade80; font-weight: 700; }

.ph-selfies { display: flex; gap: 10px; margin-bottom: 16px; }
.ph-selfie-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer;
}
.ph-selfie-wrap span { font-size: 9px; font-weight: 700; color: var(--ct-muted); text-transform: uppercase; }
.ph-selfie {
  width: 52px; height: 52px; border-radius: 12px; object-fit: cover;
  border: 2px solid rgba(99,102,241,0.3); transform: scaleX(-1);
  transition: border-color 0.15s;
}
.ph-selfie:hover { border-color: #6366f1; }

.ph-action { display: flex; justify-content: center; }
.ph-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; max-width: 300px; padding: 16px 24px;
  border-radius: 14px; font-size: 16px; font-weight: 700;
  border: 2px solid; cursor: pointer; transition: all 0.18s;
}
.ph-btn-in  { background: rgba(74,222,128,0.1);  border-color: rgba(74,222,128,0.4);  color: #4ade80; }
.ph-btn-in:hover  { background: rgba(74,222,128,0.18); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(74,222,128,0.15); }
.ph-btn-out { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.4); color: #f87171; }
.ph-btn-out:hover { background: rgba(248,113,113,0.18); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(248,113,113,0.15); }
.ph-btn:disabled { opacity: 0.5; cursor: wait; transform: none !important; box-shadow: none !important; }
.ph-done {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 600; color: #4ade80;
}

/* ── Month stats bar ─────────────────────────────────────────────────────────── */
.my-stats-bar {
  display: flex; align-items: center; justify-content: space-around;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; padding: 14px 10px; margin-bottom: 14px;
}
.msb-item { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; }
.msb-val  { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
.msb-lbl  { font-size: 10px; color: var(--ct-muted); text-transform: uppercase; letter-spacing: .05em; }
.msb-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.07); }

/* ── Month calendar card ─────────────────────────────────────────────────────── */
.my-calendar-card {
  border-radius: 18px; padding: 16px; margin-bottom: 16px;
}
.mcc-title {
  font-size: 13px; font-weight: 700; color: var(--ct-primary);
  margin-bottom: 12px;
}
.mcc-days-header {
  display: grid; grid-template-columns: repeat(7, 1fr);
  margin-bottom: 6px;
}
.mcc-dh {
  text-align: center; font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .04em; color: var(--ct-muted);
}
.mcc-grid {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
}
.mcc-cell {
  aspect-ratio: 1; border-radius: 8px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; position: relative; cursor: default;
  background: rgba(255,255,255,0.03);
}
.mcc-blank { background: transparent; }
.mcc-num { font-size: 11px; font-weight: 600; color: var(--ct-muted); line-height: 1; }
.mcc-dot { width: 4px; height: 4px; border-radius: 50%; margin-top: 2px; }
.mcc-dot-present { background: #4ade80; }
.mcc-dot-late    { background: #fbbf24; }
.mcc-dot-absent  { background: #f87171; }
.mcc-present { background: rgba(74,222,128,0.12); }
.mcc-present .mcc-num { color: #4ade80; font-weight: 700; }
.mcc-late    { background: rgba(251,191,36,0.12); }
.mcc-late .mcc-num    { color: #fbbf24; font-weight: 700; }
.mcc-absent  { background: rgba(248,113,113,0.08); }
.mcc-absent .mcc-num  { color: #f87171; }
.mcc-today   { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.4); }
.mcc-today .mcc-num   { color: #818cf8; font-weight: 800; }
.mcc-weekend { background: transparent; }
.mcc-weekend .mcc-num { opacity: 0.3; }
.mcc-future .mcc-num  { opacity: 0.2; }

/* ── History list ────────────────────────────────────────────────────────────── */
.my-hist-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.my-hist-list { display: flex; flex-direction: column; gap: 8px; }
.mhl-row {
  display: grid; grid-template-columns: 52px 1fr auto;
  align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 14px;
  border-left: 3px solid transparent;
}
.mhl-present { border-left-color: rgba(74,222,128,0.5); }
.mhl-late    { border-left-color: rgba(251,191,36,0.5); }
.mhl-absent  { border-left-color: rgba(248,113,113,0.4); }

.mhl-date { text-align: center; }
.mhl-day-num  { font-size: 18px; font-weight: 800; color: var(--ct-primary); line-height: 1; }
.mhl-day-name { font-size: 9px; text-transform: uppercase; letter-spacing:.05em; color: var(--ct-muted); margin: 1px 0; }
.mhl-month    { font-size: 10px; color: var(--ct-muted); }

.mhl-body { min-width: 0; }
.mhl-times {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600;
}
.mhl-in    { color: #4ade80; }
.mhl-arrow { color: var(--ct-muted); font-size: 11px; }
.mhl-meta  {
  display: flex; align-items: center; gap: 10px;
  margin-top: 3px; font-size: 11px; color: var(--ct-muted);
}
.mhl-hrs  { }
.mhl-loc  { display: flex; align-items: center; gap: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mhl-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.mhl-selfie {
  width: 36px; height: 36px; border-radius: 9px; object-fit: cover;
  border: 1px solid rgba(99,102,241,0.25); cursor: pointer;
  transform: scaleX(-1); transition: border-color 0.15s;
}
.mhl-selfie:hover { border-color: #6366f1; }

/* ── Team stats ──────────────────────────────────────────────────────────────── */
.filters-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
.team-stats-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;
}
@media (min-width: 600px) { .team-stats-grid { grid-template-columns: repeat(4, 1fr); } }
.team-stat { display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 14px; }
.ts-icon {
  width: 40px; height: 40px; border-radius: 11px; border: 1px solid;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.ts-val { font-size: 24px; font-weight: 800; color: var(--ct-primary); letter-spacing: -0.5px; }
.ts-lbl { font-size: 11px; color: var(--ct-muted); margin-top: 2px; }

/* ── Charts ──────────────────────────────────────────────────────────────────── */
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
@media (max-width: 600px) { .charts-row { grid-template-columns: 1fr; } }
.chart-card { padding: 16px; border-radius: 16px; }
.chart-card-title {
  font-size: 12px; font-weight: 600; color: var(--ct-muted);
  text-transform: uppercase; letter-spacing:.05em; margin-bottom: 12px;
}

/* ── Employee cards ──────────────────────────────────────────────────────────── */
.emp-cards-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 680px) { .emp-cards-grid { grid-template-columns: repeat(2, 1fr); } }
.emp-card { border-radius: 16px; overflow: hidden; }
.emp-card-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; user-select: none; }
.emp-card-header:hover { background: rgba(255,255,255,0.03); }
.emp-avatar {
  width: 40px; height: 40px; border-radius: 12px; border: 1px solid;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; flex-shrink: 0;
}
.emp-info { flex: 1; min-width: 0; }
.emp-name { font-size: 14px; font-weight: 600; color: var(--ct-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.emp-role { font-size: 11px; color: var(--ct-muted); text-transform: capitalize; }
.emp-today-status { text-align: right; flex-shrink: 0; }
.emp-today-time { font-size: 10px; color: var(--ct-muted); margin-top: 4px; }
.emp-today-loc { font-size: 9px; color: var(--ct-muted); margin-top: 3px; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.emp-card-body { border-top: 1px solid rgba(255,255,255,0.06); padding: 16px; }
.emp-selfie-row { display: flex; gap: 12px; margin-bottom: 14px; }
.emp-selfie-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.emp-selfie {
  width: 72px; height: 72px; border-radius: 12px; object-fit: cover;
  border: 2px solid rgba(99,102,241,0.25); cursor: pointer;
  transform: scaleX(-1); transition: border-color 0.15s;
}
.emp-selfie:hover { border-color: #6366f1; }
.emp-selfie-lbl { font-size: 10px; color: var(--ct-muted); }
.emp-loc-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 4px;
}
.emp-loc-label { font-size: 9px; color: var(--ct-muted); text-transform: uppercase; letter-spacing:.04em; }
.emp-loc-name  { font-size: 12px; color: var(--ct-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Monthly calendar (team cards) */
.month-label { font-size: 11px; font-weight: 600; color: var(--ct-muted); text-transform: uppercase; letter-spacing:.05em; margin-bottom: 8px; }
.att-calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 10px; }
.cal-day {
  aspect-ratio: 1; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600;
}
.cal-day.present { background: rgba(74,222,128,0.2);  color: #4ade80; }
.cal-day.late    { background: rgba(251,191,36,0.2);   color: #fbbf24; }
.cal-day.absent  { background: rgba(248,113,113,0.12); color: #f87171; }
.cal-day.weekend { background: rgba(255,255,255,0.04); color: var(--ct-muted); opacity: 0.6; }
.cal-day.future  { background: rgba(255,255,255,0.03); color: var(--ct-muted); opacity: 0.35; }
.att-month-stats { display: flex; gap: 16px; font-size: 11px; font-weight: 600; flex-wrap: wrap; }

/* ── Shared ───────────────────────────────────────────────────────────────────── */
.active-view { background: rgba(99,102,241,0.15) !important; color: var(--ct-accent) !important; border-color: rgba(99,102,241,0.3) !important; }
.selfie-mini {
  width: 36px; height: 36px; border-radius: 9px; object-fit: cover;
  border: 1px solid rgba(99,102,241,0.25); cursor: pointer;
  transform: scaleX(-1); transition: border-color 0.15s;
}
.selfie-mini:hover { border-color: #6366f1; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Lightbox ────────────────────────────────────────────────────────────────── */
.lightbox {
  position: fixed; inset: 0; z-index: 1200;
  background: rgba(0,0,0,0.92); backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center; padding: 24px; cursor: pointer;
}
.lightbox-img { max-width: 100%; max-height: 90vh; border-radius: 16px; object-fit: contain; transform: scaleX(-1); }
.lightbox-close {
  position: absolute; top: 20px; right: 20px;
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer;
}

/* ── Monthly log ─────────────────────────────────────────────────────────────── */
.monthly-log-wrap { margin-top: 28px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,0.06); }
.monthly-log-bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;
}
.log-detail-inner { padding: 8px 16px 12px; overflow-x: auto; }

/* ── Light theme ─────────────────────────────────────────────────────────────── */
[data-theme="light"] .punch-hero,
[data-theme="light"] .my-stats-bar,
[data-theme="light"] .my-calendar-card,
[data-theme="light"] .mhl-row,
[data-theme="light"] .team-stat,
[data-theme="light"] .chart-card,
[data-theme="light"] .emp-card { background: #f8fafc; border-color: rgba(0,0,0,0.06); }
[data-theme="light"] .mcc-cell { background: rgba(0,0,0,0.03); }
</style>
