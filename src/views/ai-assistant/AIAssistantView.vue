<template>
  <div class="ai-view">
    <!-- Header -->
    <div class="ai-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="ai-avatar-lg">
          <img src="/AI.png" style="width:28px;height:28px;object-fit:contain;" alt="AI" />
        </div>
        <div>
          <div class="ai-title">Elevex AI</div>
          <div class="ai-sub" :class="{ online: isReady }">
            {{ isReady ? 'Your intelligent data assistant' : 'Configure LLM in Configurations' }}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span style="font-size:12px;color:var(--ct-muted);">{{ messages.length ? messages.length + ' messages' : 'New chat' }}</span>
        <button class="btn-secondary btn-sm" @click="clearChat" title="Clear chat">
          <Trash2 :size="13" />
        </button>
      </div>
    </div>

    <!-- Chat Area -->
    <div class="chat-area" ref="chatAreaRef">
      <!-- Welcome -->
      <div v-if="!messages.length" class="welcome-block">
        <div class="welcome-icon">
          <img src="/AI.png" style="width:100%;height:100%;object-fit:contain;" alt="AI" />
        </div>
        <div class="welcome-title">Hello! I'm Elevex AI</div>
        <div class="welcome-sub">I can read and manage your data. Try asking me:</div>
        <div class="suggestion-grid">
          <button
            v-for="s in suggestions"
            :key="s"
            class="suggestion-chip"
            @click="sendSuggestion(s)"
          >{{ s }}</button>
        </div>
      </div>

      <!-- Messages -->
      <template v-for="msg in messages" :key="msg.id">
        <!-- User message -->
        <div v-if="msg.role === 'user'" class="msg-row msg-user">
          <div class="msg-bubble msg-bubble-user">
            <div class="msg-text">{{ msg.content }}</div>
            <div class="msg-time">{{ formatTime(msg.ts) }}</div>
          </div>
          <div class="user-avatar-sm">{{ userInitials }}</div>
        </div>

        <!-- Tool call indicator -->
        <div v-if="msg.role === 'tool_call'" class="msg-row msg-tool">
          <div class="tool-pill">
            <Database :size="12" />
            {{ msg.content }}
          </div>
        </div>

        <!-- Assistant message -->
        <div v-if="msg.role === 'assistant'" class="msg-row msg-assistant">
          <div class="ai-avatar-sm"><img src="/AI.png" style="width:18px;height:18px;object-fit:contain;" alt="AI" /></div>
          <div class="msg-bubble msg-bubble-assistant">
            <div class="msg-text" v-html="renderMarkdown(msg.content)"></div>
            <div class="msg-time">{{ formatTime(msg.ts) }}</div>
          </div>
        </div>
      </template>

      <!-- Typing indicator -->
      <div v-if="thinking" class="msg-row msg-assistant">
        <div class="ai-avatar-sm"><Bot :size="14" /></div>
        <div class="msg-bubble msg-bubble-assistant">
          <div class="typing-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Action Confirmation Dialog -->
    <Teleport to="body">
      <div v-if="pendingConfirm" class="confirm-overlay" @click.self="rejectConfirm">
        <div class="confirm-dialog">
          <div class="confirm-header">
            <div class="confirm-icon" :class="pendingConfirm.type === 'create' ? 'icon-create' : 'icon-update'">
              <component :is="pendingConfirm.type === 'create' ? PlusCircle : EditIcon" :size="20" />
            </div>
            <div>
              <div class="confirm-title">
                {{ pendingConfirm.type === 'create' ? 'Create New Record?' : 'Update Record?' }}
              </div>
              <div class="confirm-sub">AI wants to {{ pendingConfirm.type === 'create' ? 'create a new document in' : 'update a document in' }} <strong>{{ pendingConfirm.collection }}</strong></div>
            </div>
          </div>
          <div class="confirm-body">
            <div class="confirm-label">Changes to be made:</div>
            <pre class="confirm-pre">{{ JSON.stringify(pendingConfirm.data, null, 2) }}</pre>
          </div>
          <div class="confirm-actions">
            <button class="btn-secondary" @click="rejectConfirm">
              <X :size="14" /> Reject
            </button>
            <button class="btn-primary" @click="approveConfirm">
              <Check :size="14" /> Confirm
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Input Area -->
    <div class="input-area">
      <!-- File preview chip -->
      <div v-if="uploadedFile" class="file-chip">
        <component :is="uploadedFile.kind === 'image' ? ImageIcon : FileText" :size="13" />
        <span>{{ uploadedFile.name }}</span>
        <button @click="removeFile" class="file-chip-remove"><X :size="11" /></button>
      </div>

      <div class="input-wrap">
        <!-- Hidden file input -->
        <input
          ref="fileInputRef"
          type="file"
          style="display:none;"
          accept="image/*,.pdf,.csv,.xlsx,.xls,.txt"
          @change="handleFileSelect"
        />
        <!-- Attach button -->
        <button
          class="attach-btn"
          @click="fileInputRef.click()"
          :disabled="!isReady || thinking"
          title="Attach file (image, CSV, Excel, PDF)"
        >
          <Paperclip :size="16" />
        </button>
        <textarea
          ref="inputRef"
          v-model="userInput"
          class="chat-input"
          :placeholder="isReady ? 'Ask anything or attach a file… (Shift+Enter for new line)' : 'Configure LLM API in Configurations first…'"
          :disabled="!isReady || thinking"
          rows="1"
          @keydown.enter.exact.prevent="sendMessage"
          @input="autoResize"
        ></textarea>
        <button class="send-btn" @click="sendMessage" :disabled="!isReady || thinking || (!userInput.trim() && !uploadedFile)">
          <Send :size="16" />
        </button>
      </div>
      <div style="display:flex;justify-content:center;margin-top:6px;">
        <span style="font-size:11px;color:#334155;">Elevex AI can read data, import files (CSV/Excel/Image/PDF) and CREATE/UPDATE records.</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { Send, Trash2, Database, Paperclip, X, FileText, ImageIcon, Bot, PlusCircle, Edit as EditIcon, Check } from 'lucide-vue-next'
