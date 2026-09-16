<template>
  <div class="config-view">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Settings2 :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Configurations
        </h1>
        <p class="page-sub">Fine-tune Avant to work exactly your way.</p>
      </div>
      <button class="btn-primary" @click="saveAll" :disabled="saving">
        <Loader2 v-if="saving" :size="14" style="animation:spin 1s linear infinite;" />
        <Save v-else :size="14" />
        {{ saving ? 'Saving…' : 'Save All' }}
      </button>
    </div>

    <!-- Tabs -->
    <div class="config-tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="config-tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        <component :is="t.icon" :size="15" />
        {{ t.label }}
      </button>
    </div>

    <!-- ── LLM Settings ── -->
    <div v-if="activeTab === 'llm'" class="config-section">
      <div class="section-header">
        <Bot :size="18" />
        <div>
          <div class="section-title">AI / LLM Settings</div>
          <div class="section-sub">Configure the AI provider used in the AI Assistant</div>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="label">AI Provider</label>
          <select v-model="config.llm.provider" class="input" @change="onProviderChange">
            <option v-for="p in llmProviders" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Model</label>
          <select v-model="config.llm.model" class="input">
            <option v-for="m in availableModels" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="label">API Key</label>
          <div style="position:relative;">
            <input
              v-model="config.llm.apiKey"
              :type="showApiKey ? 'text' : 'password'"
              class="input"
              placeholder="Enter your API key…"
              style="padding-right:44px;"
            />
            <button type="button" @click="showApiKey = !showApiKey" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--ct-muted);">
              <Eye v-if="!showApiKey" :size="16" />
              <EyeOff v-else :size="16" />
            </button>
          </div>
        </div>
        <div v-if="config.llm.provider === 'local' || config.llm.provider === 'openai-compat'" class="form-group form-full">
          <label class="label">Base URL</label>
          <input v-model="config.llm.baseUrl" class="input" placeholder="http://localhost:11434/v1" />
        </div>

        <!-- Groq info card -->
        <div v-if="config.llm.provider === 'groq'" class="form-group form-full">
          <div class="provider-info-card provider-groq">
            <div style="font-size:13px;font-weight:700;margin-bottom:6px;">⚡ Groq — Ultra-fast LPU Inference</div>
            <div style="font-size:12px;line-height:1.75;color:var(--ct-sub);">
              Groq runs open-source models (Llama, Mixtral, Gemma) at extremely high token speeds with very low latency.
              Free tier available with generous rate limits.<br/>
              <span style="color:var(--ct-muted);">API Base:</span> <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:var(--ct-accent);">https://api.groq.com/openai/v1</code><br/>
              Get your API key at <strong style="color:var(--ct-accent);">console.groq.com</strong> — supports CORS for browser access.
            </div>
          </div>
        </div>

        <!-- OpenRouter info card -->
        <div v-if="config.llm.provider === 'openrouter'" class="form-group form-full">
          <div class="provider-info-card provider-openrouter">
            <div style="font-size:13px;font-weight:700;margin-bottom:6px;">🌐 OpenRouter — One Key, Every Model</div>
            <div style="font-size:12px;line-height:1.75;color:var(--ct-sub);">
              Access 200+ models from Anthropic, Google, OpenAI, Meta, Mistral, and more via a single unified OpenAI-compatible API.
              Many models are <strong style="color:#22c55e;">free</strong> — look for <code style="background:rgba(34,197,94,0.1);padding:1px 6px;border-radius:4px;color:#22c55e;">:free</code> suffix models.<br/>
              <span style="color:var(--ct-muted);">API Base:</span> <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:var(--ct-accent);">https://openrouter.ai/api/v1</code><br/>
              Get your API key at <strong style="color:var(--ct-accent);">openrouter.ai/keys</strong> — supports CORS for browser access.
            </div>
          </div>
        </div>

        <div class="form-group form-full">
          <div style="padding:14px 16px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;font-size:13px;color:var(--ct-sub);line-height:1.7;">
            <span style="color:#f59e0b;font-weight:600;">Note:</span>
            Browser-side API calls may be blocked by CORS for some providers (e.g. Anthropic).
            For Anthropic/OpenAI, consider a lightweight CORS proxy or use providers that support browser access:
            <strong>Groq, OpenRouter, Gemini, Grok, Local/Ollama</strong>.
          </div>
        </div>
      </div>
    </div>

    <!-- ── Company Details ── -->
    <div v-if="activeTab === 'company'" class="config-section">
      <div class="section-header">
        <Building2 :size="18" />
        <div>
          <div class="section-title">Company Details</div>
          <div class="section-sub">Used in all PDFs, receipts, and documents</div>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group form-full">
          <label class="label">Company Name</label>
          <input v-model="config.company.name" class="input" placeholder="Avant Elevators Pvt. Ltd." />
        </div>
        <div class="form-group">
          <label class="label">Tagline <span style="font-weight:400;color:var(--ct-muted);">(optional)</span></label>
          <input v-model="config.company.tagline" class="input" placeholder="e.g. Quality Elevators for Every Need" />
        </div>
        <div class="form-group">
          <label class="label">CIN <span style="font-weight:400;color:var(--ct-muted);">(optional)</span></label>
          <input v-model="config.company.cin" class="input" placeholder="e.g. U45209MH2010PTC123456" />
        </div>
        <div class="form-group">
          <label class="label">Logo URL</label>
          <input v-model="config.company.logoUrl" class="input" placeholder="https://…/logo.png" />
        </div>
        <div class="form-group">
          <label class="label">Header Image URL <span style="font-weight:400;color:var(--ct-muted);">(used in contract PDFs)</span></label>
          <input v-model="config.company.headerUrl" class="input" placeholder="https://…/header.jpg" />
          <div v-if="config.company.headerUrl" style="margin-top:8px;">
            <img :src="config.company.headerUrl" style="max-height:40px;width:100%;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.1);" onerror="this.style.display='none'" />
          </div>
        </div>
        <div class="form-group">
          <label class="label">Upload Logo</label>
          <label class="btn-secondary btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <Upload :size="13" /> Browse Image
            <input type="file" accept="image/*" style="display:none;" @change="uploadLogo" />
          </label>
          <div v-if="config.company.logoUrl" style="margin-top:8px;">
            <img :src="config.company.logoUrl" style="max-height:48px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);" onerror="this.style.display='none'" />
          </div>
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input v-model="config.company.email" class="input" type="email" placeholder="info@company.com" />
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="config.company.phone" class="input" placeholder="+91 98765 43210" />
        </div>
        <div class="form-group">
          <label class="label">Plot / Door No. <span style="font-weight:400;color:var(--ct-muted);">(optional)</span></label>
          <input v-model="config.company.plotNo" class="input" placeholder="e.g. Plot 12, Door No. 4A" />
        </div>
        <div class="form-group">
          <label class="label">Sector / Area <span style="font-weight:400;color:var(--ct-muted);">(optional)</span></label>
          <input v-model="config.company.sector" class="input" placeholder="e.g. Sector 15, Andheri West" />
        </div>
        <div class="form-group form-full">
          <label class="label">Address</label>
          <textarea v-model="config.company.address" class="input" rows="2" placeholder="Full company address…" style="resize:vertical;"></textarea>
        </div>
        <div class="form-group form-full">
          <label class="label">Registered Address <span style="font-weight:400;color:var(--ct-muted);">(if different from above — used in Tax Invoice)</span></label>
          <textarea v-model="config.company.regAddress" class="input" rows="2" placeholder="Registered office address…" style="resize:vertical;"></textarea>
        </div>
        <div class="form-group">
          <label class="label">City</label>
          <input v-model="config.company.city" class="input" placeholder="Mumbai" />
        </div>
        <div class="form-group">
          <label class="label">State</label>
          <input v-model="config.company.state" class="input" placeholder="Maharashtra" />
        </div>
        <div class="form-group">
          <label class="label">PIN Code</label>
          <input v-model="config.company.pincode" class="input" placeholder="400001" />
        </div>
        <div class="form-group">
          <label class="label">GST Number</label>
          <input v-model="config.company.gst" class="input" placeholder="27ABCDE1234F1Z5" />
        </div>
        <div class="form-group">
          <label class="label">PAN Number</label>
          <input v-model="config.company.pan" class="input" placeholder="ABCDE1234F" />
        </div>
        <div class="form-group">
          <label class="label">Bank Name</label>
          <input v-model="config.company.bankName" class="input" placeholder="HDFC Bank" />
        </div>
        <div class="form-group">
          <label class="label">Bank Branch</label>
          <input v-model="config.company.bankBranch" class="input" placeholder="e.g. Navi Mumbai" />
        </div>
        <div class="form-group">
          <label class="label">Account Number</label>
          <input v-model="config.company.accountNo" class="input" placeholder="1234567890" />
        </div>
        <div class="form-group">
          <label class="label">IFSC Code</label>
          <input v-model="config.company.ifsc" class="input" placeholder="HDFC0001234" />
        </div>
        <div class="form-group">
          <label class="label">Website</label>
          <input v-model="config.company.website" class="input" placeholder="https://www.company.com" />
        </div>
      </div>
    </div>

    <!-- ── Billing Templates ── -->
    <div v-if="activeTab === 'templates'" class="config-section">
      <div class="section-header">
        <FileText :size="18" />
        <div>
          <div class="section-title">HTML Billing Templates</div>
          <div class="section-sub">A4-sized HTML templates rendered via window.print() — fully serverless</div>
        </div>
      </div>

      <!-- Template sub-tabs -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">
        <button
          v-for="t in templateTypes"
          :key="t.key"
          class="template-tab"
          :class="{ active: activeTemplate === t.key }"
          @click="activeTemplate = t.key"
        >{{ t.label }}</button>
      </div>

      <!-- Single editor — activeTemplate controls which key is shown/edited -->
      <div>
        <div style="display:flex;gap:10px;margin-bottom:10px;align-items:center;">
          <span style="font-size:13px;font-weight:600;color:var(--ct-primary);">{{ activeTemplateLabel }} Template</span>
          <button class="btn-secondary btn-sm" @click="loadDefaultTemplate(activeTemplate)">Load Default</button>
          <button class="btn-secondary btn-sm" @click="previewTemplate(activeTemplate)">
            <Eye :size="12" /> Preview
          </button>
        </div>
        <div style="font-size:12px;color:var(--ct-muted);margin-bottom:8px;">
          Available placeholders:
          <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:var(--ct-accent);">&#123;&#123;company.name&#125;&#125;</code>
          <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:var(--ct-accent);">&#123;&#123;document.number&#125;&#125;</code>
          <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:var(--ct-accent);">&#123;&#123;items&#125;&#125;</code>
          <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:var(--ct-accent);">&#123;&#123;total&#125;&#125;</code>
          <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:var(--ct-accent);">&#123;&#123;client.name&#125;&#125;</code>
          etc.
        </div>
        <textarea
          :key="activeTemplate"
          v-model="activeTemplateContent"
          class="input template-editor"
          rows="20"
          :placeholder="`Enter HTML template for ${activeTemplateLabel}…`"
          style="font-family:monospace;font-size:12px;resize:vertical;"
        ></textarea>
      </div>

      <!-- PDF Method Note -->
      <div style="margin-top:20px;padding:16px 18px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:12px;">
        <div style="font-size:13px;font-weight:600;color:var(--ct-accent);margin-bottom:8px;">How PDF Download Works</div>
        <div style="font-size:13px;color:var(--ct-sub);line-height:1.7;">
          The app replaces template placeholders with actual data, opens the rendered HTML in a new window, and triggers <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:var(--ct-accent);">window.print()</code>.
          The browser's built-in "Save as PDF" option generates perfect A4 PDFs with zero server dependencies — fully serverless, real-time, and zero extra libraries.
        </div>
      </div>
    </div>
  </div>

  <!-- Preview Modal -->
  <div v-if="showPreview" style="position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;" @click.self="showPreview = false">
    <div style="background:#fff;width:90vw;max-width:820px;height:90vh;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#1e293b;color:var(--ct-primary);">
        <span style="font-size:14px;font-weight:600;">Template Preview</span>
        <button @click="showPreview = false" style="background:none;border:none;color:var(--ct-sub);font-size:20px;cursor:pointer;">×</button>
      </div>
      <iframe ref="previewFrame" style="flex:1;width:100%;border:none;" srcdoc=""></iframe>
    </div>
  </div>

  <!-- ── Email Settings ── -->
  <div v-if="activeTab === 'email'" class="config-section">
    <div class="section-header">
      <MailIcon :size="18" />
      <div>
        <div class="section-title">Email Settings</div>
        <div class="section-sub">Configure SMTP credentials. Emails are sent through AWS Lambda Universal Mailer (ap-south-1).</div>
      </div>
    </div>

    <!-- Lambda info badge -->
    <div style="margin-bottom:20px;padding:12px 16px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;font-size:12px;color:var(--ct-sub);line-height:1.75;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <div style="width:8px;height:8px;background:#4ade80;border-radius:50%;flex-shrink:0;box-shadow:0 0 6px #4ade80;"></div>
        <strong style="color:var(--ct-accent);">AWS Lambda Universal Mailer — auto host &amp; port discovery</strong>
      </div>
      No host or port needed. The mailer automatically tries every host and port for your provider until one succeeds —
      including regional variants like <code style="background:rgba(99,102,241,0.15);padding:1px 5px;border-radius:4px;color:#a78bfa;">smtp.zoho.in</code> (India),
      <code style="background:rgba(99,102,241,0.15);padding:1px 5px;border-radius:4px;color:#a78bfa;">smtp.zoho.eu</code>, ports 587, 465, 25 — in the best order for your region.
    </div>

    <!-- SMTP fields -->
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="label">SMTP Provider</label>
        <select v-model="emailConfig.smtpProvider" class="input">
          <option v-for="p in SMTP_PROVIDERS" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="label">From Name</label>
        <input v-model="emailConfig.fromName" class="input" placeholder="Avant Elevators" />
      </div>
      <div class="form-group">
        <label class="label">Email / Username</label>
        <input v-model="emailConfig.smtpUser" class="input" type="email" placeholder="your@zoho.in" />
        <div style="margin-top:4px;">
          <input v-model="emailConfig.fromEmail" class="input" type="email" placeholder="From email (if different from username)" style="margin-top:6px;" />
          <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">From email shown to recipients (leave blank to use username)</div>
        </div>
      </div>
      <div class="form-group">
        <label class="label">Password / App Password</label>
        <div style="position:relative;">
          <input
            v-model="emailConfig.smtpPass"
            :type="showSmtpPass ? 'text' : 'password'"
            class="input"
            placeholder="App password or SMTP password"
            style="padding-right:44px;"
          />
          <button type="button" @click="showSmtpPass = !showSmtpPass" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--ct-muted);">
            <Eye v-if="!showSmtpPass" :size="16" /><EyeOff v-else :size="16" />
          </button>
        </div>
      </div>
      <!-- Provider-specific hints -->
      <div v-if="emailConfig.smtpProvider === 'gmail'" class="form-group form-full">
        <div class="provider-info-card provider-groq">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px;">Gmail Setup</div>
          <div style="font-size:12px;line-height:1.9;color:var(--ct-sub);">
            1. Enable 2-Step Verification on your Google account<br>
            2. Go to <strong style="color:var(--ct-accent);">myaccount.google.com → Security → App Passwords</strong><br>
            3. Generate an App Password for "Mail" and paste it above — your regular password will not work
          </div>
        </div>
      </div>
      <div v-if="emailConfig.smtpProvider === 'zoho'" class="form-group form-full">
        <div class="provider-info-card provider-groq">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px;">Zoho Mail Setup</div>
          <div style="font-size:12px;line-height:1.9;color:var(--ct-sub);">
            The mailer auto-tries <strong>smtp.zoho.in → smtp.zoho.com → smtp.zoho.eu</strong> across ports 587 and 465.<br>
            1. Go to <strong style="color:var(--ct-accent);">accounts.zoho.in → Security → App Passwords</strong><br>
            2. Generate an App-Specific Password and paste it above
          </div>
        </div>
      </div>
    </div>

    <!-- Validate button -->
    <div style="margin-top:16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <button
        class="btn-secondary"
        @click="validateEmailConfig"
        :disabled="emailValidating"
        style="display:inline-flex;align-items:center;gap:6px;"
      >
        <Loader2 v-if="emailValidating" :size="14" style="animation:spin 1s linear infinite;" />
        <span v-else>Test Connection</span>
        {{ emailValidating ? 'Verifying…' : '' }}
      </button>
      <div v-if="emailValidateResult" style="flex-basis:100%;margin-top:8px;">
        <div style="display:flex;align-items:flex-start;gap:6px;font-size:13px;" :style="emailValidateResult.ok ? 'color:#4ade80;' : 'color:#f87171;'">
          <CheckCircle v-if="emailValidateResult.ok" :size="15" style="flex-shrink:0;margin-top:1px;" />
          <XCircle v-else :size="15" style="flex-shrink:0;margin-top:1px;" />
          <span>{{ emailValidateResult.message }}</span>
        </div>
        <div v-if="!emailValidateResult.ok && (emailValidateResult.message?.includes('535') || emailValidateResult.message?.includes('AUTH_FAILED') || emailValidateResult.message?.toLowerCase().includes('auth'))" style="margin-top:8px;padding:10px 14px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;font-size:12px;color:#fbbf24;line-height:1.7;">
          <strong>Authentication failed.</strong> Common fixes:<br>
          • <strong>Gmail:</strong> Use an App Password (myaccount.google.com → Security → App Passwords)<br>
          • <strong>Zoho:</strong> Generate an App-Specific Password in Zoho account settings<br>
          • <strong>Outlook/Office365:</strong> Enable SMTP AUTH in the admin centre<br>
          Your regular account password will not work — always use an App Password.
        </div>
      </div>
    </div>

    <!-- Email template -->
    <div style="margin-top:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--ct-primary);">Email Body Template</div>
          <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">HTML template rendered when sending billing documents by email</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-secondary btn-sm" @click="emailConfig.template = DEFAULT_EMAIL_TEMPLATE">Load Default</button>
          <button class="btn-secondary btn-sm" @click="previewEmailTemplate"><Eye :size="12" /> Preview</button>
        </div>
      </div>
      <div v-pre style="margin-bottom:10px;font-size:12px;color:var(--ct-muted);line-height:1.75;">
        Available placeholders:
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{client.name}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{client.email}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{doc.number}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{doc.date}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{doc.total}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{company.name}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{company.phone}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{company.email}}</code>
      </div>
      <textarea
        v-model="emailConfig.template"
        class="input template-editor"
        rows="18"
        placeholder="Enter HTML email template…"
        style="font-family:monospace;font-size:12px;resize:vertical;"
      ></textarea>
    </div>

    <!-- AMC Contract email template -->
    <div style="margin-top:28px;border-top:1px solid var(--ct-border,rgba(255,255,255,0.08));padding-top:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--ct-primary);">AMC Contract Email Template</div>
          <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">HTML template used when emailing AMC contracts to clients — set by developer, not editable from the app UI</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-secondary btn-sm" @click="emailConfig.amcTemplate = DEFAULT_AMC_EMAIL_TEMPLATE">Load Default</button>
          <button class="btn-secondary btn-sm" @click="previewAmcEmailTemplate"><Eye :size="12" /> Preview</button>
        </div>
      </div>
      <div v-pre style="margin-bottom:10px;font-size:12px;color:var(--ct-muted);line-height:1.75;">
        Available placeholders:
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{client.name}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{client.email}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{contract.number}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{contract.startDate}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{contract.endDate}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{contract.value}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{contract.duration}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{contract.type}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{company.name}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{company.phone}}</code>
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#818cf8;">{{company.email}}</code>
      </div>
      <textarea
        v-model="emailConfig.amcTemplate"
        class="input template-editor"
        rows="18"
        placeholder="Enter AMC contract email HTML template…"
        style="font-family:monospace;font-size:12px;resize:vertical;"
      ></textarea>
    </div>
  </div>

  <!-- AMC Email Template Preview Modal -->
  <div v-if="showAmcEmailPreview" style="position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;" @click.self="showAmcEmailPreview = false">
    <div style="background:#fff;width:90vw;max-width:680px;height:90vh;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#1e293b;color:var(--ct-primary);">
        <span style="font-size:14px;font-weight:600;">AMC Contract Email Template Preview</span>
        <button @click="showAmcEmailPreview = false" style="background:none;border:none;color:var(--ct-sub);font-size:20px;cursor:pointer;">×</button>
      </div>
      <iframe ref="amcEmailPreviewFrame" style="flex:1;width:100%;border:none;" srcdoc=""></iframe>
    </div>
  </div>

  <!-- Email Template Preview Modal -->
  <div v-if="showEmailPreview" style="position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;" @click.self="showEmailPreview = false">
    <div style="background:#fff;width:90vw;max-width:680px;height:90vh;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#1e293b;color:var(--ct-primary);">
        <span style="font-size:14px;font-weight:600;">Email Template Preview</span>
        <button @click="showEmailPreview = false" style="background:none;border:none;color:var(--ct-sub);font-size:20px;cursor:pointer;">×</button>
      </div>
      <iframe ref="emailPreviewFrame" style="flex:1;width:100%;border:none;" srcdoc=""></iframe>
    </div>
  </div>

  <!-- ── Maps Settings ── -->
  <div v-if="activeTab === 'maps'" class="config-section">
    <div class="section-header">
      <MapIcon :size="18" />
      <div>
        <div class="section-title">Map Settings</div>
        <div class="section-sub">Configure the map provider used in Live Tracking. Save and reopen the Tracking tab to apply.</div>
      </div>
    </div>

    <!-- Provider toggle -->
    <div class="form-group form-full" style="margin-bottom:20px;">
      <label class="label">Map Provider</label>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
        <button
          v-for="p in mapProviders"
          :key="p.value"
          class="map-provider-btn"
          :class="{ active: config.maps.provider === p.value }"
          @click="config.maps.provider = p.value"
        >
          <span style="font-size:18px;">{{ p.emoji }}</span>
          <div>
            <div style="font-size:13px;font-weight:600;">{{ p.label }}</div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.desc }}</div>
          </div>
        </button>
      </div>
    </div>

    <!-- OpenStreetMap — no key -->
    <div v-if="config.maps.provider === 'openstreetmap'" class="provider-info-card provider-groq">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px;">🗺 OpenStreetMap — Completely Free</div>
      <div style="font-size:12px;line-height:1.75;color:var(--ct-sub);">
        No API key required. Tiles served by openstreetmap.org. Dark appearance achieved via CSS
        <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:var(--ct-accent);">invert + hue-rotate</code> filter.
        Best for development or low-volume apps.
      </div>
    </div>

    <!-- Google Maps -->
    <template v-if="config.maps.provider === 'google'">
      <div class="form-grid">
        <div class="form-group form-full">
          <label class="label">Google Maps API Key</label>
          <div style="position:relative;">
            <input
              v-model="config.maps.googleMapsApiKey"
              :type="showGoogleKey ? 'text' : 'password'"
              class="input"
              placeholder="AIzaSy…"
              style="padding-right:44px;"
            />
            <button type="button" @click="showGoogleKey = !showGoogleKey" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--ct-muted);">
              <Eye v-if="!showGoogleKey" :size="16" /><EyeOff v-else :size="16" />
            </button>
          </div>
        </div>
      </div>
      <div class="provider-info-card" style="background:rgba(66,133,244,0.06);border-color:rgba(66,133,244,0.25);">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">🌍 Google Maps Setup</div>
        <div style="font-size:12px;line-height:1.9;color:var(--ct-sub);">
          1. Go to <strong style="color:var(--ct-accent);">console.cloud.google.com</strong><br>
          2. Create a project → APIs &amp; Services → Enable <strong>Maps JavaScript API</strong><br>
          3. Credentials → Create API Key → paste it above<br>
          4. <span style="color:#f59e0b;">Restrict the key</span> to your domain for security<br>
          Free credit: $200/month (~28,000 map loads). Supports satellite, Street View, native dark style.
        </div>
      </div>
    </template>

    <!-- Mapbox -->
    <template v-if="config.maps.provider === 'mapbox'">
      <div class="form-grid">
        <div class="form-group form-full">
          <label class="label">Mapbox Access Token</label>
          <div style="position:relative;">
            <input
              v-model="config.maps.mapboxToken"
              :type="showMapboxKey ? 'text' : 'password'"
              class="input"
              placeholder="pk.eyJ1…"
              style="padding-right:44px;"
            />
            <button type="button" @click="showMapboxKey = !showMapboxKey" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--ct-muted);">
              <Eye v-if="!showMapboxKey" :size="16" /><EyeOff v-else :size="16" />
            </button>
          </div>
        </div>
      </div>
      <div class="provider-info-card" style="background:rgba(0,0,0,0.15);border-color:rgba(255,255,255,0.12);">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">🗺 Mapbox Setup</div>
        <div style="font-size:12px;line-height:1.9;color:var(--ct-sub);">
          1. Sign up at <strong style="color:var(--ct-accent);">account.mapbox.com</strong><br>
          2. Your default public token is on the dashboard, or create a new one<br>
          3. Paste the token (starts with <code style="background:rgba(99,102,241,0.12);padding:1px 5px;border-radius:4px;color:var(--ct-accent);">pk.</code>) above<br>
          Free tier: <strong style="color:#22c55e;">50,000 map loads/month</strong>. Uses native <code style="background:rgba(99,102,241,0.12);padding:1px 5px;border-radius:4px;color:var(--ct-accent);">dark-v11</code> style — no CSS filter hack.
        </div>
      </div>
    </template>

    <!-- HERE Maps -->
    <template v-if="config.maps.provider === 'here'">
      <div class="form-grid">
        <div class="form-group form-full">
          <label class="label">HERE Maps API Key</label>
          <div style="position:relative;">
            <input
              v-model="config.maps.hereApiKey"
              :type="showHereKey ? 'text' : 'password'"
              class="input"
              placeholder="HERE API key…"
              style="padding-right:44px;"
            />
            <button type="button" @click="showHereKey = !showHereKey" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--ct-muted);">
              <Eye v-if="!showHereKey" :size="16" /><EyeOff v-else :size="16" />
            </button>
          </div>
        </div>
      </div>
      <div class="provider-info-card" style="background:rgba(0,175,189,0.06);border-color:rgba(0,175,189,0.25);">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">📡 HERE Maps Setup</div>
        <div style="font-size:12px;line-height:1.9;color:var(--ct-sub);">
          1. Sign up at <strong style="color:var(--ct-accent);">developer.here.com</strong><br>
          2. Create a project → Generate REST API Key<br>
          3. Paste the key above<br>
          Free tier: <strong style="color:#22c55e;">250,000 transactions/month</strong>. Known for accurate India maps.
          Uses Leaflet with HERE night tile endpoints.
        </div>
      </div>
    </template>
  </div>

  <!-- ── CONTRACT FORMAT TAB ── -->
  <div v-if="activeTab === 'contract-format'" class="config-section">
    <div class="section-header">
      <FileCode :size="18" />
      <div>
        <div class="section-title">AMC Contract Format</div>
        <div class="section-sub">Paste your HTML contract template here. The following placeholders will be replaced when generating a contract PDF.</div>
      </div>
    </div>
    <div style="margin-bottom:14px;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:10px;font-size:12px;color:var(--ct-muted);line-height:1.7;">
      <strong style="color:var(--ct-accent);">Available placeholders:</strong><br>
      <code>{{LETTER_DATE}}</code> · <code>{{CLIENT_NAME}}</code> · <code>{{CLIENT_ADDRESS}}</code> · <code>{{CONTACT_PERSON}}</code> · <code>{{CONTACT_PHONE}}</code><br>
      <code>{{LIFT_MAKE}}</code> · <code>{{LIFT_DOOR_TYPE}}</code> · <code>{{LIFT_TYPOLOGY}}</code> · <code>{{LIFT_LOAD}}</code> · <code>{{LIFT_HEIGHT}}</code> · <code>{{NUM_LIFTS}}</code><br>
      <code>{{OFFER_NON_COMP}}</code> · <code>{{OFFER_DISCOUNT}}</code> · <code>{{OFFER_FINAL}}</code> · <code>{{PAYMENT_TERMS}}</code> · <code>{{DURATION}}</code><br>
      For conditional discount row: wrap the discount &lt;tr&gt; with <code>&lt;!-- DISCOUNT_ROW_START --&gt;</code> and <code>&lt;!-- DISCOUNT_ROW_END --&gt;</code>
    </div>
    <textarea
      v-model="config.contractHtml"
      class="input"
      style="width:100%;height:500px;font-family:monospace;font-size:12px;resize:vertical;"
      placeholder="Paste your full HTML contract template here…"
    ></textarea>
  </div>

  <!-- ── AMC RENEWAL FORMAT TAB ── -->
  <div v-if="activeTab === 'renewal-format'" class="config-section">
    <div class="section-header">
      <FileCode :size="18" />
      <div>
        <div class="section-title">AMC Renewal Format</div>
        <div class="section-sub">Paste your HTML renewal letter template here. The following placeholders will be replaced when generating a renewal PDF.</div>
      </div>
    </div>
    <div style="margin-bottom:14px;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:10px;font-size:12px;color:var(--ct-muted);line-height:1.7;">
      <strong style="color:var(--ct-accent);">Cover letter placeholders:</strong><br>
      <code>{{LETTER_DATE}}</code> · <code>{{CLIENT_NAME}}</code> · <code>{{CLIENT_ADDRESS}}</code> · <code>{{CONTACT_PERSON}}</code> · <code>{{CONTRACT_NO}}</code><br>
      <code>{{RENEWAL_START}}</code> · <code>{{RENEWAL_END}}</code> · <code>{{PREV_AMOUNT}}</code> · <code>{{YEARS_MAINTAINED}}</code> · <code>{{INCREASE_PCT}}</code> · <code>{{NEW_AMOUNT}}</code> · <code>{{AUTHORIZED_SIGNATORY}}</code><br>
      <strong style="color:var(--ct-accent);">Contract body placeholders:</strong><br>
      <code>{{LIFT_MAKE}}</code> · <code>{{LIFT_DOOR_TYPE}}</code> · <code>{{LIFT_TYPOLOGY}}</code> · <code>{{LIFT_LOAD}}</code> · <code>{{LIFT_HEIGHT}}</code> · <code>{{NUM_LIFTS}}</code><br>
      <code>{{CONTRACT_TYPE}}</code> · <code>{{RATE_PER_LIFT}}</code> · <code>{{COMMENCEMENT_DATE}}</code> · <code>{{BILLING_CYCLE}}</code> · <code>{{TOTAL_AMOUNT}}</code> · <code>{{PAYMENT_TERMS}}</code><br>
      For conditional discount row: wrap the discount &lt;tr&gt; with <code>&lt;!-- DISCOUNT_ROW_START --&gt;</code> and <code>&lt;!-- DISCOUNT_ROW_END --&gt;</code>
    </div>
    <textarea
      v-model="config.amcRenewalHtml"
      class="input"
      style="width:100%;height:500px;font-family:monospace;font-size:12px;resize:vertical;"
      placeholder="Paste your full HTML AMC renewal template here…"
    ></textarea>
  </div>

  <!-- ── Tracking Roles ── -->
  <div v-if="activeTab === 'tracking-roles'" class="config-section">
    <div class="section-header">
      <MapPin :size="18" />
      <div>
        <div class="section-title">Tracking Role Access</div>
        <div class="section-sub">Control which roles can see and use the Tracking tab. Technicians get the location-sharing view; all other enabled roles see the admin overview panel.</div>
      </div>
    </div>
    <div class="navtabs-grid">
      <div v-for="(_, roleKey) in config.trackingRoles" :key="roleKey" class="navtab-row">
        <span class="navtab-label">{{ ROLES[roleKey]?.label || roleKey }}</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="config.trackingRoles[roleKey]" />
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
        </label>
        <span class="toggle-state" :style="config.trackingRoles[roleKey] ? 'color:#22c55e' : 'color:#ef4444'">
          {{ config.trackingRoles[roleKey] ? 'Enabled' : 'Disabled' }}
        </span>
      </div>
    </div>
  </div>

  <!-- ── All Photos (employee attendance selfies) ── -->
  <div v-if="activeTab === 'employee-photos'" class="config-section">
    <div class="section-header">
      <Images :size="18" />
      <div>
        <div class="section-title">All Photos</div>
        <div class="section-sub">Attendance selfies grouped by employee. Delete or download individual photos.</div>
      </div>
    </div>

    <div v-if="photosLoading" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
      <Loader2 :size="18" style="animation:spin 1s linear infinite;display:inline-block;" /> Loading photos…
    </div>

    <template v-else-if="!selectedPhotoEmployee">
      <div v-if="!employeePhotoFolders.length" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
        No attendance photos found.
      </div>
      <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;">
        <div
          v-for="folder in employeePhotoFolders"
          :key="folder.employeeId"
          class="glass"
          style="padding:18px;border-radius:12px;cursor:pointer;text-align:center;transition:border-color .15s;"
          @click="selectedPhotoEmployee = folder"
        >
          <Folder :size="32" style="color:var(--ct-accent);margin-bottom:8px;" />
          <div style="font-size:13px;font-weight:600;color:var(--ct-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ folder.employeeName }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ folder.photos.length }} photo{{ folder.photos.length === 1 ? '' : 's' }}</div>
        </div>
      </div>
    </template>

    <template v-else>
      <button class="btn-secondary btn-sm" style="margin-bottom:16px;" @click="selectedPhotoEmployee = null">
        <ArrowLeft :size="13" /> All Folders
      </button>
      <div style="font-size:13px;font-weight:600;color:var(--ct-primary);margin-bottom:12px;">
        {{ selectedPhotoEmployee.employeeName }} — {{ selectedPhotoEmployee.photos.length }} photo{{ selectedPhotoEmployee.photos.length === 1 ? '' : 's' }}
      </div>
      <div v-if="!selectedPhotoEmployee.photos.length" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
        No photos for this employee.
      </div>
      <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;">
        <div v-for="photo in selectedPhotoEmployee.photos" :key="photo.recordId + photo.field" class="glass" style="border-radius:12px;overflow:hidden;">
          <img :src="photo.url" style="width:100%;height:140px;object-fit:cover;display:block;" />
          <div style="padding:8px 10px;">
            <div style="font-size:10px;color:var(--ct-muted);">{{ photo.label }}</div>
            <div style="font-size:11px;color:var(--ct-sub);margin-top:2px;">{{ formatPhotoTimestamp(photo.timestamp) }}</div>
            <div style="display:flex;gap:6px;margin-top:8px;">
              <button class="btn-secondary btn-sm" style="flex:1;justify-content:center;" @click="downloadEmployeePhoto(photo)" title="Download">
                <Download :size="12" />
              </button>
              <button class="btn-danger btn-sm" style="flex:1;justify-content:center;" @click="deleteEmployeePhoto(photo)" title="Delete" :disabled="deletingPhotoKeys.has(photo.recordId + photo.field)">
                <Loader2 v-if="deletingPhotoKeys.has(photo.recordId + photo.field)" :size="12" style="animation:spin 1s linear infinite;" />
                <Trash2 v-else :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- ── Call Logs (company device call tracking) ── -->
  <div v-if="activeTab === 'call-logs'" class="config-section">
    <div class="section-header">
      <PhoneCall :size="18" />
      <div>
        <div class="section-title">Call Logs</div>
        <div class="section-sub">Device call history synced from company phones on login and attendance punch-out.</div>
      </div>
    </div>

    <div v-if="callLogsLoading" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
      <Loader2 :size="18" style="animation:spin 1s linear infinite;display:inline-block;" /> Loading call logs…
    </div>

    <template v-else-if="!selectedCallLogEmployee">
      <div v-if="!callLogEmployeeFolders.length" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
        No call logs synced yet.
      </div>
      <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;">
        <div
          v-for="folder in callLogEmployeeFolders"
          :key="folder.employeeId"
          class="glass"
          style="padding:18px;border-radius:12px;cursor:pointer;text-align:center;transition:border-color .15s;"
          @click="selectedCallLogEmployee = folder"
        >
          <PhoneCall :size="32" style="color:var(--ct-accent);margin-bottom:8px;" />
          <div style="font-size:13px;font-weight:600;color:var(--ct-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ folder.employeeName }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ folder.calls.length }} call{{ folder.calls.length === 1 ? '' : 's' }}</div>
        </div>
      </div>
    </template>

    <template v-else>
      <button class="btn-secondary btn-sm" style="margin-bottom:16px;" @click="selectedCallLogEmployee = null">
        <ArrowLeft :size="13" /> All Employees
      </button>
      <div style="font-size:13px;font-weight:600;color:var(--ct-primary);margin-bottom:16px;">
        {{ selectedCallLogEmployee.employeeName }} — {{ selectedCallLogEmployee.calls.length }} call{{ selectedCallLogEmployee.calls.length === 1 ? '' : 's' }}
      </div>
      <div v-if="!selectedCallLogEmployee.calls.length" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
        No calls for this employee.
      </div>
      <div v-else style="display:flex;flex-direction:column;gap:18px;">
        <div v-for="group in callLogDateGroups" :key="group.date">
          <div style="font-size:11px;font-weight:700;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">
            {{ group.label }} · {{ group.calls.length }} call{{ group.calls.length === 1 ? '' : 's' }}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div v-for="c in group.calls" :key="c.id" class="glass" style="padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:12px;">
              <PhoneIncoming v-if="c.type === 'inbound'" :size="16" style="color:#22c55e;flex-shrink:0;" />
              <PhoneOutgoing v-else-if="c.type === 'outbound'" :size="16" style="color:#3b82f6;flex-shrink:0;" />
              <PhoneMissed v-else :size="16" style="color:#ef4444;flex-shrink:0;" />
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">{{ c.contactName || c.phoneNumber || 'Unknown' }}</div>
                <div style="font-size:11px;color:var(--ct-muted);">{{ c.phoneNumber || '—' }}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:12px;color:var(--ct-sub);text-transform:capitalize;">{{ c.type }}</div>
                <div style="font-size:11px;color:var(--ct-muted);">{{ formatCallTime(c.callTime) }} · {{ formatCallDuration(c.duration) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- ── Site Sync (company device media backup) ── -->
  <div v-if="activeTab === 'site-sync'" class="config-section">
    <div class="section-header">
      <UploadCloud :size="18" />
      <div>
        <div class="section-title">Site Sync</div>
        <div class="section-sub">Wake a company device to back up its site/repair photos to storage. Enable "Sync Sites" for an employee in HR first.</div>
      </div>
    </div>

    <div v-if="siteSyncLoading" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
      <Loader2 :size="18" style="animation:spin 1s linear infinite;display:inline-block;" /> Loading employees…
    </div>
    <div v-else-if="!siteSyncEmployees.length" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
      No employees found.
    </div>
    <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;">
      <div v-for="emp in siteSyncEmployees" :key="emp.id" class="glass" style="padding:16px;border-radius:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="font-size:13px;font-weight:600;color:var(--ct-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ emp.fullName || emp.username }}</div>
          <span :class="['badge', emp.syncSiteMedia ? 'badge-active' : 'badge-inactive']" style="font-size:10px;">{{ emp.syncSiteMedia ? 'Sync ON' : 'Sync OFF' }}</span>
        </div>

        <template v-if="emp.syncSiteMedia">
          <div v-if="siteSyncProgress[emp.id]" style="margin-top:12px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ct-muted);margin-bottom:4px;">
              <span style="text-transform:capitalize;">{{ siteSyncProgress[emp.id].status }}</span>
              <span>{{ siteSyncProgress[emp.id].uploadedFiles ?? 0 }} / {{ siteSyncProgress[emp.id].totalFiles ?? '?' }}</span>
            </div>
            <div style="height:6px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;">
              <div :style="{ width: siteSyncProgressPct(emp.id) + '%', height:'100%', background: 'var(--ct-accent)', transition:'width .3s' }"></div>
            </div>
            <img v-if="siteSyncThumbnails[emp.id]" :src="siteSyncThumbnails[emp.id]" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-top:10px;" />
          </div>

          <button
            class="btn-primary btn-sm"
            style="width:100%;justify-content:center;margin-top:12px;"
            :disabled="siteSyncWaking.has(emp.id) || ['uploading','scanning'].includes(siteSyncProgress[emp.id]?.status)"
            @click="wakeSiteSyncDevice(emp)"
          >
            <Loader2 v-if="siteSyncWaking.has(emp.id)" :size="13" style="animation:spin 1s linear infinite;" />
            <UploadCloud v-else :size="13" />
            {{ ['uploading','scanning'].includes(siteSyncProgress[emp.id]?.status) ? 'Syncing…' : 'Wake Up & Sync' }}
          </button>
        </template>
        <div v-else style="margin-top:12px;font-size:11px;color:var(--ct-muted);">
          Enable "Sync Sites" for this employee in HR to use this.
        </div>
      </div>
    </div>
  </div>

  <!-- ── Site View (live device folder browsing, nothing stored) ── -->
  <div v-if="activeTab === 'site-view'" class="config-section">
    <div class="section-header">
      <Smartphone :size="18" />
      <div>
        <div class="section-title">Site View</div>
        <div class="section-sub">Wake a device and browse its photo/video folders live — nothing is uploaded or stored unless you download a file.</div>
      </div>
    </div>

    <div v-if="siteSyncLoading" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
      <Loader2 :size="18" style="animation:spin 1s linear infinite;display:inline-block;" /> Loading employees…
    </div>

    <!-- Employee picker -->
    <template v-else-if="!siteViewEmployee">
      <div v-if="!siteSyncEmployees.length" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
        No employees found.
      </div>
      <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;">
        <div
          v-for="emp in siteSyncEmployees"
          :key="emp.id"
          class="glass"
          style="padding:16px;border-radius:12px;cursor:pointer;text-align:center;"
          @click="openSiteView(emp)"
        >
          <Smartphone :size="28" style="color:var(--ct-accent);margin-bottom:8px;" />
          <div style="font-size:13px;font-weight:600;color:var(--ct-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ emp.fullName || emp.username }}</div>
        </div>
      </div>
    </template>

    <!-- Connected session: waking → folders → media -->
    <template v-else>
      <button class="btn-secondary btn-sm" style="margin-bottom:16px;" @click="closeSiteView">
        <X :size="13" /> Close Connection
      </button>

      <div style="font-size:13px;font-weight:600;color:var(--ct-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        {{ siteViewEmployee.fullName || siteViewEmployee.username }}
        <span :class="['badge', siteViewOnline ? 'badge-active' : 'badge-warning']" style="font-size:10px;">
          {{ siteViewOnline ? 'Connected' : 'Waking device…' }}
        </span>
      </div>

      <div v-if="!siteViewOnline" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
        <Loader2 :size="18" style="animation:spin 1s linear infinite;display:inline-block;" />
        Waiting for the device to come online — make sure it has a signal. This can take a few seconds.
      </div>

      <template v-else-if="!siteViewBucket">
        <div v-if="siteViewFoldersLoading" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
          <Loader2 :size="18" style="animation:spin 1s linear infinite;display:inline-block;" /> Loading folders…
        </div>
        <div v-else-if="!siteViewFolders.length" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
          No photo/video folders found on this device.
        </div>
        <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;">
          <div
            v-for="f in siteViewFolders"
            :key="f.bucket"
            class="glass"
            style="padding:18px;border-radius:12px;cursor:pointer;text-align:center;"
            @click="openSiteViewFolder(f.bucket)"
          >
            <Folder :size="32" style="color:var(--ct-accent);margin-bottom:8px;" />
            <div style="font-size:13px;font-weight:600;color:var(--ct-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ f.bucket }}</div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ f.count }} file{{ f.count === 1 ? '' : 's' }}</div>
          </div>
        </div>
      </template>

      <template v-else>
        <button class="btn-secondary btn-sm" style="margin-bottom:16px;" @click="siteViewBucket = null">
          <ArrowLeft :size="13" /> All Folders
        </button>
        <div v-if="siteViewMediaLoading" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
          <Loader2 :size="18" style="animation:spin 1s linear infinite;display:inline-block;" /> Loading {{ siteViewBucket }}…
        </div>
        <div v-else-if="!siteViewMedia.length" style="padding:24px;text-align:center;color:var(--ct-muted);font-size:13px;">
          No files in this folder.
        </div>
        <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;">
          <div v-for="item in siteViewMedia" :key="item.id" class="glass" style="border-radius:12px;overflow:hidden;">
            <div style="width:100%;height:120px;background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;">
              <img v-if="siteViewThumbs[item.id]" :src="siteViewThumbs[item.id]" style="width:100%;height:120px;object-fit:cover;display:block;" />
              <Video v-else-if="item.kind === 'video'" :size="24" style="color:var(--ct-muted);" />
              <Images v-else :size="24" style="color:var(--ct-muted);" />
            </div>
            <div style="padding:8px 10px;">
              <div style="font-size:11px;color:var(--ct-sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" :title="item.name">{{ item.name }}</div>
              <div style="font-size:10px;color:var(--ct-muted);margin-top:2px;">{{ formatBytes(item.size) }}</div>
              <button class="btn-secondary btn-sm" style="width:100%;justify-content:center;margin-top:8px;" :disabled="siteViewDownloading.has(item.id)" @click="downloadSiteViewFile(item)">
                <Loader2 v-if="siteViewDownloading.has(item.id)" :size="12" style="animation:spin 1s linear infinite;" />
                <Download v-else :size="12" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>

  <!-- ── Nav Tab Visibility ── -->
  <div v-if="activeTab === 'navtabs'" class="config-section">
    <div class="section-header">
      <LayoutGrid :size="18" />
      <div>
        <div class="section-title">Navigation Tab Visibility</div>
        <div class="section-sub">Toggle which tabs appear in the sidebar. Disabled tabs are hidden from all users including admins.</div>
      </div>
    </div>
    <div class="navtabs-grid">
      <div v-for="t in ALL_NAV_TABS" :key="t.key" class="navtab-row">
        <span class="navtab-label">{{ t.label }}</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="config.enabledTabs[t.key]" />
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
        </label>
        <span class="toggle-state" :style="config.enabledTabs[t.key] ? 'color:#22c55e' : 'color:#ef4444'">
          {{ config.enabledTabs[t.key] ? 'Visible' : 'Hidden' }}
        </span>
      </div>
    </div>
  </div>

  <!-- ── Inspection Checklist ── -->
  <div v-if="activeTab === 'checklist'" class="config-section">
    <div class="section-header">
      <CheckSquare :size="18" />
      <div>
        <div class="section-title">Inspection Checklist</div>
        <div class="section-sub">Manage checklist items (A = General, B = Cleaning, C = Lubrication, D = Safety Check)</div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:10px;flex-wrap:wrap;">
      <button class="btn-secondary btn-sm" @click="loadDefaultChecklist" :disabled="loadingDefaults">
        <Save :size="14" /> {{ loadingDefaults ? 'Loading…' : 'Load Default 72-Item Checklist' }}
      </button>
      <button class="btn-primary btn-sm" @click="openAddChecklistItem">
        <Plus :size="14" /> Add Item
      </button>
    </div>

    <div v-if="checklistLoading" style="text-align:center;padding:30px;color:var(--ct-muted);">Loading…</div>
    <div v-else-if="!checklistItems.length" style="text-align:center;padding:40px;color:var(--ct-muted);font-size:13px;">
      No checklist items yet. Click "Load Default" or "+ Add Item" to get started.
    </div>
    <div v-else style="display:flex;flex-direction:column;gap:16px;">
      <div v-for="sec in CHECKLIST_SECTIONS" :key="sec">
        <div v-if="checklistBySection[sec].length" style="">
          <div style="font-size:11px;font-weight:700;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding:4px 8px;background:rgba(99,102,241,0.08);border-radius:6px;display:inline-block;">
            Section {{ sec }}
            <span style="font-size:10px;color:var(--ct-muted);font-weight:400;margin-left:4px;">
              {{ sec === 'A' ? '— General Inspection (OK/Not OK)' : sec === 'B' ? '— Cleaning (Done/Not Done)' : sec === 'C' ? '— Lubrication (Done/Not Done)' : '— Safety Check (OK/Not OK)' }}
            </span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div
              v-for="item in checklistBySection[sec]"
              :key="item.id"
              style="display:flex;align-items:flex-start;gap:12px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;"
            >
              <div style="flex-shrink:0;width:22px;height:22px;background:rgba(99,102,241,0.12);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--ct-accent);">{{ item.order || '' }}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--ct-primary);">{{ item.title }}</div>
                <div v-if="item.description" style="font-size:12px;color:var(--ct-muted);margin-top:3px;">{{ item.description }}</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0;">
                <button class="btn-secondary btn-sm" @click="openEditChecklistItem(item)"><Pencil :size="12" /></button>
                <button class="btn-danger btn-sm" @click="deleteChecklistItem(item)"><Trash2 :size="12" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Add/Edit Checklist Item Modal -->
  <div
    v-if="showChecklistModal"
    style="position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;"
    @click.self="showChecklistModal = false"
  >
    <div class="glass" style="width:100%;max-width:480px;padding:28px;border-radius:16px;display:flex;flex-direction:column;gap:16px;">
      <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ editingChecklistItem ? 'Edit Item' : 'Add Checklist Item' }}</div>
      <div class="form-group">
        <label class="label">Section *</label>
        <select v-model="checklistForm.section" class="input">
          <option value="A">Section A — General Inspection (OK / Not OK)</option>
          <option value="B">Section B — Cleaning (Done / Not Done)</option>
          <option value="C">Section C — Lubrication (Done / Not Done)</option>
          <option value="D">Section D — Safety Check (OK / Not OK)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="label">Title *</label>
        <input v-model="checklistForm.title" class="input" placeholder="e.g. Rope condition" autofocus />
      </div>
      <div class="form-group">
        <label class="label">Description <span style="font-weight:400;color:var(--ct-muted);">(optional)</span></label>
        <textarea v-model="checklistForm.description" class="input" rows="2" placeholder="Brief description of what to inspect…"></textarea>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button class="btn-secondary" @click="showChecklistModal = false">Cancel</button>
        <button class="btn-primary" :disabled="savingChecklist || !checklistForm.title.trim()" @click="saveChecklistItem">
          <Save :size="14" /> {{ savingChecklist ? 'Saving…' : (editingChecklistItem ? 'Update' : 'Add Item') }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Inspection Template Format ── -->
  <div v-if="activeTab === 'inspection-format'" class="config-section">
    <div class="section-header">
      <FileCode :size="18" />
      <div>
        <div class="section-title">Inspection Report Format</div>
        <div class="section-sub">HTML template for generating inspection PDFs. Use the placeholders below.</div>
      </div>
    </div>
    <div style="margin-bottom:14px;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:10px;font-size:12px;color:var(--ct-muted);line-height:1.7;">
      <strong style="color:var(--ct-accent);">Available placeholders:</strong><br>
      <code>{{CLIENT_NAME}}</code> · <code>{{CONTRACT_NO}}</code> · <code>{{INSPECTION_DATE}}</code> · <code>{{CHECKED_BY}}</code> · <code>{{MONTH_YEAR}}</code> · <code>{{SOCIETY_NAME}}</code> · <code>{{LIFT_NO}}</code><br>
      <strong style="color:var(--ct-accent);">Section row placeholders (auto-generated table rows per section):</strong><br>
      <code>{{SECTION_A_ROWS}}</code> — Section A (OK / Not OK / Remarks columns)<br>
      <code>{{SECTION_B_ROWS}}</code> — Section B (Done / Remarks columns)<br>
      <code>{{SECTION_C_ROWS}}</code> — Section C (Done / Remarks columns)<br>
      <code>{{SECTION_D_ROWS}}</code> — Section D (OK / Not OK / Remarks columns)<br>
      <code>{{PASS_COUNT}}</code> · <code>{{FAIL_COUNT}}</code> · <code>{{NA_COUNT}}</code>
    </div>
    <textarea
      v-model="config.inspectionHtml"
      class="input"
      style="width:100%;height:500px;font-family:monospace;font-size:12px;resize:vertical;"
      placeholder="Paste your full HTML inspection template here…"
    ></textarea>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  Settings2, Bot, Building2, FileText, Save, Loader2,
  Eye, EyeOff, Upload, LayoutGrid, Map as MapIcon, FileCode, MapPin,
  Mail as MailIcon, CheckCircle, XCircle, CheckSquare, Plus, Pencil, Trash2,
  Images, Folder, Download, ArrowLeft, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, UploadCloud,
  Smartphone, Video, X
} from 'lucide-vue-next'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { mediaStorage } from '@/firebase/storage-config'
import { getAll, create, update, remove, subscribe } from '@/firebase/firestore'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Collections } from '@/firebase/collections'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { useCompanyConfig } from '@/composables/useCompanyConfig'
import { useEnabledTabs } from '@/composables/useEnabledTabs'
import { useTrackingConfig } from '@/composables/useTrackingConfig'
import { clearBillingPDFCache } from '@/composables/useBillingPDF'
import { fetchStorageThumbnail } from '@/composables/useSiteMediaStorage'
import { watchEmployee, unwatchEmployee, listFolders, listMedia, getThumbnailUrl, downloadFile } from '@/composables/useSiteViewRelay'
import { ROLES } from '@/stores/auth'