import { getAll, create, update } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const authStore = useAuthStore()
const ui = useUIStore()
const chatAreaRef = ref(null)
const inputRef = ref(null)
const userInput = ref('')
const thinking = ref(false)
const messages = ref([])
const config = ref({ provider: 'anthropic', model: '', apiKey: '', baseUrl: '' })
const fileInputRef = ref(null)
const uploadedFile = ref(null) // { name, kind:'image'|'text', content?, dataUrl?, mimeType? }

const userInitials = computed(() => {
  const n = authStore.user?.fullName || authStore.user?.username || '?'
  return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})

const providerLabel = computed(() => ({
  anthropic: 'Claude',
  openai: 'GPT',
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  local: 'Local',
  'openai-compat': 'Custom',
}[config.value.provider] || 'AI'))

const isReady = computed(() => !!config.value.apiKey || config.value.provider === 'local')

const suggestions = [
  'Give me an overview of all active projects',
  'How many AMC contracts are active this month?',
  'List all pending complaints',
  'Show repair records for this week',
  'Create a task: Review AMC contracts for renewal',
]

onMounted(async () => {
  try {
    const docs = await getAll(Collections.CONFIGURATIONS)
    if (docs.length && docs[0].llm) {
      config.value = { ...config.value, ...docs[0].llm }
    }
  } catch (e) { /* ignore */ }
})

// ── Tool Definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'read_collection',
    description: 'Read all documents from a Firebase collection. Use this to get data.',
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: 'Collection name. Available: projects, amc, amcMonthlyMaintenance, installationActivities, modernisationActivities, repairActivities, complaintActivities, employees, users, tasks, invoices, quotations, purchaseOrders, proformaInvoices, taxInvoices, vendors, materials, bom, leaveRequests, maintenance',
        },
        limit: { type: 'number', description: 'Max records to return (default 50)' },
      },
      required: ['collection'],
    },
  },
  {
    name: 'create_document',
    description: 'Create a new document in a Firebase collection. Use for adding new records.',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Target collection name' },
        data: { type: 'object', description: 'Document data as a JSON object' },
      },
      required: ['collection', 'data'],
    },
  },
  {
    name: 'update_document',
    description: 'Update an existing document. IMPORTANT: The "id" parameter MUST be the Firestore document ID (the "id" field returned by read_collection or find_document), NOT the human-readable name. Always read_collection or find_document first to obtain the correct Firestore document ID before calling this tool.',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Target collection name' },
        id: { type: 'string', description: 'Firestore document ID (the "id" field from read_collection/find_document result, NOT the name/title)' },
        data: { type: 'object', description: 'Fields to update' },
      },
      required: ['collection', 'id', 'data'],
    },
  },
  {
    name: 'find_document',
    description: 'Search a collection for a document by matching a field value (e.g. find by projectName, clientName, etc.). Returns matching documents with their Firestore "id" field. Use this to resolve a human-readable name to a Firestore document ID before calling update_document.',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection to search in' },
        field: { type: 'string', description: 'Field name to search (e.g. "projectName", "clientName", "contractNumber")' },
        value: { type: 'string', description: 'Value to match (case-insensitive substring match)' },
      },
      required: ['collection', 'field', 'value'],
    },
  },
]