const ui = useUIStore()
const activity = useActivityStore()
const authStore = useAuthStore()
const { refresh: refreshCompany } = useCompanyConfig()
const { refresh: refreshEnabledTabs } = useEnabledTabs()
const { refresh: refreshTrackingConfig } = useTrackingConfig()
const saving = ref(false)
const showApiKey = ref(false)
const showGoogleKey = ref(false)
const showMapboxKey = ref(false)
const showHereKey = ref(false)

const mapProviders = [
  { value: 'openstreetmap', label: 'OpenStreetMap', emoji: '🗺', desc: 'Free, no API key needed. Dark mode via CSS filter.' },
  { value: 'google',        label: 'Google Maps',   emoji: '🌍', desc: 'Needs Maps JavaScript API key. Satellite view & native dark mode.' },
  { value: 'mapbox',        label: 'Mapbox',        emoji: '🗺', desc: 'Needs access token. 50k loads/month free. Beautiful native dark style.' },
  { value: 'here',          label: 'HERE Maps',     emoji: '📡', desc: 'Needs API key. 250k transactions/month free. Good India accuracy.' },
]
const showPreview = ref(false)
const previewFrame = ref(null)
const activeTab = ref('llm')
const activeTemplate = ref('quotation')
let configDocId = null

// ── All Photos (employee attendance selfies) ──────────────────────────────────
const photosLoading = ref(false)
const attendanceRecords = ref([])
const selectedPhotoEmployee = ref(null)
let photosLoaded = false

const PHOTO_FIELDS = [
  { field: 'checkInSelfie',    tsField: 'checkInTime',  label: 'Check-in' },
  { field: 'checkOutSelfie',   tsField: 'checkOutTime', label: 'Check-out' },
  { field: 'otPunchInSelfie',  tsField: 'otPunchIn',    label: 'OT Punch-in' },
  { field: 'otPunchOutSelfie', tsField: 'otPunchOut',   label: 'OT Punch-out' },
]

const employeePhotoFolders = computed(() => {
  const byEmployee = new Map()
  for (const rec of attendanceRecords.value) {
    if (!rec.employeeId) continue
    for (const { field, tsField, label } of PHOTO_FIELDS) {
      const url = rec[field]
      if (!url) continue
      if (!byEmployee.has(rec.employeeId)) {
        byEmployee.set(rec.employeeId, { employeeId: rec.employeeId, employeeName: rec.employeeName || 'Unknown', photos: [] })
      }
      byEmployee.get(rec.employeeId).photos.push({
        recordId: rec.id, field, label, url,
        timestamp: rec[tsField] || rec.date || null,
      })
    }
  }
  const folders = [...byEmployee.values()]
  folders.forEach(f => f.photos.sort((a, b) => {
    const ta = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime()
    const tb = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime()
    return tb - ta
  }))
  return folders.sort((a, b) => a.employeeName.localeCompare(b.employeeName))
})