// ── AI Action Confirmation ─────────────────────────────────────────────────────
const pendingConfirm = ref(null)
let confirmResolver = null

function requestConfirmation(type, collection, data) {
  return new Promise(resolve => {
    confirmResolver = resolve
    pendingConfirm.value = { type, collection, data }
  })
}

function approveConfirm() {
  confirmResolver?.(true)
  pendingConfirm.value = null
  confirmResolver = null
}

function rejectConfirm() {
  confirmResolver?.(false)
  pendingConfirm.value = null
  confirmResolver = null
}

// ── Tool Execution ────────────────────────────────────────────────────────────
async function executeTool(name, args) {
  if (name === 'read_collection') {
    const items = await getAll(args.collection)
    const limited = args.limit ? items.slice(0, args.limit) : items.slice(0, 50)
    addMessage('tool_call', `Reading ${args.collection} (${limited.length} records)…`)
    return JSON.stringify(limited)
  }
  if (name === 'create_document') {
    const approved = await requestConfirmation('create', args.collection, args.data)
    if (!approved) {
      addMessage('tool_call', `Create in ${args.collection} — rejected by user`)
      return JSON.stringify({ cancelled: true, message: 'User rejected this create operation.' })
    }
    addMessage('tool_call', `Creating document in ${args.collection}…`)
    const doc = await create(args.collection, { ...args.data, createdAt: new Date().toISOString(), createdBy: authStore.user?.fullName || 'AI Assistant' })
    return JSON.stringify({ success: true, id: doc.id })
  }
  if (name === 'find_document') {
    addMessage('tool_call', `Searching ${args.collection} where ${args.field} ~ "${args.value}"…`)
    const all = await getAll(args.collection)
    const q = (args.value || '').toLowerCase()
    const matches = all.filter(d => {
      const v = d[args.field]
      return v && String(v).toLowerCase().includes(q)
    })
    if (!matches.length) return JSON.stringify({ found: false, message: `No documents in ${args.collection} where ${args.field} contains "${args.value}"` })
    return JSON.stringify({ found: true, count: matches.length, results: matches })
  }
  if (name === 'update_document') {
    // Guard: catch obvious mistakes where a name was passed instead of an ID
    const idLooksLikeAutoId = /^[A-Za-z0-9]{15,25}$/.test(args.id)
    if (!idLooksLikeAutoId) {
      return JSON.stringify({
        error: `"${args.id}" does not look like a Firestore document ID. You must use find_document first to get the real Firestore ID (the "id" field), then call update_document with that ID.`,
        hint: `Call find_document on collection="${args.collection}" to locate the correct document.`,
      })
    }
    const approved = await requestConfirmation('update', args.collection, { id: args.id, ...args.data })
    if (!approved) {
      addMessage('tool_call', `Update in ${args.collection} — rejected by user`)
      return JSON.stringify({ cancelled: true, message: 'User rejected this update operation.' })
    }
    addMessage('tool_call', `Updating document in ${args.collection}…`)
    await update(args.collection, args.id, { ...args.data, updatedAt: new Date().toISOString(), updatedBy: 'AI Assistant' })
    return JSON.stringify({ success: true })
  }
  return JSON.stringify({ error: 'Unknown tool' })
}

// ── LLM API Calls ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Elevex AI, an intelligent assistant for a Avant Elevators EMS (Elevator Management System).
You have access to tools to read, create, update, and search records in Firebase Firestore.