async function loadEmployeePhotos() {
  if (photosLoaded) return
  photosLoading.value = true
  try {
    attendanceRecords.value = await getAll(Collections.ATTENDANCE)
    photosLoaded = true
  } catch {
    ui.error('Failed to load attendance photos.')
  } finally {
    photosLoading.value = false
  }
}

watch(activeTab, (val) => {
  if (val === 'employee-photos') loadEmployeePhotos()
  if (val === 'call-logs') loadCallLogs()
})

// ── Call Logs (company device call tracking) ──────────────────────────────────
const callLogsLoading = ref(false)
const callLogRecords = ref([])
const selectedCallLogEmployee = ref(null)
let callLogsLoaded = false

function callLogTimeMs(c) {
  return c.callTime?.toDate ? c.callTime.toDate().getTime() : new Date(c.callTime || 0).getTime()
}

const callLogEmployeeFolders = computed(() => {
  const byEmployee = new Map()
  for (const rec of callLogRecords.value) {
    if (!rec.employeeId) continue
    if (!byEmployee.has(rec.employeeId)) {
      byEmployee.set(rec.employeeId, { employeeId: rec.employeeId, employeeName: rec.employeeName || 'Unknown', calls: [] })
    }
    byEmployee.get(rec.employeeId).calls.push(rec)
  }
  const folders = [...byEmployee.values()]
  folders.forEach(f => f.calls.sort((a, b) => callLogTimeMs(b) - callLogTimeMs(a)))
  return folders.sort((a, b) => a.employeeName.localeCompare(b.employeeName))
})

// Groups the selected employee's calls by calendar date, newest first —
// each group's own calls are already newest-first from the folder sort above.
const callLogDateGroups = computed(() => {
  if (!selectedCallLogEmployee.value) return []
  const byDate = new Map()
  for (const c of selectedCallLogEmployee.value.calls) {
    const d = c.callTime?.toDate ? c.callTime.toDate() : new Date(c.callTime || 0)
    const key = isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10)
    if (!byDate.has(key)) byDate.set(key, { date: key, label: isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), calls: [] })
    byDate.get(key).calls.push(c)
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
})

async function loadCallLogs() {
  if (callLogsLoaded) return
  callLogsLoading.value = true
  try {
    callLogRecords.value = await getAll(Collections.CALL_LOGS)
    callLogsLoaded = true
  } catch {
    ui.error('Failed to load call logs.')
  } finally {
    callLogsLoading.value = false
  }
}

function formatCallTime(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function formatCallDuration(seconds) {
  const s = Number(seconds) || 0
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem ? `${m}m ${rem}s` : `${m}m`
}

// ── Site Sync (company device media backup) ────────────────────────────────────
const siteSyncLoading = ref(false)
const siteSyncEmployees = ref([])
const siteSyncProgress = ref({})    // { [employeeId]: {status,totalFiles,uploadedFiles,currentThumbnailUrl,updatedAt} }
const siteSyncThumbnails = ref({})  // { [employeeId]: local blob URL }
const siteSyncWaking = ref(new Set())
let siteSyncLoaded = false
let siteSyncUnsub = null
const _siteSyncThumbSeen = {} // employeeId -> last currentThumbnailUrl already fetched, avoids re-fetching on every progress tick

watch(activeTab, (val) => { if (val === 'site-sync' || val === 'site-view') loadSiteSync() })

function siteSyncProgressPct(employeeId) {
  const p = siteSyncProgress.value[employeeId]
  if (!p || !p.totalFiles) return 0
  return Math.min(100, Math.round((p.uploadedFiles / p.totalFiles) * 100))
}

async function loadSiteSync() {
  if (!siteSyncLoaded) {
    siteSyncLoading.value = true
    try {
      const employees = await getAll(Collections.EMPLOYEES)
      siteSyncEmployees.value = employees
        .filter(e => e.status !== 'inactive')
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
      siteSyncLoaded = true
    } catch {
      ui.error('Failed to load employees.')
    } finally {
      siteSyncLoading.value = false
    }
  }

  if (!siteSyncUnsub) {
    siteSyncUnsub = subscribe(Collections.SYNC_PROGRESS, (docs) => {
      const map = {}
      for (const d of docs) map[d.id] = d
      siteSyncProgress.value = map
      for (const d of docs) {
        if (d.currentThumbnailUrl && _siteSyncThumbSeen[d.id] !== d.currentThumbnailUrl) {
          _siteSyncThumbSeen[d.id] = d.currentThumbnailUrl
          fetchStorageThumbnail(d.currentThumbnailUrl).then(url => {
            const prev = siteSyncThumbnails.value[d.id]
            if (prev) URL.revokeObjectURL(prev)
            siteSyncThumbnails.value = { ...siteSyncThumbnails.value, [d.id]: url }
          }).catch(() => {})
        }
      }
    })
  }
}

async function wakeSiteSyncDevice(emp) {
  siteSyncWaking.value = new Set(siteSyncWaking.value).add(emp.id)
  try {
    await setDoc(doc(db, Collections.SITE_SYNC_WAKES, emp.id), {
      requestedAt: serverTimestamp(),
      requestedBy: authStore.user?.fullName || authStore.user?.username || 'admin',
    })
    ui.success(`Wake sent to ${emp.fullName || emp.username}`)
  } catch {
    ui.error('Failed to send wake request')
  } finally {
    const next = new Set(siteSyncWaking.value)
    next.delete(emp.id)
    siteSyncWaking.value = next
  }
}

onUnmounted(() => {
  if (siteSyncUnsub) siteSyncUnsub()
  for (const url of Object.values(siteSyncThumbnails.value)) URL.revokeObjectURL(url)
  closeSiteView()
})

// ── Site View (live device folder browsing, nothing stored) ────────────────────
const siteViewEmployee = ref(null)
const siteViewOnline = ref(false)
const siteViewFolders = ref([])
const siteViewFoldersLoading = ref(false)
const siteViewBucket = ref(null)
const siteViewMedia = ref([])
const siteViewMediaLoading = ref(false)
const siteViewThumbs = ref({})
const siteViewDownloading = ref(new Set())
let _siteViewStatusHandler = null

async function openSiteView(emp) {
  siteViewEmployee.value = emp
  siteViewOnline.value = false
  siteViewFolders.value = []
  siteViewBucket.value = null
  siteViewMedia.value = []
  siteViewThumbs.value = {}

  try {
    await setDoc(doc(db, Collections.SITE_VIEW_WAKES, emp.id), { requestedAt: serverTimestamp() })
  } catch {
    ui.error('Failed to send wake request')
    siteViewEmployee.value = null
    return
  }

  _siteViewStatusHandler = ({ online }) => {
    siteViewOnline.value = online
    if (online && !siteViewFolders.value.length) loadSiteViewFolders()
  }
  watchEmployee(emp.id, _siteViewStatusHandler).catch(() => ui.error('Failed to connect to the relay'))
}

function closeSiteView() {
  if (siteViewEmployee.value && _siteViewStatusHandler) {
    unwatchEmployee(siteViewEmployee.value.id, _siteViewStatusHandler)
  }
  _siteViewStatusHandler = null
  siteViewEmployee.value = null
  siteViewOnline.value = false
  siteViewFolders.value = []
  siteViewBucket.value = null
  siteViewMedia.value = []
  siteViewThumbs.value = {}
}

async function loadSiteViewFolders() {
  siteViewFoldersLoading.value = true
  try {
    siteViewFolders.value = await listFolders(siteViewEmployee.value.id)
  } catch (e) {
    ui.error(e.message || 'Failed to load folders')
  } finally {
    siteViewFoldersLoading.value = false
  }
}

async function openSiteViewFolder(bucket) {
  siteViewBucket.value = bucket
  siteViewMediaLoading.value = true
  siteViewMedia.value = []
  siteViewThumbs.value = {}
  try {
    siteViewMedia.value = await listMedia(siteViewEmployee.value.id, bucket)
    for (const item of siteViewMedia.value) {
      getThumbnailUrl(siteViewEmployee.value.id, item.id)
        .then((url) => { siteViewThumbs.value = { ...siteViewThumbs.value, [item.id]: url } })
        .catch(() => {}) // a failed thumbnail just falls back to the placeholder icon
    }
  } catch (e) {
    ui.error(e.message || 'Failed to load folder')
  } finally {
    siteViewMediaLoading.value = false
  }
}

async function downloadSiteViewFile(item) {
  siteViewDownloading.value = new Set(siteViewDownloading.value).add(item.id)
  try {
    await downloadFile(siteViewEmployee.value.id, item.id, item.name)
  } catch (e) {
    ui.error(e.message || 'Download failed')
  } finally {
    const next = new Set(siteViewDownloading.value)
    next.delete(item.id)
    siteViewDownloading.value = next
  }
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatPhotoTimestamp(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const deletingPhotoKeys = ref(new Set())

async function deleteEmployeePhoto(photo) {
  const key = photo.recordId + photo.field
  if (deletingPhotoKeys.value.has(key)) return
  deletingPhotoKeys.value = new Set(deletingPhotoKeys.value).add(key)
  try {
    try {
      await deleteObject(storageRef(mediaStorage, photo.url))
    } catch (e) {
      // Photo may have been uploaded via the R2 fallback (no delete API available there)
      // or already removed from storage — still clear the field from the record below.
      console.warn('[All Photos] Storage delete failed (continuing to clear the field):', e.message)
    }
    await update(Collections.ATTENDANCE, photo.recordId, { [photo.field]: null })
    const rec = attendanceRecords.value.find(r => r.id === photo.recordId)
    if (rec) rec[photo.field] = null
    if (selectedPhotoEmployee.value) {
      selectedPhotoEmployee.value.photos = selectedPhotoEmployee.value.photos.filter(p => p !== photo)
    }
    ui.success('Photo deleted')
  } catch {
    ui.error('Failed to delete photo')
  } finally {
    const next = new Set(deletingPhotoKeys.value)
    next.delete(key)
    deletingPhotoKeys.value = next
  }
}

async function downloadEmployeePhoto(photo) {
  try {
    const res = await fetch(photo.url)
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = `${selectedPhotoEmployee.value?.employeeName || 'employee'}_${photo.label}_${photo.recordId}.jpg`.replace(/\s+/g, '_')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(objUrl), 5000)
  } catch {
    ui.error('Failed to download photo')
  }
}

// ── Email Settings ────────────────────────────────────────────────────────────
const showSmtpPass = ref(false)
const showEmailApiKey = ref(false)
const emailValidating = ref(false)
const emailValidateResult = ref(null) // null | { ok: true, message } | { ok: false, message }
const showEmailPreview = ref(false)
const emailPreviewFrame = ref(null)
const showAmcEmailPreview = ref(false)
const amcEmailPreviewFrame = ref(null)

const SMTP_PROVIDERS = [
  { value: 'zoho',       label: 'Zoho Mail (India .in / Global .com)' },
  { value: 'gmail',      label: 'Gmail / Google Workspace' },
  { value: 'outlook',    label: 'Outlook / Hotmail' },
  { value: 'office365',  label: 'Office 365' },
  { value: 'yahoo',      label: 'Yahoo Mail' },
  { value: 'godaddy',    label: 'GoDaddy' },
  { value: 'hostinger',  label: 'Hostinger' },
  { value: 'icloud',     label: 'iCloud Mail' },
  { value: 'sendgrid',   label: 'SendGrid SMTP' },
  { value: 'brevo-smtp', label: 'Brevo SMTP Relay' },
  { value: 'namecheap',  label: 'Namecheap PrivateEmail' },
  { value: 'titan',      label: 'Titan Email' },
  { value: 'fastmail',   label: 'Fastmail' },
]

async function validateEmailConfig() {
  const ec = emailConfig.value
  if (!ec.smtpUser || !ec.smtpPass) {
    emailValidateResult.value = { ok: false, message: 'Email and password are required before testing.' }
    return
  }
  emailValidating.value     = true
  emailValidateResult.value = null
  try {
    const res = await fetch('https://x4m2x4kscj.execute-api.ap-south-1.amazonaws.com/v1/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'Ambivare@9822091922' },
      body:    JSON.stringify({
        credentials: { email: ec.smtpUser, password: ec.smtpPass },
        provider:    ec.smtpProvider || 'custom',
      }),
    })
    const data = await res.json()
    if (res.ok && data.success) {
      const host = data.usedConfig?.host || ec.smtpHost || 'SMTP'
      emailValidateResult.value = { ok: true, message: data.message || `Connected via ${host}` }
    } else {
      emailValidateResult.value = { ok: false, message: data.error || 'Verification failed.' }
    }
  } catch (e) {
    emailValidateResult.value = { ok: false, message: e.message || 'Network error.' }
  } finally {
    emailValidating.value = false
  }
}

function previewEmailTemplate() {
  const html = emailConfig.value.template
  if (!html) { ui.error('No email template to preview.'); return }
  const co = config.value.company || {}
  const preview = html
    .replace(/\{\{client\.name\}\}/g, 'Sample Client Pvt. Ltd.')
    .replace(/\{\{client\.email\}\}/g, 'client@example.com')
    .replace(/\{\{client\.address\}\}/g, 'B-12, Commercial Complex, Sector 17, Navi Mumbai')
    .replace(/\{\{doc\.number\}\}/g, 'Q-2024-001')
    .replace(/\{\{doc\.date\}\}/g, new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }))
    .replace(/\{\{doc\.total\}\}/g, '₹1,00,000')
    .replace(/\{\{company\.name\}\}/g, co.name || 'Avant Elevators')
    .replace(/\{\{company\.email\}\}/g, co.email || 'info@avantlifts.com')
    .replace(/\{\{company\.phone\}\}/g, co.phone || '+91 98765 43210')
  showEmailPreview.value = true
  setTimeout(() => {
    if (emailPreviewFrame.value) emailPreviewFrame.value.srcdoc = preview
  }, 50)
}

function previewAmcEmailTemplate() {
  const html = emailConfig.value.amcTemplate
  if (!html) { ui.error('No AMC email template to preview.'); return }
  const co = config.value.company || {}
  const preview = html
    .replace(/\{\{client\.name\}\}/g, 'Sample Housing Society')
    .replace(/\{\{client\.email\}\}/g, 'society@example.com')
    .replace(/\{\{contract\.number\}\}/g, 'AMC-2024-001')
    .replace(/\{\{contract\.startDate\}\}/g, '01 Jan 2024')
    .replace(/\{\{contract\.endDate\}\}/g, '31 Dec 2024')
    .replace(/\{\{contract\.value\}\}/g, '₹36,000')
    .replace(/\{\{contract\.duration\}\}/g, '12 months')
    .replace(/\{\{contract\.type\}\}/g, 'Gold')
    .replace(/\{\{company\.name\}\}/g, co.name || 'Avant Elevators')
    .replace(/\{\{company\.email\}\}/g, co.email || 'info@avantlifts.com')
    .replace(/\{\{company\.phone\}\}/g, co.phone || '+91 98765 43210')
  showAmcEmailPreview.value = true
  setTimeout(() => {
    if (amcEmailPreviewFrame.value) amcEmailPreviewFrame.value.srcdoc = preview
  }, 50)
}