Available collections: projects, amc, amcMonthlyMaintenance, installationActivities, modernisationActivities, repairActivities, complaintActivities, employees, users, tasks, invoices, quotations, purchaseOrders, proformaInvoices, taxInvoices, vendors, materials, bom, leaveRequests, maintenance.

CRITICAL RULES FOR UPDATE:
1. Firestore documents have AUTO-GENERATED IDs (e.g. "xK9mP2qRtLzBv7nW") stored in the "id" field.
2. NEVER use a human-readable name (like "Hiranandani Gardens") as the document ID for update_document.
3. ALWAYS call find_document or read_collection FIRST to get the real Firestore "id" before calling update_document.
4. Workflow for any update: find_document → get "id" from result → update_document with that "id".

Other rules:
- You CAN read any collection to answer questions.
- You CAN create new records when instructed.
- You CAN update existing records using the correct Firestore document ID.
- You MUST NEVER delete any records.
- Confirm before making changes unless the user is explicit.
- Present data cleanly using markdown tables or bullet lists.
- Today's date is ${new Date().toLocaleDateString('en-IN')}.`

function buildAnthropicMessages(msgs) {
  return msgs.map(m => {
    if (m._vision) {
      const b64 = m._vision.dataUrl.split(',')[1]
      return { role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: m._vision.mimeType, data: b64 } },
        { type: 'text', text: m.content },
      ]}
    }
    return { role: m.role, content: m.content }
  })
}

async function callAnthropic(msgs) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.value.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.value.model || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: buildAnthropicMessages(msgs),
      tools: TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    }),
  })
  if (!res.ok) throw new Error((await res.json())?.error?.message || res.statusText)
  return await res.json()
}

function buildOpenAIMessages(msgs) {
  return msgs.map(m => {
    if (m._vision) {
      return { role: 'user', content: [
        { type: 'image_url', image_url: { url: m._vision.dataUrl } },
        { type: 'text', text: m.content },
      ]}
    }
    // Assistant message that triggered tool calls — must preserve tool_calls array
    if (m.role === 'assistant' && m.tool_calls) {
      return { role: 'assistant', content: m.content ?? null, tool_calls: m.tool_calls }
    }
    // Tool result message — must preserve tool_call_id or Groq/OpenAI reject it
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content }
    }
    return { role: m.role, content: m.content }
  })
}

async function callOpenAI(msgs, baseUrl, provider) {
  const url = (baseUrl || 'https://api.openai.com/v1') + '/chat/completions'
  const headers = {
    'content-type': 'application/json',
    'authorization': `Bearer ${config.value.apiKey}`,
  }
  // OpenRouter requires these headers for routing/tracking
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin
    headers['X-Title'] = 'Elevex AI — Avant Elevators EMS'
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.value.model || 'gpt-4o',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...buildOpenAIMessages(msgs)],
      tools: TOOLS.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: 'auto',
    }),
  })
  if (!res.ok) throw new Error((await res.json())?.error?.message || res.statusText)
  return await res.json()
}