const DEFAULT_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;}
.card{background:#fff;max-width:600px;margin:0 auto;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);}
.header{background:#1e293b;color:#fff;padding:24px 32px;}
.header h1{margin:0;font-size:22px;}
.header p{margin:4px 0 0;opacity:.7;font-size:13px;}
.body{padding:28px 32px;}
.body p{color:#334155;line-height:1.6;margin:0 0 14px;}
.doc-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 20px;margin:20px 0;}
.doc-box table{width:100%;border-collapse:collapse;}
.doc-box td{padding:4px 0;font-size:14px;color:#475569;}
.doc-box td:last-child{text-align:right;font-weight:600;color:#1e293b;}
.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;}
</style></head>
<body>
<div class="card">
  <div class="header">
    <h1>{{company.name}}</h1>
    <p>Document Notification</p>
  </div>
  <div class="body">
    <p>Dear {{client.name}},</p>
    <p>Please find attached your document from {{company.name}}. Details are below:</p>
    <div class="doc-box">
      <table>
        <tr><td>Document No.</td><td>{{doc.number}}</td></tr>
        <tr><td>Date</td><td>{{doc.date}}</td></tr>
        <tr><td>Total Amount</td><td>{{doc.total}}</td></tr>
      </table>
    </div>
    <p>Please review the attached document. For any queries, feel free to contact us.</p>
    <p>Thank you for your business!</p>
    <p>Best regards,<br><strong>{{company.name}}</strong><br>{{company.phone}}<br>{{company.email}}</p>
  </div>
  <div class="footer">This is an automated email from {{company.name}}. Please do not reply directly to this email.</div>
</div>
</body>
</html>`

const DEFAULT_AMC_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;}
.card{background:#fff;max-width:600px;margin:0 auto;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);}
.header{background:#1e293b;color:#fff;padding:24px 32px;}
.header h1{margin:0;font-size:22px;}
.header p{margin:4px 0 0;opacity:.7;font-size:13px;}
.body{padding:28px 32px;}
.body p{color:#334155;line-height:1.6;margin:0 0 14px;}
.contract-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 20px;margin:20px 0;}
.contract-box table{width:100%;border-collapse:collapse;}
.contract-box td{padding:5px 0;font-size:14px;color:#475569;}
.contract-box td:first-child{font-weight:600;color:#1e293b;width:45%;}
.badge{display:inline-block;background:#1e293b;color:#fff;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;letter-spacing:.5px;}
.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;}
</style></head>
<body>
<div class="card">
  <div class="header">
    <h1>{{company.name}}</h1>
    <p>Annual Maintenance Contract</p>
  </div>
  <div class="body">
    <p>Dear {{client.name}},</p>
    <p>Please find attached your AMC Contract document from <strong>{{company.name}}</strong>. The contract details are summarised below:</p>
    <div class="contract-box">
      <table>
        <tr><td>Contract No.</td><td>{{contract.number}}</td></tr>
        <tr><td>Contract Type</td><td>{{contract.type}}</td></tr>
        <tr><td>Start Date</td><td>{{contract.startDate}}</td></tr>
        <tr><td>End Date</td><td>{{contract.endDate}}</td></tr>
        <tr><td>Duration</td><td>{{contract.duration}}</td></tr>
        <tr><td>Contract Value</td><td>{{contract.value}}</td></tr>
      </table>
    </div>
    <p>Please review the attached contract document. If you have any questions or require any changes, please contact us at the details below.</p>
    <p>Thank you for choosing {{company.name}} for your lift maintenance needs!</p>
    <p>Best regards,<br><strong>{{company.name}}</strong><br>{{company.phone}}<br>{{company.email}}</p>
  </div>
  <div class="footer">This is an automated email from {{company.name}}. Please retain this email for your records.</div>
</div>
</body>
</html>`

const emailConfig = ref({
  mode: 'smtp',
  workerUrl: '',
  smtpProvider: 'gmail',
  smtpHost: 'smtp.gmail.com',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  apiProvider: 'brevo',
  apiKey: '',
  fromEmail: '',
  fromName: '',
  template: DEFAULT_EMAIL_TEMPLATE,
  amcTemplate: DEFAULT_AMC_EMAIL_TEMPLATE,
})

// Computed label for the currently selected template tab
const activeTemplateLabel = computed(
  () => templateTypes.find(t => t.key === activeTemplate.value)?.label ?? activeTemplate.value
)

// Writable computed — reads/writes config.templates[activeTemplate] directly.
// Using a computed setter avoids the v-for + v-model dynamic-key binding bug
// where all textareas share the same reactive slot.
const activeTemplateContent = computed({
  get: () => config.value.templates[activeTemplate.value] ?? '',
  set: (val) => { config.value.templates[activeTemplate.value] = val },
})

const tabs = [
  { key: 'llm',                label: 'AI / LLM',           icon: Bot },
  { key: 'company',            label: 'Company',             icon: Building2 },
  { key: 'templates',          label: 'Billing Templates',   icon: FileText },
  { key: 'email',              label: 'Email Settings',      icon: MailIcon },
  { key: 'contract-format',    label: 'Contract Format',     icon: FileCode },
  { key: 'renewal-format',     label: 'AMC Renewal Format',  icon: FileCode },
  { key: 'inspection-format',  label: 'Inspection Format',   icon: FileCode },
  { key: 'checklist',          label: 'Checklist',           icon: CheckSquare },
  { key: 'navtabs',            label: 'Nav Tab Visibility',  icon: LayoutGrid },
  { key: 'tracking-roles',     label: 'Tracking Roles',      icon: MapPin },
  { key: 'maps',               label: 'Maps',                icon: MapIcon },
  { key: 'employee-photos',    label: 'All Photos',          icon: Images },
  { key: 'call-logs',          label: 'Call Logs',           icon: PhoneCall },
  { key: 'site-sync',          label: 'Site Sync',           icon: UploadCloud },
  { key: 'site-view',          label: 'Site View',           icon: Smartphone },
]

// All navigable tabs that can be toggled
const ALL_NAV_TABS = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'warehouse',     label: 'Warehouse' },
  { key: 'service-van',   label: 'Service Van' },
  { key: 'office',        label: 'Office' },
  { key: 'projects',      label: 'Projects' },
  { key: 'maintenance',   label: 'Maintenance' },
  { key: 'installation',  label: 'Installation' },
  { key: 'modernisation', label: 'Modernisation' },
  { key: 'repairs',       label: 'Repairs' },
  { key: 'complaints',    label: 'Complaints' },
  { key: 'inspection',    label: 'Inspection' },
  { key: 'amc',           label: 'AMC' },
  { key: 'billing',       label: 'Billing' },
  { key: 'vendors',       label: 'Vendors' },
  { key: 'bom',           label: 'BOM' },
  { key: 'tasks',         label: 'Tasks' },
  { key: 'tracking',      label: 'Tracking' },
  { key: 'sales',         label: 'Sales' },
  { key: 'hr',            label: 'HR' },
  { key: 'leave',         label: 'Leave' },
  { key: 'activities',    label: 'Activities' },
  { key: 'gallery',       label: 'Gallery' },
  { key: 'settings',      label: 'Settings' },
  { key: 'ai-assistant',  label: 'Elevex AI' },
]

const templateTypes = [
  { key: 'quotation',     label: 'Quotation' },
  { key: 'proforma',     label: 'Proforma Invoice' },
  { key: 'invoice',      label: 'Invoice' },
  { key: 'taxInvoice',   label: 'Tax Invoice' },
  { key: 'purchaseOrder', label: 'Purchase Order' },
  { key: 'bom',          label: 'BOM' },
]

const llmProviders = [
  { value: 'anthropic',    label: 'Anthropic (Claude)' },
  { value: 'openai',       label: 'OpenAI (GPT / o-series)' },
  { value: 'gemini',       label: 'Google Gemini' },
  { value: 'groq',         label: 'Groq — Ultra-fast inference' },
  { value: 'openrouter',   label: 'OpenRouter — Multi-model gateway' },
  { value: 'grok',         label: 'xAI (Grok)' },
  { value: 'deepseek',     label: 'DeepSeek AI' },
  { value: 'local',        label: 'Local / Ollama' },
  { value: 'openai-compat', label: 'OpenAI-Compatible API' },
]

const modelsByProvider = {
  anthropic: [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 — Most capable' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — Recommended ✦' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — Fast & cheap' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet — Extended thinking' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1 — Latest flagship ✦' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini — Fast & efficient' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano — Fastest & cheapest' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3', label: 'o3 — Best reasoning' },
    { value: 'o3-mini', label: 'o3-mini — Fast reasoning' },
    { value: 'o1', label: 'o1' },
    { value: 'o1-mini', label: 'o1-mini' },
  ],
  gemini: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — Most capable ✦' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — Best balance' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite — Fast & cheap' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — Stable' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite — Ultra fast' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B — Lightest' },
  ],
  grok: [
    { value: 'grok-3', label: 'Grok-3 — Most capable ✦' },
    { value: 'grok-3-fast', label: 'Grok-3 Fast' },
    { value: 'grok-3-mini', label: 'Grok-3 Mini' },
    { value: 'grok-3-mini-fast', label: 'Grok-3 Mini Fast' },
    { value: 'grok-2-1212', label: 'Grok-2 (Latest stable)' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile',        label: 'Llama 3.3 70B Versatile — Best overall ✦' },
    { value: 'llama-3.1-8b-instant',            label: 'Llama 3.1 8B Instant — Fastest' },
    { value: 'deepseek-r1-distill-llama-70b',   label: 'DeepSeek R1 Distill 70B — Reasoning' },
    { value: 'qwen-qwq-32b',                    label: 'Qwen QwQ 32B — Reasoning' },
    { value: 'gemma2-9b-it',                    label: 'Gemma 2 9B' },
    { value: 'mixtral-8x7b-32768',              label: 'Mixtral 8x7B' },
    { value: 'llama3-70b-8192',                 label: 'Llama 3 70B' },
    { value: 'llama3-8b-8192',                  label: 'Llama 3 8B — Lightweight' },
  ],
  openrouter: [
    { value: 'google/gemini-2.5-pro-preview-03-25',       label: 'Gemini 2.5 Pro — Best overall ✦' },
    { value: 'anthropic/claude-sonnet-4-5',               label: 'Claude Sonnet 4.5' },
    { value: 'deepseek/deepseek-chat-v3-0324:free',       label: 'DeepSeek V3 — Free ✦' },
    { value: 'deepseek/deepseek-r1:free',                 label: 'DeepSeek R1 — Free reasoning' },
    { value: 'meta-llama/llama-3.3-70b-instruct:free',    label: 'Llama 3.3 70B — Free' },
    { value: 'google/gemini-2.0-flash-exp:free',          label: 'Gemini 2.0 Flash — Free' },
    { value: 'qwen/qwen-2.5-72b-instruct',                label: 'Qwen 2.5 72B' },
    { value: 'mistralai/mistral-large-2411',              label: 'Mistral Large 2411' },
    { value: 'openai/gpt-4o',                             label: 'GPT-4o (via OpenRouter)' },
    { value: 'openai/gpt-4.1',                            label: 'GPT-4.1 (via OpenRouter)' },
    { value: 'custom',                                     label: 'Custom (enter model name)' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek-V3 — Best value ✦' },
    { value: 'deepseek-reasoner', label: 'DeepSeek-R1 — Reasoning model' },
  ],
  local: [
    { value: 'llama3.3', label: 'Llama 3.3 (70B)' },
    { value: 'llama3.2', label: 'Llama 3.2 (3B)' },
    { value: 'llama3.2:1b', label: 'Llama 3.2 (1B) — Lightest' },
    { value: 'llama3.1', label: 'Llama 3.1 (8B)' },
    { value: 'mistral', label: 'Mistral (7B)' },
    { value: 'mistral-nemo', label: 'Mistral Nemo (12B)' },
    { value: 'gemma3:4b', label: 'Gemma 3 (4B)' },
    { value: 'gemma2', label: 'Gemma 2 (9B)' },
    { value: 'phi4', label: 'Phi-4 (14B)' },
    { value: 'phi3', label: 'Phi-3' },
    { value: 'qwen2.5', label: 'Qwen 2.5 (7B)' },
    { value: 'codestral', label: 'Codestral — Code focused' },
    { value: 'custom', label: 'Custom (enter model name)' },
  ],
  'openai-compat': [
    { value: 'custom', label: 'Custom (enter model name)' },
  ],
}

const availableModels = computed(() => modelsByProvider[config.value.llm.provider] || modelsByProvider.anthropic)

function onProviderChange() {
  config.value.llm.model = availableModels.value[0]?.value || ''
}

const config = ref({
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    apiKey: '',
    baseUrl: '',
  },
  company: {
    name: '',
    tagline: '',
    cin: '',
    logoUrl: '',
    headerUrl: '',
    email: '',
    phone: '',
    plotNo: '',
    sector: '',
    address: '',
    regAddress: '',
    city: '',
    state: '',
    pincode: '',
    gst: '',
    pan: '',
    bankName: '',
    bankBranch: '',
    accountNo: '',
    ifsc: '',
    website: '',
  },
  templates: {
    quotation: '',
    proforma: '',
    invoice: '',
    taxInvoice: '',
    purchaseOrder: '',
    bom: '',
  },
  contractHtml: '',
  amcRenewalHtml: '',
  inspectionHtml: '',
  // All tabs enabled by default — keys that are false are hidden from nav
  enabledTabs: Object.fromEntries(ALL_NAV_TABS.map(t => [t.key, true])),
  // Which roles can access the Tracking tab — admin and technician on by default
  trackingRoles: { admin: true, technician: true, sales: false, reception: false, user: false },
  maps: {
    provider: 'openstreetmap',
    googleMapsApiKey: '',
    mapboxToken: '',
    hereApiKey: '',
  },
})

function docTsMs(ts) {
  if (!ts) return 0
  if (typeof ts.toDate === 'function') return ts.toDate().getTime()
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).getTime()
  return 0
}

onMounted(async () => {
  try {
    const docs = await getAll(Collections.CONFIGURATIONS)
    if (docs.length) {
      // Always use the most recently saved doc to handle any accidental duplicate docs
      const sorted = docs.sort((a, b) => docTsMs(b.updatedAt) - docTsMs(a.updatedAt))
      configDocId = sorted[0].id
      const d = sorted[0]
      if (d.llm) config.value.llm = { ...config.value.llm, ...d.llm }
      if (d.company) config.value.company = { ...config.value.company, ...d.company }
      if (d.templates) config.value.templates = { ...config.value.templates, ...d.templates }
      if (d.enabledTabs) config.value.enabledTabs = { ...config.value.enabledTabs, ...d.enabledTabs }
      if (d.trackingRoles) config.value.trackingRoles = { ...config.value.trackingRoles, ...d.trackingRoles }
      if (d.maps) config.value.maps = { ...config.value.maps, ...d.maps }
      if (d.contractHtml !== undefined) config.value.contractHtml = d.contractHtml
      if (d.amcRenewalHtml !== undefined) config.value.amcRenewalHtml = d.amcRenewalHtml
      if (d.inspectionHtml !== undefined) config.value.inspectionHtml = d.inspectionHtml
      if (d.email) emailConfig.value = { ...emailConfig.value, ...d.email }
    }
  } catch (e) {
    console.error('Failed to load config:', e)
  }
})

async function saveAll() {
  saving.value = true
  try {
    const data = {
      llm: config.value.llm,
      company: config.value.company,
      templates: config.value.templates,
      contractHtml: config.value.contractHtml,
      amcRenewalHtml: config.value.amcRenewalHtml,
      inspectionHtml: config.value.inspectionHtml,
      enabledTabs: config.value.enabledTabs,
      trackingRoles: config.value.trackingRoles,
      maps: config.value.maps,
      email: emailConfig.value,
      updatedAt: new Date().toISOString(),
    }
    if (configDocId) {
      await update(Collections.CONFIGURATIONS, configDocId, data)
    } else {
      configDocId = await create(Collections.CONFIGURATIONS, data)
    }
    clearBillingPDFCache()
    activity.log({ action: 'updated', module: 'configurations', tab: 'Settings', summary: 'Saved app configurations', details: { llmProvider: config.value.llm?.provider, llmModel: config.value.llm?.model, companyName: config.value.company?.name, mapsProvider: config.value.maps?.provider } })
    ui.success('Configurations saved!')
    refreshCompany()
    refreshEnabledTabs()
    refreshTrackingConfig()
  } catch (e) {
    ui.error('Failed to save: ' + e.message)
  } finally {
    saving.value = false
  }
}

function uploadLogo(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => { config.value.company.logoUrl = e.target.result }
  reader.readAsDataURL(file)
}

function loadDefaultTemplate(key) {
  const defaults = {
    quotation: defaultQuotationTemplate(),
    proforma: defaultProformaTemplate(),
    invoice: defaultInvoiceTemplate(),
    taxInvoice: defaultTaxInvoiceTemplate(),
    purchaseOrder: defaultPOTemplate(),
    bom: defaultBOMTemplate(),
  }
  config.value.templates[key] = defaults[key] || ''
}