async function callGemini(msgs) {
  const model = config.value.model || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.value.apiKey}`
  const contents = msgs.map(m => {
    const parts = []
    if (m._vision) {
      const b64 = m._vision.dataUrl.split(',')[1]
      parts.push({ inlineData: { mimeType: m._vision.mimeType, data: b64 } })
    }
    parts.push({ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })
    return { role: m.role === 'assistant' ? 'model' : 'user', parts }
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ function_declarations: TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
    }),
  })
  if (!res.ok) throw new Error((await res.json())?.error?.message || res.statusText)
  return await res.json()
}

// ── Main Send Logic with Tool Loop ────────────────────────────────────────────
async function runLLMWithTools(userMessages) {
  const provider = config.value.provider
  let loopMessages = [...userMessages]
  const MAX_ROUNDS = 5

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let raw

    if (provider === 'anthropic') {
      raw = await callAnthropic(loopMessages)
      // Check stop reason
      if (raw.stop_reason === 'tool_use') {
        const toolUses = raw.content.filter(b => b.type === 'tool_use')
        const toolResults = []
        for (const tu of toolUses) {
          const result = await executeTool(tu.name, tu.input)
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
        }
        loopMessages.push({ role: 'assistant', content: raw.content })
        loopMessages.push({ role: 'user', content: toolResults })
        continue
      }
      const text = raw.content?.find(b => b.type === 'text')?.text || ''
      return text

    } else if (provider === 'gemini') {
      raw = await callGemini(loopMessages)
      const part = raw.candidates?.[0]?.content?.parts?.[0]
      if (part?.functionCall) {
        const fc = part.functionCall
        const result = await executeTool(fc.name, fc.args || {})
        loopMessages.push({ role: 'model', content: JSON.stringify(part) })
        loopMessages.push({
          role: 'user',
          content: JSON.stringify([{ functionResponse: { name: fc.name, response: { result } } }]),
        })
        continue
      }
      return part?.text || ''

    } else {
      // OpenAI / Groq / OpenRouter / Grok / DeepSeek / Local / openai-compat
      const baseUrl = provider === 'groq'        ? 'https://api.groq.com/openai/v1'
        : provider === 'openrouter' ? 'https://openrouter.ai/api/v1'
        : provider === 'grok'       ? 'https://api.x.ai/v1'
        : provider === 'deepseek'   ? 'https://api.deepseek.com/v1'
        : provider === 'local'      ? (config.value.baseUrl || 'http://localhost:11434/v1')
        : config.value.baseUrl || ''
      raw = await callOpenAI(loopMessages, baseUrl, provider)
      const choice = raw.choices?.[0]
      if (choice?.finish_reason === 'tool_calls' || choice?.message?.tool_calls?.length) {
        const tcs = choice.message.tool_calls || []
        loopMessages.push({ role: 'assistant', content: null, tool_calls: tcs })
        for (const tc of tcs) {
          const result = await executeTool(tc.function.name, JSON.parse(tc.function.arguments || '{}'))
          loopMessages.push({ role: 'tool', tool_call_id: tc.id, content: result })
        }
        continue
      }
      return choice?.message?.content || ''
    }
  }
  return 'Reached max tool rounds. Please try a more specific question.'
}

// ── File Upload ───────────────────────────────────────────────────────────────
function readAsDataURL(file) {
  return new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsDataURL(file) })
}
function readAsArrayBuffer(file) {
  return new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsArrayBuffer(file) })
}
function readAsText(file) {
  return new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsText(file) })
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0]
  if (!file) return
  event.target.value = ''
  const MAX_CHARS = 30000
  if (file.type.startsWith('image/')) {
    const dataUrl = await readAsDataURL(file)
    uploadedFile.value = { name: file.name, kind: 'image', dataUrl, mimeType: file.type }
    return
  }
  let text = ''
  if (file.name.match(/\.xlsx?$/i)) {
    try {
      const XLSX = await import('xlsx')
      const buf = await readAsArrayBuffer(file)
      const wb = XLSX.read(buf, { type: 'array' })
      text = wb.SheetNames.map(n => `=== Sheet: ${n} ===\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n')
    } catch { text = '[Could not parse Excel file]' }
  } else {
    text = await readAsText(file)
  }
  uploadedFile.value = { name: file.name, kind: 'text', content: text.slice(0, MAX_CHARS) }
}

function removeFile() { uploadedFile.value = null }

// ── Chat Functions ────────────────────────────────────────────────────────────
let msgId = 0
function addMessage(role, content) {
  messages.value.push({ id: ++msgId, role, content, ts: Date.now() })
  nextTick(() => scrollToBottom())
}

async function sendMessage() {
  const text = userInput.value.trim()
  if (!text || thinking.value || !isReady.value) return
  userInput.value = ''
  resetInputHeight()

  // Include file content in the displayed message and API message
  const currentFile = uploadedFile.value
  uploadedFile.value = null
  let displayText = text
  let apiText = text
  if (currentFile?.kind === 'text') {
    displayText = `📎 ${currentFile.name}\n\n${text}`
    apiText = `[Attached file: ${currentFile.name}]\n\`\`\`\n${currentFile.content}\n\`\`\`\n\nUser question: ${text}`
  } else if (currentFile?.kind === 'image') {
    displayText = `🖼 ${currentFile.name}\n\n${text}`
  }

  addMessage('user', displayText)
  thinking.value = true

  try {
    const apiMessages = messages.value
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map((m, i, arr) => {
        // For the last user message, use the full API text (with file content)
        if (i === arr.length - 1 && m.role === 'user') {
          return { role: 'user', content: apiText, _vision: currentFile?.kind === 'image' ? currentFile : null }
        }
        return { role: m.role, content: m.content }
      })

    const reply = await runLLMWithTools(apiMessages)
    addMessage('assistant', reply)
  } catch (e) {
    const msg = (e.message || '').toLowerCase()
    const isQuota = msg.includes('quota') || msg.includes('rate limit') || msg.includes('rate_limit') ||
      msg.includes('overloaded') || msg.includes('529') || msg.includes('too many') ||
      msg.includes('limit exceeded') || msg.includes('insufficient_quota') || msg.includes('capacity')
    if (isQuota) {
      addMessage('assistant', '**You have reached your limit.** Please contact **Ambivare Solutions** for assistance.')
    } else {
      addMessage('assistant', `**Error:** ${e.message}\n\nPlease check your API key and provider settings in Configurations.`)
    }
  } finally {
    thinking.value = false
  }
}

function sendSuggestion(s) {
  userInput.value = s
  sendMessage()
}

function clearChat() {
  messages.value = []
}

function scrollToBottom() {
  if (chatAreaRef.value) chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight
}

function autoResize(e) {
  e.target.style.height = 'auto'
  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
}

function resetInputHeight() {
  if (inputRef.value) inputRef.value.style.height = 'auto'
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(99,102,241,0.15);padding:1px 5px;border-radius:3px;font-size:12px;">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:10px 0 4px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;font-weight:700;margin:12px 0 6px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:17px;font-weight:700;margin:12px 0 6px;">$1</h1>')
    .replace(/^\| (.+) \|$/gm, (_, row) => {
      if (row.match(/^[-| ]+$/)) return ''
      const cells = row.split(' | ').map(c => `<td style="padding:5px 10px;border:1px solid rgba(255,255,255,0.08);">${c}</td>`).join('')
      return `<tr>${cells}</tr>`
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, m => `<table style="width:100%;border-collapse:collapse;margin:8px 0;">${m}</table>`)
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;margin-bottom:2px;">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="margin:6px 0;">${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;margin-bottom:2px;">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin-top:8px;">')
    .replace(/\n/g, '<br>')
}
</script>

<style scoped>
/* ── Confirmation Dialog ────────────────────────────────────────────────────── */
.confirm-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.confirm-dialog {
  background: #0f1629;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 18px;
  width: 480px;
  max-width: calc(100vw - 40px);
  box-shadow: 0 24px 60px rgba(0,0,0,0.7);
  overflow: hidden;
}
.confirm-header {
  display: flex; align-items: center; gap: 14px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.confirm-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.confirm-icon.icon-create {
  background: rgba(34,197,94,0.15); color: #22c55e;
  border: 1px solid rgba(34,197,94,0.25);
}
.confirm-icon.icon-update {
  background: rgba(245,158,11,0.15); color: #f59e0b;
  border: 1px solid rgba(245,158,11,0.25);
}
.confirm-title { font-size: 15px; font-weight: 700; color: #f1f5f9; }
.confirm-sub { font-size: 12px; color: #94a3b8; margin-top: 3px; }
.confirm-sub strong { color: #818cf8; }
.confirm-body { padding: 16px 24px; }
.confirm-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; margin-bottom: 8px; }
.confirm-pre {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12px;
  color: #cbd5e1;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
  line-height: 1.6;
}
.confirm-actions {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 14px 24px 20px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.ai-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  max-height: calc(100vh - 64px);
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.ai-avatar-lg {
  width: 44px; height: 44px; border-radius: 14px;
  background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3));
  border: 1px solid rgba(99,102,241,0.3);
  display: flex; align-items: center; justify-content: center;
  color:var(--ct-accent);
}

.ai-title { font-size: 16px; font-weight: 700; color:var(--ct-primary); }
.ai-sub { font-size: 12px; color:var(--ct-muted); margin-top: 2px; }
.ai-sub.online { color:var(--ct-green); }
.ai-sub.online::before { content: '●'; margin-right: 5px; font-size: 8px; }

.chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(99,102,241,0.2) transparent;
}

.welcome-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  flex: 1;
  text-align: center;
}
.welcome-icon {
  width: 140px; height: 140px; border-radius: 32px;
  background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2));
  border: 1px solid rgba(99,102,241,0.25);
  display: flex; align-items: center; justify-content: center;
  color:var(--ct-accent); margin-bottom: 16px;
}
.welcome-title { font-size: 20px; font-weight: 700; color:var(--ct-primary); margin-bottom: 6px; }
.welcome-sub { font-size: 14px; color:var(--ct-muted); margin-bottom: 20px; }
.suggestion-grid {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 600px;
}
.suggestion-chip {
  padding: 8px 14px; border-radius: 20px;
  background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
  color:var(--ct-accent); font-size: 13px; cursor: pointer; transition: all 0.18s;
}
.suggestion-chip:hover { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.35); }