function previewTemplate(key) {
  const html = config.value.templates[key]
  if (!html) return ui.error('No template saved for this type — paste your HTML first, then click Preview.')
  const co = config.value.company
  const addr = [co.address, co.city, co.state, co.pincode].filter(Boolean).join(', ') || '123, Industrial Area, Navi Mumbai - 400001'
  const sampleItems = {
    taxInvoice: `<tr class="data-row"><td style="text-align:center;">1</td><td>Elevator Installation - 6 Floors</td><td style="text-align:center;">84861010</td><td style="text-align:center;">1</td><td style="text-align:right;">Rs. 84,746</td><td style="text-align:right;">Rs. 84,746</td></tr>`,
    proforma:   `<tr><td style="text-align:center;padding:5px;border-bottom:1px solid #000;">1</td><td style="padding:5px;border-bottom:1px solid #000;">Elevator Installation - 6 Floors</td><td style="text-align:center;padding:5px;border-bottom:1px solid #000;">1</td><td style="text-align:right;padding:5px;border-bottom:1px solid #000;">Rs. 84,746</td><td style="text-align:right;padding:5px;border-bottom:1px solid #000;">Rs. 84,746</td></tr>`,
    default:    `<tr><td>1</td><td>Elevator Installation - 6 Floors</td><td style="text-align:center;">1</td><td>nos</td><td style="text-align:right;">Rs. 84,746</td><td style="text-align:right;">Rs. 84,746</td></tr><tr><td>2</td><td>Control Panel &amp; Wiring</td><td style="text-align:center;">1</td><td>set</td><td style="text-align:right;">Rs. 4,000</td><td style="text-align:right;">Rs. 4,000</td></tr>`,
  }
  const itemsHtml = sampleItems[key] || sampleItems.default
  const sample = html
    // Company
    .replace(/\{\{company\.logo\}\}/g, `<img src="/static/logo.png" alt="Logo" style="max-height:55px;object-fit:contain;" onerror="this.style.display='none'">`)
    .replace(/\{\{company\.headerImg\}\}/g, '')
    .replace(/\{\{company\.name\}\}/g, co.name || 'Avant Elevators Pvt. Ltd.')
    .replace(/\{\{company\.tagline\}\}/g, co.tagline || 'Quality Elevators for Every Need')
    .replace(/\{\{company\.cin\}\}/g, co.cin || 'U45209MH2010PTC123456')
    .replace(/\{\{company\.address\}\}/g, addr)
    .replace(/\{\{company\.regAddress\}\}/g, co.regAddress || addr)
    .replace(/\{\{company\.city\}\}/g, co.city || 'Navi Mumbai')
    .replace(/\{\{company\.state\}\}/g, co.state || 'Maharashtra')
    .replace(/\{\{company\.pincode\}\}/g, co.pincode || '400001')
    .replace(/\{\{company\.gst\}\}/g, co.gst || '27ABCDE1234F1Z5')
    .replace(/\{\{company\.phone\}\}/g, co.phone || '+91 98765 43210')
    .replace(/\{\{company\.email\}\}/g, co.email || 'info@avantlifts.com')
    .replace(/\{\{company\.pan\}\}/g, co.pan || 'ABCDE1234F')
    .replace(/\{\{company\.website\}\}/g, co.website || '')
    .replace(/\{\{company\.bankName\}\}/g, co.bankName || 'HDFC Bank')
    .replace(/\{\{company\.bankBranch\}\}/g, co.bankBranch || 'Navi Mumbai')
    .replace(/\{\{company\.accountNo\}\}/g, co.accountNo || '1234567890')
    .replace(/\{\{company\.ifsc\}\}/g, co.ifsc || 'HDFC0001234')
    // Document
    .replace(/\{\{document\.number\}\}/g, key === 'quotation' ? 'Q-2024-001' : key === 'proforma' ? 'PI-2024-001' : key === 'taxInvoice' ? 'INV-2024-001' : 'DOC-2024-001')
    .replace(/\{\{document\.date\}\}/g, new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }))
    .replace(/\{\{document\.dueDate\}\}/g, '—')
    .replace(/\{\{document\.validity\}\}/g, '30 days')
    .replace(/\{\{document\.contractNo\}\}/g, 'CON-2024-001')
    .replace(/\{\{document\.refNo\}\}/g, 'Q-2024-001')
    .replace(/\{\{document\.refDate\}\}/g, new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }))
    // Client
    .replace(/\{\{client\.name\}\}/g, 'Sample Client Pvt. Ltd.')
    .replace(/\{\{client\.address\}\}/g, 'B-12, Commercial Complex, Sector 17, Navi Mumbai - 400706')
    .replace(/\{\{client\.gst\}\}/g, '27XYZDE1234F1Z5')
    .replace(/\{\{client\.state\}\}/g, 'Maharashtra')
    .replace(/\{\{client\.gstCode\}\}/g, '27')
    .replace(/\{\{client\.siteAddress\}\}/g, 'Plot No. 5, Industrial Estate, Thane - 400601')
    .replace(/\{\{client\.contactPerson\}\}/g, 'Mr. Rajesh Sharma')
    .replace(/\{\{client\.phone\}\}/g, '+91 98765 43210')
    .replace(/\{\{client\.contactPerson2\}\}/g, 'Ms. Priya Mehta')
    .replace(/\{\{client\.phone2\}\}/g, '+91 87654 32109')
    // Project
    .replace(/\{\{project\.name\}\}/g, 'Elevator Project - Block A')
    // Items
    .replace(/\{\{items\}\}/g, itemsHtml)
    // Amounts
    .replace(/\{\{subtotal\}\}/g, 'Rs. 84,746')
    .replace(/\{\{cgst\}\}/g, 'Rs. 7,627')
    .replace(/\{\{sgst\}\}/g, 'Rs. 7,627')
    .replace(/\{\{gst\}\}/g, '18%')
    .replace(/\{\{gstHalf\}\}/g, '9')
    .replace(/\{\{gstAmount\}\}/g, 'Rs. 15,254')
    .replace(/\{\{total\}\}/g, 'Rs. 1,00,000')
    .replace(/\{\{amountInWords\}\}/g, 'Rupees One Lakh Only')
    .replace(/\{\{notes\}\}/g, 'Payment due within 30 days.')
    .replace(/\{\{terms\}\}/g, 'Payment within 30 days of invoice date.')
    .replace(/\{\{prepared_by\}\}/g, '')
    .replace(/\{\{approved_by\}\}/g, '')
    .replace(/₹/g, 'Rs.')
  showPreview.value = true
  nextTick(() => {
    if (previewFrame.value) previewFrame.value.srcdoc = sample
  })
}

function defaultQuotationTemplate() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1e293b; background: #fff; width: 210mm; }
  /* Header */
  .hdr { background: #1e293b; padding: 18px 20mm 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .hdr img { max-height: 42px; max-width: 130px; object-fit: contain; display: block; margin-bottom: 7px; }
  .co-name { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .co-info { font-size: 10px; color: rgba(255,255,255,.68); line-height: 1.7; }
  .doc-r { text-align: right; flex-shrink: 0; }
  .doc-title { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: 2px; margin-bottom: 7px; }
  .doc-badge { background: #dc2626; color: #fff; font-size: 10.5px; font-weight: 700; padding: 2px 10px; border-radius: 3px; display: inline-block; }
  .doc-meta { font-size: 10px; color: rgba(255,255,255,.68); margin-top: 7px; line-height: 1.7; }
  /* Content */
  .body { padding: 18px 20mm 22mm; }
  /* Info cards */
  .info-row { display: flex; gap: 12px; margin-bottom: 18px; }
  .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 5px; padding: 10px 13px; background: #f8fafc; }
  .card.red { background: #fff5f5; border-color: #fecaca; }
  .card-lbl { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; margin-bottom: 5px; }
  .card-val { font-size: 13px; font-weight: 700; color: #1e293b; }
  .card-sub { font-size: 10.5px; color: #64748b; margin-top: 3px; line-height: 1.5; }
  /* Table */
  .items-wrap { margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead tr { background: #1e293b; }
  th { color: #fff; padding: 8.5px 10px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  /* Totals */
  .tot-row { display: flex; justify-content: flex-end; margin-bottom: 16px; }
  .tot { width: 268px; border-collapse: collapse; font-size: 11.5px; }
  .tot td { padding: 5.5px 12px; border-bottom: 1px solid #f1f5f9; }
  .tot td:last-child { text-align: right; font-weight: 600; }
  .tot .gt td { background: #dc2626; color: #fff; font-size: 13px; font-weight: 700; border: none; padding: 8px 12px; }
  /* Notes */
  .notes { border-left: 3px solid #cbd5e1; padding: 8px 12px; font-size: 11px; color: #64748b; background: #f8fafc; margin-bottom: 14px; border-radius: 0 4px 4px 0; }
  /* Bank */
  .bank { border: 1px solid #e2e8f0; border-radius: 5px; padding: 11px 14px; background: #f8fafc; margin-bottom: 18px; }
  .bank-hd { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; margin-bottom: 8px; }
  .bank-cols { display: flex; gap: 28px; flex-wrap: wrap; }
  .bi .bk { font-size: 9px; color: #94a3b8; }
  .bi .bv { font-size: 11.5px; font-weight: 600; color: #1e293b; margin-top: 1px; }
  /* Footer */
  .footer { border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig { text-align: center; }
  .sig-pad { height: 32px; }
  .sig-line { border-top: 1px solid #1e293b; padding-top: 4px; font-size: 11px; font-weight: 600; color: #1e293b; }
  .sig-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .contact-r { text-align: right; font-size: 10px; color: #94a3b8; line-height: 1.75; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="hdr">
  <div>
    {{company.logo}}
    <div class="co-name">{{company.name}}</div>
    <div class="co-info">{{company.address}}</div>
    <div class="co-info">Ph: {{company.phone}} | {{company.email}}</div>
    <div class="co-info">GST: {{company.gst}} | PAN: {{company.pan}}</div>
  </div>
  <div class="doc-r">
    <div class="doc-title">QUOTATION</div>
    <span class="doc-badge">No: {{document.number}}</span>
    <div class="doc-meta">Date: {{document.date}}<br>Valid Until: {{document.validity}}</div>
  </div>
</div>
<div class="body">
  <div class="info-row">
    <div class="card red">
      <div class="card-lbl">Bill To</div>
      <div class="card-val">{{client.name}}</div>
      <div class="card-sub">{{client.address}}</div>
      <div class="card-sub">GST: {{client.gst}}</div>
    </div>
    <div class="card">
      <div class="card-lbl">Project / Reference</div>
      <div class="card-val">{{project.name}}</div>
      <div class="card-sub">Validity: {{document.validity}}</div>
    </div>
  </div>
  <div class="items-wrap">
    <table>
      <thead><tr>
        <th style="width:28px">#</th>
        <th>Description</th>
        <th style="text-align:center;width:44px">Qty</th>
        <th style="width:46px">Unit</th>
        <th style="text-align:right;width:88px">Rate</th>
        <th style="text-align:right;width:90px">Amount</th>
      </tr></thead>
      <tbody>{{items}}</tbody>
    </table>
  </div>
  <div class="tot-row">
    <table class="tot">
      <tr><td>Subtotal</td><td>{{subtotal}}</td></tr>
      <tr><td>CGST</td><td>{{cgst}}</td></tr>
      <tr><td>SGST</td><td>{{sgst}}</td></tr>
      <tr class="gt"><td><strong>GRAND TOTAL</strong></td><td><strong>{{total}}</strong></td></tr>
    </table>
  </div>
  <div class="notes"><strong>Notes:</strong> {{notes}}</div>
  {{termsBlock}}
  {{paymentTermsBlock}}
  {{workScheduleBlock}}
  <div class="bank">
    <div class="bank-hd">Payment / Bank Details</div>
    <div class="bank-cols">
      <div class="bi"><div class="bk">Bank</div><div class="bv">{{company.bankName}}</div></div>
      <div class="bi"><div class="bk">Account No.</div><div class="bv">{{company.accountNo}}</div></div>
      <div class="bi"><div class="bk">IFSC Code</div><div class="bv">{{company.ifsc}}</div></div>
      <div class="bi"><div class="bk">GST No.</div><div class="bv">{{company.gst}}</div></div>
    </div>
  </div>
  <div class="footer">
    <div class="sig">
      <div class="sig-pad"></div>
      <div class="sig-line">Authorised Signatory</div>
      <div class="sig-sub">For {{company.name}}</div>
    </div>
    <div class="contact-r">{{company.website}}<br>{{company.phone}} | {{company.email}}</div>
  </div>
</div>
</body>
</html>`
}

function defaultProformaTemplate() {
  return defaultQuotationTemplate()
    .replace('<div class="doc-title">QUOTATION</div>', '<div class="doc-title">PROFORMA INVOICE</div>')
    .replace('<span class="doc-badge">No: {{document.number}}</span>', '<span class="doc-badge">PI No: {{document.number}}</span>')
}

function defaultInvoiceTemplate() {
  return defaultQuotationTemplate()
    .replace('<div class="doc-title">QUOTATION</div>', '<div class="doc-title">INVOICE</div>')
    .replace('<span class="doc-badge">No: {{document.number}}</span>', '<span class="doc-badge">Inv No: {{document.number}}</span>')
    .replace('Valid Until: {{document.validity}}', 'Due Date: {{document.dueDate}}')
}

function defaultTaxInvoiceTemplate() {
  return defaultQuotationTemplate()
    .replace('<div class="doc-title">QUOTATION</div>', '<div class="doc-title">TAX INVOICE</div>')
    .replace('<span class="doc-badge">No: {{document.number}}</span>', '<span class="doc-badge">Tax Inv: {{document.number}}</span>')
}

function defaultPOTemplate() {
  return defaultQuotationTemplate()
    .replace('<div class="doc-title">QUOTATION</div>', '<div class="doc-title">PURCHASE ORDER</div>')
    .replace('<span class="doc-badge">No: {{document.number}}</span>', '<span class="doc-badge">PO No: {{document.number}}</span>')
    .replace('<div class="card-lbl">Bill To</div>', '<div class="card-lbl">Vendor</div>')
    .replace('<div class="card-lbl">Project / Reference</div>', '<div class="card-lbl">Delivery / Reference</div>')
}

function defaultBOMTemplate() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1e293b; background: #fff; width: 210mm; }
  .hdr { background: #1e293b; padding: 18px 20mm 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .hdr img { max-height: 42px; max-width: 130px; object-fit: contain; display: block; margin-bottom: 7px; }
  .co-name { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .co-info { font-size: 10px; color: rgba(255,255,255,.68); line-height: 1.7; }
  .doc-r { text-align: right; flex-shrink: 0; }
  .doc-title { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: 2px; margin-bottom: 7px; }
  .doc-badge { background: #dc2626; color: #fff; font-size: 10.5px; font-weight: 700; padding: 2px 10px; border-radius: 3px; display: inline-block; }
  .doc-meta { font-size: 10px; color: rgba(255,255,255,.68); margin-top: 7px; line-height: 1.7; }
  .body { padding: 18px 20mm 22mm; }
  .info-row { display: flex; gap: 12px; margin-bottom: 18px; }
  .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 5px; padding: 10px 13px; background: #f8fafc; }
  .card-lbl { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; margin-bottom: 5px; }
  .card-val { font-size: 13px; font-weight: 700; color: #1e293b; }
  .card-sub { font-size: 10.5px; color: #64748b; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px; }
  thead tr { background: #1e293b; }
  th { color: #fff; padding: 8.5px 10px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .gt-row { display: flex; justify-content: flex-end; margin-bottom: 18px; }
  .gt-box { background: #dc2626; color: #fff; font-size: 14px; font-weight: 700; padding: 9px 18px; border-radius: 4px; }
  .notes { border-left: 3px solid #cbd5e1; padding: 8px 12px; font-size: 11px; color: #64748b; background: #f8fafc; margin-bottom: 18px; border-radius: 0 4px 4px 0; }
  .footer { border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig { text-align: center; }
  .sig-pad { height: 32px; }
  .sig-line { border-top: 1px solid #1e293b; padding-top: 4px; font-size: 11px; font-weight: 600; color: #1e293b; }
  .sig-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .contact-r { text-align: right; font-size: 10px; color: #94a3b8; line-height: 1.75; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="hdr">
  <div>
    {{company.logo}}
    <div class="co-name">{{company.name}}</div>
    <div class="co-info">{{company.address}}</div>
    <div class="co-info">Ph: {{company.phone}} | {{company.email}}</div>
    <div class="co-info">GST: {{company.gst}} | PAN: {{company.pan}}</div>
  </div>
  <div class="doc-r">
    <div class="doc-title">BILL OF MATERIALS</div>
    <span class="doc-badge">BOM No: {{document.number}}</span>
    <div class="doc-meta">Date: {{document.date}}<br>Project: {{project.name}}</div>
  </div>
</div>
<div class="body">
  <div class="info-row">
    <div class="card">
      <div class="card-lbl">Prepared For</div>
      <div class="card-val">{{client.name}}</div>
      <div class="card-sub">{{client.address}}</div>
    </div>
    <div class="card">
      <div class="card-lbl">Project</div>
      <div class="card-val">{{project.name}}</div>
      <div class="card-sub">Date: {{document.date}}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th style="width:28px">#</th>
      <th>Part / Material</th>
      <th style="width:88px">Part No.</th>
      <th style="text-align:center;width:42px">Qty</th>
      <th style="width:44px">Unit</th>
      <th style="text-align:right;width:86px">Unit Cost</th>
      <th style="text-align:right;width:90px">Total Cost</th>
    </tr></thead>
    <tbody>{{items}}</tbody>
  </table>
  <div class="gt-row"><div class="gt-box">Grand Total: {{total}}</div></div>
  <div class="notes"><strong>Notes:</strong> {{notes}}</div>
  <div class="footer">
    <div class="sig">
      <div class="sig-pad"></div>
      <div class="sig-line">Authorised Signatory</div>
      <div class="sig-sub">For {{company.name}}</div>
    </div>
    <div class="contact-r">{{company.website}}<br>{{company.phone}} | {{company.email}}</div>
  </div>
</div>
</body>
</html>`
}

// ── Checklist Management ──────────────────────────────────────────────────────
const { items: checklistItems, loading: checklistLoading, add: addChecklistItemFn, edit: editChecklistItemFn, del: delChecklistItemFn } = useCollection(Collections.CHECKLIST_ITEMS)
const showChecklistModal = ref(false)
const editingChecklistItem = ref(null)
const savingChecklist = ref(false)
const loadingDefaults = ref(false)
const checklistForm = ref({ title: '', description: '', section: 'A' })

const CHECKLIST_SECTIONS = ['A', 'B', 'C', 'D']
const checklistBySection = computed(() => {
  const out = { A: [], B: [], C: [], D: [] }
  for (const item of checklistItems.value) {
    const s = item.section || 'A'
    if (out[s]) out[s].push(item)
  }
  return out
})

const DEFAULT_CHECKLIST_ITEMS = [
  // Section A — General Inspection (OK/Not OK)
  { section: 'A', order: 1,  title: 'Machine room clean and tidy', description: '' },
  { section: 'A', order: 2,  title: 'Fire extinguisher present and valid', description: '' },
  { section: 'A', order: 3,  title: 'Machine room door self-closing and locking properly', description: '' },
  { section: 'A', order: 4,  title: 'Lighting adequate in machine room', description: '' },
  { section: 'A', order: 5,  title: 'Rope condition – no broken strands', description: '' },
  { section: 'A', order: 6,  title: 'Rope lubrication adequate', description: '' },
  { section: 'A', order: 7,  title: 'Governor rope condition OK', description: '' },
  { section: 'A', order: 8,  title: 'Speed governor operation OK', description: '' },
  { section: 'A', order: 9,  title: 'Safety gear tested and working', description: '' },
  { section: 'A', order: 10, title: 'Brake adjustment – stopping smoothly', description: '' },
  { section: 'A', order: 11, title: 'Brake linings – adequate thickness', description: '' },
  { section: 'A', order: 12, title: 'Motor temperature normal during operation', description: '' },
  { section: 'A', order: 13, title: 'Oil level in gearbox adequate', description: '' },
  { section: 'A', order: 14, title: 'No oil leakage from gearbox', description: '' },
  { section: 'A', order: 15, title: 'Motor insulation resistance OK', description: '' },
  { section: 'A', order: 16, title: 'Control panel clean and tidy', description: '' },
  { section: 'A', order: 17, title: 'All fuses and contactors in good condition', description: '' },
  { section: 'A', order: 18, title: 'Emergency stop switches functioning', description: '' },
  { section: 'A', order: 19, title: 'Limit switches functioning properly', description: '' },
  { section: 'A', order: 20, title: 'Overload relay functioning', description: '' },
  { section: 'A', order: 21, title: 'Earthing connections secure', description: '' },
  { section: 'A', order: 22, title: 'Phase sequence protected', description: '' },
  { section: 'A', order: 23, title: 'Intercom / alarm bell working', description: '' },
  { section: 'A', order: 24, title: 'Emergency lighting in car working', description: '' },
  { section: 'A', order: 25, title: 'Car lighting functioning', description: '' },
  { section: 'A', order: 26, title: 'Fan / ventilation in car working', description: '' },
  { section: 'A', order: 27, title: 'Floor level accuracy (levelling) OK', description: '' },
  { section: 'A', order: 28, title: 'Automatic rescue device (ARD) working', description: '' },
  { section: 'A', order: 29, title: 'Door open / close speed normal', description: '' },
  { section: 'A', order: 30, title: 'Car door safety edge working', description: '' },
  { section: 'A', order: 31, title: 'Hall door mechanical locks working', description: '' },
  { section: 'A', order: 32, title: 'Pit condition – clean and dry', description: '' },
  // Section B — Cleaning (Done/Not Done)
  { section: 'B', order: 1,  title: 'Machine room cleaned', description: '' },
  { section: 'B', order: 2,  title: 'Ropes wiped clean', description: '' },
  { section: 'B', order: 3,  title: 'Guide rails cleaned', description: '' },
  { section: 'B', order: 4,  title: 'Car interior cleaned', description: '' },
  { section: 'B', order: 5,  title: 'Car door sill cleaned', description: '' },
  { section: 'B', order: 6,  title: 'Landing door sill cleaned (all floors)', description: '' },
  { section: 'B', order: 7,  title: 'Buffer cleaned and greased', description: '' },
  { section: 'B', order: 8,  title: 'Pit cleaned', description: '' },
  { section: 'B', order: 9,  title: 'Control panel dusted', description: '' },
  { section: 'B', order: 10, title: 'Door operator cleaned', description: '' },
  // Section C — Lubrication (Done/Not Done)
  { section: 'C', order: 1,  title: 'Guide rail lubrication done', description: '' },
  { section: 'C', order: 2,  title: 'Door operator gears lubricated', description: '' },
  { section: 'C', order: 3,  title: 'Rope lubrication done (if fiber core)', description: '' },
  { section: 'C', order: 4,  title: 'Buffer spring lubricated', description: '' },
  { section: 'C', order: 5,  title: 'Landing door hinges lubricated', description: '' },
  { section: 'C', order: 6,  title: 'Car door hangers lubricated', description: '' },
  { section: 'C', order: 7,  title: 'Gearbox oil level topped up', description: '' },
  { section: 'C', order: 8,  title: 'Governor rope lubricated', description: '' },
  { section: 'C', order: 9,  title: 'Safety gear pivot pins lubricated', description: '' },
  { section: 'C', order: 10, title: 'Pit buffer lubricated', description: '' },
  // Section D — Periodic Safety Check (OK/Not OK)
  { section: 'D', order: 1,  title: 'Emergency stop at machine room working', description: '' },
  { section: 'D', order: 2,  title: 'Car emergency stop button working', description: '' },
  { section: 'D', order: 3,  title: 'Safety gear drops correctly on governor trip', description: '' },
  { section: 'D', order: 4,  title: 'Pit stop switch working', description: '' },
  { section: 'D', order: 5,  title: 'Final limit switch – top functioning', description: '' },
  { section: 'D', order: 6,  title: 'Final limit switch – bottom functioning', description: '' },
  { section: 'D', order: 7,  title: 'Door operator torque settings OK', description: '' },
  { section: 'D', order: 8,  title: 'Car load within rated capacity', description: '' },
  { section: 'D', order: 9,  title: 'Counterweight clearance adequate', description: '' },
  { section: 'D', order: 10, title: 'Guide shoe condition OK', description: '' },
  { section: 'D', order: 11, title: 'Shock absorber / buffer condition OK', description: '' },
  { section: 'D', order: 12, title: 'Suspension rope terminations secure', description: '' },
  { section: 'D', order: 13, title: 'Car frame bolts secure', description: '' },
  { section: 'D', order: 14, title: 'Inspection control panel (car top) working', description: '' },
  { section: 'D', order: 15, title: 'Overload device calibrated and working', description: '' },
  { section: 'D', order: 16, title: 'Door lock contacts confirmed working', description: '' },
  { section: 'D', order: 17, title: 'Position indicator working (if applicable)', description: '' },
  { section: 'D', order: 18, title: 'Floor selector accuracy verified', description: '' },
  { section: 'D', order: 19, title: 'Emergency key operation verified', description: '' },
  { section: 'D', order: 20, title: 'Lift license displayed inside cabin (PWD mandatory)', description: '' },
]

function openAddChecklistItem() {
  editingChecklistItem.value = null
  checklistForm.value = { title: '', description: '', section: 'A' }
  showChecklistModal.value = true
}

function openEditChecklistItem(item) {
  editingChecklistItem.value = item
  checklistForm.value = { title: item.title || '', description: item.description || '', section: item.section || 'A' }
  showChecklistModal.value = true
}

async function saveChecklistItem() {
  if (!checklistForm.value.title.trim()) return
  savingChecklist.value = true
  try {
    const data = { title: checklistForm.value.title.trim(), description: checklistForm.value.description.trim(), section: checklistForm.value.section || 'A' }
    if (editingChecklistItem.value) {
      await editChecklistItemFn(editingChecklistItem.value.id, data)
      ui.success('Item updated.')
    } else {
      await addChecklistItemFn({ ...data, order: (checklistBySection.value[data.section]?.length || 0) + 1 })
      ui.success('Item added.')
    }
    showChecklistModal.value = false
  } catch (e) {
    ui.error('Failed to save item.')
  } finally {
    savingChecklist.value = false
  }
}

async function deleteChecklistItem(item) {
  try {
    await delChecklistItemFn(item.id)
    ui.success('Item deleted.')
  } catch {
    ui.error('Failed to delete item.')
  }
}

async function loadDefaultChecklist() {
  if (!confirm(`This will add all ${DEFAULT_CHECKLIST_ITEMS.length} standard checklist items (Sections A–D). Existing items will NOT be deleted. Continue?`)) return
  loadingDefaults.value = true
  try {
    for (const item of DEFAULT_CHECKLIST_ITEMS) {
      await addChecklistItemFn(item)
    }
    ui.success(`${DEFAULT_CHECKLIST_ITEMS.length} default checklist items loaded!`)
  } catch (e) {
    ui.error('Failed to load defaults: ' + e.message)
  } finally {
    loadingDefaults.value = false
  }
}
</script>

<style scoped>
/* ── Map provider buttons ───────────────────────────────────────────── */
.map-provider-btn {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  cursor: pointer;
  text-align: left;
  min-width: 180px;
  flex: 1;
  max-width: 260px;
  transition: all 0.15s;
  color: var(--ct-sub);
}
.map-provider-btn:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.15);
}
.map-provider-btn.active {
  background: rgba(99,102,241,0.12);
  border-color: rgba(99,102,241,0.4);
  color: var(--ct-primary);
}

/* ── Nav tab toggles ─────────────────────────────────────────────────── */
.navtabs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.navtab-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: var(--ct-surface, rgba(255,255,255,.03));
  border: 1px solid var(--ct-border); border-radius: 10px;
}
.navtab-label { flex: 1; font-size: 13px; color: var(--ct-sub); font-weight: 500; }
.toggle-state { font-size: 11px; font-weight: 600; min-width: 44px; text-align: right; }
.toggle-switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-track {
  position: absolute; inset: 0;
  background: rgba(255,255,255,.1); border-radius: 11px;
  cursor: pointer; transition: background .2s;
  border: 1px solid rgba(255,255,255,.1);
}
.toggle-switch input:checked + .toggle-track { background: #22c55e; border-color: #22c55e; }
.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform .2s;
}
.toggle-switch input:checked + .toggle-track .toggle-thumb { transform: translateX(18px); }

.provider-info-card {
  padding: 14px 16px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.7;
  border: 1px solid;
}
.provider-groq {
  background: rgba(99,102,241,0.06);
  border-color: rgba(99,102,241,0.2);
  color: var(--ct-sub);
}
.provider-openrouter {
  background: rgba(34,197,94,0.05);
  border-color: rgba(34,197,94,0.2);
  color: var(--ct-sub);
}

.config-view { padding: 0; }

.config-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding-bottom: 0;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.config-tabs::-webkit-scrollbar { height: 6px; }
.config-tabs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }

.config-tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color:var(--ct-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
  border-radius: 8px 8px 0 0;
  white-space: nowrap;
  flex-shrink: 0;
}
.config-tab:hover { color:var(--ct-sub); }
.config-tab.active { color:var(--ct-accent); border-bottom-color: #6366f1; background: rgba(99,102,241,0.06); }

.config-section {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 24px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 22px;
  color: #6366f1;
}
.section-title { font-size: 15px; font-weight: 600; color:var(--ct-primary); }
.section-sub { font-size: 12px; color:var(--ct-muted); margin-top: 2px; }

.template-tab {
  padding: 6px 14px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  background: transparent;
  color:var(--ct-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s;
}
.template-tab:hover { color:var(--ct-sub); border-color: rgba(255,255,255,0.15); }
.template-tab.active { background: rgba(99,102,241,0.15); color:var(--ct-accent); border-color: rgba(99,102,241,0.3); }

.template-editor { font-family: 'Courier New', monospace !important; }

/* Light theme */
[data-theme="light"] .config-section { background: rgba(255,255,255,0.9); border-color: rgba(0,0,0,0.08); }
[data-theme="light"] .config-tab { color:var(--ct-muted); }
[data-theme="light"] .config-tab.active { color: #4f46e5; background: rgba(99,102,241,0.06); }
[data-theme="light"] .config-tabs::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); }
[data-theme="light"] .section-title { color: #1e293b; }
[data-theme="light"] .template-tab { border-color: rgba(0,0,0,0.12); color:var(--ct-muted); }
[data-theme="light"] .template-tab.active { background: rgba(99,102,241,0.1); color: #4f46e5; }
</style>