.msg-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  max-width: 85%;
}
.msg-user { align-self: flex-end; flex-direction: row-reverse; }
.msg-assistant { align-self: flex-start; }
.msg-tool { align-self: flex-start; }

.msg-bubble {
  padding: 12px 16px;
  border-radius: 16px;
  max-width: 100%;
  line-height: 1.6;
}
.msg-bubble-user {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.msg-bubble-assistant {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color:var(--ct-primary);
  border-bottom-left-radius: 4px;
}
.msg-text { font-size: 14px; word-break: break-word; }
.msg-time { font-size: 10px; opacity: 0.5; margin-top: 4px; }

.tool-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 12px; border-radius: 20px;
  background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2);
  color: #f59e0b; font-size: 11px;
}

.ai-avatar-sm {
  width: 28px; height: 28px; border-radius: 9px;
  background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3));
  border: 1px solid rgba(99,102,241,0.25);
  display: flex; align-items: center; justify-content: center;
  color:var(--ct-accent); flex-shrink: 0;
}
.user-avatar-sm {
  width: 28px; height: 28px; border-radius: 9px;
  background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.3);
  display: flex; align-items: center; justify-content: center;
  color:var(--ct-accent); font-size: 10px; font-weight: 700; flex-shrink: 0;
}

.typing-dots { display: flex; gap: 4px; padding: 4px 2px; }
.typing-dots span {
  width: 7px; height: 7px; border-radius: 50%;
  background: #6366f1; animation: bounce 1.2s infinite;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
  30% { transform: translateY(-6px); opacity: 1; }
}

.input-area {
  padding: 16px 24px;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 12px 16px;
  transition: all 0.2s;
}
.input-wrap:focus-within {
  border-color: rgba(99,102,241,0.4);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
}
.chat-input {
  flex: 1; background: transparent; border: none; outline: none;
  color:var(--ct-primary); font-size: 14px; line-height: 1.5; resize: none;
  min-height: 24px; max-height: 160px; font-family: inherit;
}
.chat-input::placeholder { color:var(--ct-muted); }
.chat-input:disabled { opacity: 0.5; }
.attach-btn {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  background: transparent; border: none; cursor: pointer;
  color:var(--ct-muted); display: flex; align-items: center; justify-content: center;
  transition: all 0.18s;
}
.attach-btn:hover:not(:disabled) { color:var(--ct-accent); background: rgba(99,102,241,0.1); }
.attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.send-btn {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none; cursor: pointer; color: #fff;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.18s;
}
.send-btn:hover:not(:disabled) { transform: scale(1.05); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.file-chip {
  display: inline-flex; align-items: center; gap: 6px;
  margin-bottom: 8px; padding: 5px 10px; border-radius: 20px;
  background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25);
  color:var(--ct-accent); font-size: 12px; max-width: 100%;
}
.file-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.file-chip-remove {
  background: none; border: none; cursor: pointer; color:var(--ct-accent);
  display: flex; align-items: center; padding: 0; opacity: 0.7;
}
.file-chip-remove:hover { opacity: 1; }

/* Light theme */
[data-theme="light"] .ai-header { border-bottom-color: rgba(0,0,0,0.08); }
[data-theme="light"] .ai-title { color: #1e293b; }
[data-theme="light"] .chat-area { background: #f1f5f9; }
[data-theme="light"] .msg-bubble-assistant {
  background: #fff;
  border-color: rgba(0,0,0,0.08);
  color: #1e293b;
}
[data-theme="light"] .input-area { border-top-color: rgba(0,0,0,0.08); }
[data-theme="light"] .input-wrap {
  background: #fff;
  border-color: rgba(0,0,0,0.12);
}
[data-theme="light"] .chat-input { color: #1e293b; }
[data-theme="light"] .suggestion-chip { color: #4f46e5; }
</style>
