# Universal SMTP Mailer — Implementation Guide

## Connection Details

```bash
export MAILER_URL=https://x4m2x4kscj.execute-api.ap-south-1.amazonaws.com/v1
export MAILER_API_KEY=Ambivare@9822091922
```

---

## Authentication

Every request (except `GET /health`) requires the API key in the header:

```
X-API-Key: Ambivare@9822091922
```

Or alternatively:

```
Authorization: Bearer Ambivare@9822091922
```

---

## Supported Email Providers

Pass `"provider"` with any of these names — the engine tries every host and port automatically:

| Alias | Provider |
|-------|----------|
| `zoho` | Zoho Mail (all regions: .com .in .eu .com.au .jp) |
| `gmail` | Gmail / Google Workspace |
| `outlook` | Outlook / Hotmail / Live |
| `office365` | Microsoft Office 365 |
| `yahoo` | Yahoo Mail |
| `godaddy` | GoDaddy / Secureserver |
| `hostinger` | Hostinger Mail |
| `namecheap` | Namecheap PrivateEmail |
| `ses` | Amazon SES (all 17 regions) |
| `sendgrid` | SendGrid |
| `mailgun` | Mailgun |
| `fastmail` | Fastmail |
| `icloud` | Apple iCloud Mail |
| `titan` | Titan Email |
| `postmark` | Postmark |
| `bluehost` | Bluehost |
| `siteground` | SiteGround |
| `rackspace` | Rackspace Email |
| `ovh` | OVH Mail |
| `gmx` | GMX Mail |

> Full alias list: `GET /providers`

---

## API Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Health check (no auth) |
| `GET` | `/providers` | List all providers + aliases |
| `GET` | `/templates` | List built-in templates |
| `POST` | `/send` | Send any email |
| `POST` | `/otp` | Send OTP code email |
| `POST` | `/bulk` | Send up to 50 emails in one call |
| `POST` | `/verify` | Test SMTP credentials (no email sent) |
| `POST` | `/template/preview` | Render a template without sending |

---

## 1. Plain Text Email

**cURL**
```bash
curl -X POST $MAILER_URL/send \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "email": "operations@ambivare.com",
      "password": "YOUR_APP_PASSWORD"
    },
    "provider": "zoho",
    "mail": {
      "to": "customer@example.com",
      "subject": "Hello from Ambivare",
      "text": "This is a plain text email."
    }
  }'
```

**JavaScript (Node.js / Browser fetch)**
```js
const res = await fetch(`${MAILER_URL}/send`, {
  method: 'POST',
  headers: {
    'X-API-Key': MAILER_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    credentials: { email: 'operations@ambivare.com', password: 'YOUR_APP_PASSWORD' },
    provider: 'zoho',
    mail: {
      to: 'customer@example.com',
      subject: 'Hello from Ambivare',
      text: 'This is a plain text email.',
    },
  }),
});
const data = await res.json();
console.log(data); // { success: true, messageId: '...', usedConfig: {...} }
```

**Python**
```python
import requests

response = requests.post(
    f"{MAILER_URL}/send",
    headers={"X-API-Key": MAILER_API_KEY},
    json={
        "credentials": {"email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD"},
        "provider": "zoho",
        "mail": {
            "to": "customer@example.com",
            "subject": "Hello from Ambivare",
            "text": "This is a plain text email.",
        },
    },
)
print(response.json())
```

**PHP**
```php
$response = file_get_contents($MAILER_URL . '/send', false, stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => "X-API-Key: {$MAILER_API_KEY}\r\nContent-Type: application/json",
        'content' => json_encode([
            'credentials' => ['email' => 'operations@ambivare.com', 'password' => 'YOUR_APP_PASSWORD'],
            'provider'    => 'zoho',
            'mail'        => [
                'to'      => 'customer@example.com',
                'subject' => 'Hello from Ambivare',
                'text'    => 'This is a plain text email.',
            ],
        ]),
    ],
]));
echo $response;
```

---

## 2. HTML Email

```bash
curl -X POST $MAILER_URL/send \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho",
    "mail": {
      "to": "customer@example.com",
      "subject": "Welcome to Ambivare",
      "html": "<h1 style=\"color:#6366f1\">Welcome!</h1><p>Thanks for joining us.</p>"
    }
  }'
```

---

## 3. HTML Email with Dynamic Placeholders

Use `{{variableName}}` anywhere in your HTML and pass values in `templateData`:

```bash
curl -X POST $MAILER_URL/send \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho",
    "mail": {
      "to": "customer@example.com",
      "subject": "Order {{orderId}} confirmed",
      "html": "<h2>Hi {{name}}!</h2><p>Your order <b>#{{orderId}}</b> of <b>{{product}}</b> has been confirmed. Total: <b>{{amount}}</b></p>",
      "templateData": {
        "name": "Rahul",
        "orderId": "ORD-9921",
        "product": "Ambivare Pro Plan",
        "amount": "₹2,999"
      }
    }
  }'
```

**JavaScript with full custom HTML template:**
```js
const htmlTemplate = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f4f6fb;padding:40px">
  <div style="background:#fff;max-width:500px;margin:auto;padding:32px;border-radius:12px">
    <h2 style="color:#4f46e5">Hello {{customerName}}!</h2>
    <p>Your subscription to <strong>{{plan}}</strong> is now active.</p>
    <p>Next billing: <strong>{{nextBilling}}</strong></p>
    <a href="{{dashboardUrl}}" style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px">
      Go to Dashboard
    </a>
  </div>
</body>
</html>`;

await fetch(`${MAILER_URL}/send`, {
  method: 'POST',
  headers: { 'X-API-Key': MAILER_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: { email: 'operations@ambivare.com', password: 'YOUR_APP_PASSWORD' },
    provider: 'zoho',
    mail: {
      to: 'customer@example.com',
      subject: 'Your Ambivare subscription is active',
      html: htmlTemplate,
      templateData: {
        customerName: 'Rahul',
        plan: 'Pro Annual',
        nextBilling: '20 June 2027',
        dashboardUrl: 'https://app.ambivare.com/dashboard',
      },
    },
  }),
});
```

---

## 4. OTP Email (Built-in Template)

Use the dedicated `/otp` endpoint — generates a professional OTP email automatically:

```bash
curl -X POST $MAILER_URL/otp \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho",
    "to": "user@example.com",
    "toName": "Rahul Sharma",
    "otp": "847291",
    "appName": "Ambivare",
    "validity": 10,
    "purpose": "login verification"
  }'
```

**Node.js — generate OTP and send:**
```js
function generateOTP(length = 6) {
  return Math.floor(10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1)).toString();
}

async function sendOTP(userEmail, userName) {
  const otp = generateOTP(6);

  // Save OTP to your DB with expiry before sending
  await db.otps.create({ email: userEmail, code: otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  await fetch(`${MAILER_URL}/otp`, {
    method: 'POST',
    headers: { 'X-API-Key': MAILER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentials: { email: 'operations@ambivare.com', password: process.env.ZOHO_APP_PASSWORD },
      provider: 'zoho',
      to: userEmail,
      toName: userName,
      otp,
      appName: 'Ambivare',
      validity: 10,
      purpose: 'login verification',
    }),
  });

  return otp;
}
```

**Python:**
```python
import random, requests

def send_otp(user_email, user_name):
    otp = str(random.randint(100000, 999999))

    requests.post(f"{MAILER_URL}/otp",
        headers={"X-API-Key": MAILER_API_KEY},
        json={
            "credentials": {"email": "operations@ambivare.com", "password": ZOHO_APP_PASSWORD},
            "provider": "zoho",
            "to": user_email,
            "toName": user_name,
            "otp": otp,
            "appName": "Ambivare",
            "validity": 10,
            "purpose": "account verification",
        }
    )
    return otp
```

---

## 5. Built-in Templates

### Welcome Email
```bash
curl -X POST $MAILER_URL/send \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho",
    "mail": {
      "to": "newuser@example.com",
      "subject": "Welcome to Ambivare!",
      "template": "welcome",
      "templateData": {
        "appName": "Ambivare",
        "toName": "Rahul",
        "ctaUrl": "https://app.ambivare.com/onboarding",
        "ctaText": "Get Started",
        "tagline": "Build something amazing",
        "features": [
          "Access to all tools",
          "Priority support",
          "Team collaboration"
        ]
      }
    }
  }'
```

### Password Reset Email
```bash
curl -X POST $MAILER_URL/send \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho",
    "mail": {
      "to": "user@example.com",
      "subject": "Reset your Ambivare password",
      "template": "reset-password",
      "templateData": {
        "appName": "Ambivare",
        "toName": "Rahul",
        "resetUrl": "https://app.ambivare.com/reset?token=abc123xyz",
        "validity": 30,
        "ipAddress": "103.21.58.1"
      }
    }
  }'
```

### Notification Email (info / success / warning / error)
```bash
curl -X POST $MAILER_URL/send \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho",
    "mail": {
      "to": "user@example.com",
      "subject": "Payment received!",
      "template": "notification",
      "templateData": {
        "appName": "Ambivare",
        "toName": "Rahul",
        "title": "Payment Received",
        "message": "We have received your payment successfully. Your account is now active.",
        "type": "success",
        "ctaUrl": "https://app.ambivare.com/billing",
        "ctaText": "View Receipt",
        "metaItems": [
          { "label": "Amount", "value": "₹2,999" },
          { "label": "Plan", "value": "Ambivare Pro" },
          { "label": "Transaction ID", "value": "TXN-88421" },
          { "label": "Date", "value": "20 June 2026" }
        ]
      }
    }
  }'
```

> `type` can be: `info` (purple) · `success` (green) · `warning` (yellow) · `error` (red)

### Invoice Email
```bash
curl -X POST $MAILER_URL/send \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho",
    "mail": {
      "to": "client@example.com",
      "subject": "Invoice #INV-2026-001 from Ambivare",
      "template": "invoice",
      "templateData": {
        "appName": "Ambivare",
        "toName": "Rahul Sharma",
        "invoiceNo": "INV-2026-001",
        "invoiceDate": "20 June 2026",
        "dueDate": "27 June 2026",
        "currency": "INR",
        "items": [
          { "name": "Ambivare Pro Plan (Annual)", "qty": 1, "unitPrice": "2,999", "amount": "2,999" },
          { "name": "Setup & Onboarding", "qty": 1, "unitPrice": "500", "amount": "500" }
        ],
        "subtotal": "3,499",
        "tax": "629.82",
        "total": "4,128.82",
        "paymentUrl": "https://pay.ambivare.com/inv/2026-001",
        "notes": "Thank you for choosing Ambivare. Payment due within 7 days."
      }
    }
  }'
```

---

## 6. File Attachments

**Yes — fully supported. No code changes required. Three methods available:**

| Method | How | Best for |
|--------|-----|----------|
| **URL (`href`)** | Pass the file's URL — Lambda fetches it automatically | S3, Cloudinary, Firebase, Supabase, any CDN |
| **Base64 (`content`)** | Encode file to base64 string and pass inline | Apps that already have file bytes in memory |
| **Local file via curl** | Use `base64` command in terminal to encode on the fly | Quick manual sends from a machine |

---

### Method 1 — URL Attachment (Lambda fetches the file for you)

> **No code changes needed.** The Lambda already fetches any URL and attaches the file automatically. Works with S3 pre-signed URLs, Cloudinary, Firebase Storage, Supabase Storage, Google Cloud Storage, any direct download link.

```bash
curl -X POST $MAILER_URL/send \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho",
    "mail": {
      "to": "client@example.com",
      "subject": "Your Invoice",
      "html": "<p>Please find your invoice attached.</p>",
      "attachments": [
        {
          "filename": "invoice.pdf",
          "href": "https://your-s3-bucket.s3.amazonaws.com/invoices/invoice-9921.pdf"
        }
      ]
    }
  }'
```

**JavaScript (any backend using document storage):**
```js
// Your app already has the file URL — just pass it directly
const documentUrl = await storage.getSignedUrl('invoices/INV-9921.pdf'); // S3, Firebase, Supabase etc.

await fetch(`${MAILER_URL}/send`, {
  method: 'POST',
  headers: { 'X-API-Key': MAILER_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: { email: 'operations@ambivare.com', password: process.env.ZOHO_APP_PASSWORD },
    provider: 'zoho',
    mail: {
      to: 'client@example.com',
      subject: 'Your Invoice #INV-9921',
      template: 'invoice',
      templateData: { appName: 'Ambivare', toName: 'Rahul', total: '2999', currency: 'INR', items: [...] },
      attachments: [
        {
          filename: 'Invoice-INV-9921.pdf',
          href: documentUrl,                    // Lambda fetches this URL itself
        }
      ],
    },
  }),
});
```

**Python (Django / FastAPI):**
```python
# Get a fresh URL from your storage provider
document_url = s3_client.generate_presigned_url('get_object',
    Params={'Bucket': 'ambivare-docs', 'Key': f'invoices/{invoice_id}.pdf'},
    ExpiresIn=300  # 5 minutes is plenty — Lambda fetches it immediately
)

requests.post(f'{MAILER_URL}/send',
    headers={'X-API-Key': MAILER_API_KEY},
    json={
        'credentials': {'email': 'operations@ambivare.com', 'password': ZOHO_APP_PASSWORD},
        'provider': 'zoho',
        'mail': {
            'to': client_email,
            'subject': f'Invoice #{invoice_id}',
            'html': '<p>Your invoice is attached.</p>',
            'attachments': [{'filename': f'{invoice_id}.pdf', 'href': document_url}],
        },
    }
)
```

#### Expiring URLs — how to handle them

If your storage generates pre-signed URLs with short expiry times (S3, Firebase, GCS, Supabase), the pattern is:

```
Your app  →  Generate fresh URL  →  Pass href to mailer API  →  Lambda fetches immediately
```

The Lambda fetches the file the moment it receives the request — typically within 1–2 seconds. So even a 60-second expiry URL works fine. **Generate the URL right before calling the API, not hours in advance.**

```js
// ✅ Correct — generate URL just before sending
const freshUrl = await bucket.file('contract.pdf').getSignedUrl({ expires: Date.now() + 60000 });
await sendEmailWithAttachment(freshUrl);

// ❌ Wrong — URL may expire before email is sent
const cachedUrl = db.getStoredUrl(); // generated 2 hours ago
await sendEmailWithAttachment(cachedUrl);
```

**Supported URL types:**
- AWS S3 pre-signed URLs
- Google Cloud Storage signed URLs
- Firebase Storage download URLs
- Supabase Storage URLs
- Cloudinary URLs
- Any direct HTTPS download link (PDF, image, DOCX, etc.)

---

### Method 2 — Base64 Attachment (file bytes in your app memory)

Use this when your app already has the file content in memory (generated PDF, processed image, etc.):

**JavaScript:**
```js
const fs = require('fs');
const pdfBase64 = fs.readFileSync('./invoice.pdf').toString('base64');

attachments: [{
  filename: 'invoice.pdf',
  content: pdfBase64,
  encoding: 'base64',
  contentType: 'application/pdf',
}]
```

**Python:**
```python
import base64
with open('invoice.pdf', 'rb') as f:
    pdf_b64 = base64.b64encode(f.read()).decode()

attachments=[{
    'filename': 'invoice.pdf',
    'content': pdf_b64,
    'encoding': 'base64',
    'contentType': 'application/pdf',
}]
```

---

### Method 3 — Local File via curl (terminal / shell scripts)

Run this command **from the folder where your file is** — no code changes, no server needed:

**Linux / Mac / CloudShell:**
```bash
# Navigate to the folder containing your file
cd /path/to/your/documents

# Send with attachment — base64 is encoded inline by the shell
curl -X POST $MAILER_URL/send \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- << EOF
{
  "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
  "provider": "zoho",
  "mail": {
    "to": "client@example.com",
    "subject": "Your document",
    "text": "Please find your document attached.",
    "attachments": [{
      "filename": "report.pdf",
      "content": "$(base64 -w 0 report.pdf)",
      "encoding": "base64",
      "contentType": "application/pdf"
    }]
  }
}
EOF
```

**Windows PowerShell:**
```powershell
$pdf = [Convert]::ToBase64String([IO.File]::ReadAllBytes(".\invoice.pdf"))
$body = @{
  credentials = @{ email = "operations@ambivare.com"; password = "YOUR_APP_PASSWORD" }
  provider = "zoho"
  mail = @{
    to = "client@example.com"
    subject = "Your Invoice"
    text = "Attached."
    attachments = @(@{
      filename = "invoice.pdf"
      content = $pdf
      encoding = "base64"
      contentType = "application/pdf"
    })
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$MAILER_URL/send" -Method POST `
  -Headers @{ "X-API-Key" = $MAILER_API_KEY; "Content-Type" = "application/json" } `
  -Body $body
```

---

### Multiple Attachments (any method, mix and match)

```js
attachments: [
  // From URL — Lambda fetches it
  { filename: 'invoice.pdf',   href: 'https://s3.amazonaws.com/bucket/invoice.pdf' },

  // From base64 — already in memory
  { filename: 'receipt.png',   content: receiptBase64, encoding: 'base64', contentType: 'image/png' },

  // Another URL
  { filename: 'contract.docx', href: 'https://storage.googleapis.com/bucket/contract.docx?token=...' },
]
```

**Supported file types:** PDF, PNG, JPG, DOCX, XLSX, CSV, ZIP, TXT, MP4 — any file type works.

---

## 7. Bulk Email (up to 50 per call)

```bash
curl -X POST $MAILER_URL/bulk \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho",
    "delayMs": 300,
    "emails": [
      {
        "mail": {
          "to": "user1@example.com",
          "subject": "Your monthly report",
          "template": "notification",
          "templateData": { "appName": "Ambivare", "toName": "Rahul", "title": "Report Ready", "message": "Your June report is ready.", "type": "info" }
        }
      },
      {
        "mail": {
          "to": "user2@example.com",
          "subject": "Your monthly report",
          "template": "notification",
          "templateData": { "appName": "Ambivare", "toName": "Priya", "title": "Report Ready", "message": "Your June report is ready.", "type": "info" }
        }
      }
    ]
  }'
```

---

## 8. Verify SMTP Credentials

Test if your email + password are working before going to production:

```bash
curl -X POST $MAILER_URL/verify \
  -H "X-API-Key: $MAILER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "email": "operations@ambivare.com", "password": "YOUR_APP_PASSWORD" },
    "provider": "zoho"
  }'
```

---

## 9. Multiple Recipients / CC / BCC

```js
mail: {
  to: ['user1@example.com', 'user2@example.com'],   // array or comma string
  cc: 'manager@ambivare.com',
  bcc: 'archive@ambivare.com',
  replyTo: 'support@ambivare.com',
  subject: 'Team announcement',
  html: '<p>Hello team!</p>',
}
```

---

## 10. Custom Sender Name

```js
mail: {
  from: 'Ambivare Support <operations@ambivare.com>',
  to: 'customer@example.com',
  subject: 'We are here to help',
  text: 'Reach out anytime.',
}
```

---

## Response Format

### Success
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "<abc123@smtp.zoho.in>",
  "provider": "Zoho Mail",
  "usedConfig": { "host": "smtp.zoho.in", "port": 587, "secure": false },
  "attempts": [
    { "host": "smtp.zoho.com", "port": 587, "secure": false, "success": false, "error": "..." },
    { "host": "smtp.zoho.in",  "port": 587, "secure": false, "success": true }
  ]
}
```

### Failure
```json
{
  "success": false,
  "error": "Authentication rejected by all SMTP hosts...",
  "code": "AUTH_FAILED",
  "attempts": [...]
}
```

| Error Code | Meaning |
|------------|---------|
| `AUTH_FAILED` | Wrong password or SMTP access not enabled |
| `ALL_FAILED` | Network/firewall issue, no host reachable |

---

## Integration Patterns

### Express.js (Node.js API)
```js
app.post('/auth/send-otp', async (req, res) => {
  const { email, name } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await redisClient.set(`otp:${email}`, otp, 'EX', 600); // expire 10 min

  const result = await fetch(`${process.env.MAILER_URL}/otp`, {
    method: 'POST',
    headers: { 'X-API-Key': process.env.MAILER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentials: { email: process.env.SMTP_EMAIL, password: process.env.SMTP_PASSWORD },
      provider: 'zoho',
      to: email, toName: name, otp, appName: 'Ambivare', validity: 10,
    }),
  }).then(r => r.json());

  res.json({ sent: result.success });
});
```

### Django (Python)
```python
import os, random, requests

MAILER_URL     = os.environ['MAILER_URL']
MAILER_API_KEY = os.environ['MAILER_API_KEY']
SMTP_EMAIL     = os.environ['SMTP_EMAIL']
SMTP_PASSWORD  = os.environ['SMTP_PASSWORD']

def send_otp_email(user_email, user_name):
    otp = str(random.randint(100000, 999999))
    cache.set(f'otp:{user_email}', otp, timeout=600)

    requests.post(f'{MAILER_URL}/otp',
        headers={'X-API-Key': MAILER_API_KEY},
        json={
            'credentials': {'email': SMTP_EMAIL, 'password': SMTP_PASSWORD},
            'provider': 'zoho',
            'to': user_email, 'toName': user_name,
            'otp': otp, 'appName': 'Ambivare', 'validity': 10,
        }
    )
    return otp

def send_welcome_email(user_email, user_name):
    requests.post(f'{MAILER_URL}/send',
        headers={'X-API-Key': MAILER_API_KEY},
        json={
            'credentials': {'email': SMTP_EMAIL, 'password': SMTP_PASSWORD},
            'provider': 'zoho',
            'mail': {
                'to': user_email,
                'subject': f'Welcome to Ambivare, {user_name}!',
                'template': 'welcome',
                'templateData': {
                    'appName': 'Ambivare', 'toName': user_name,
                    'ctaUrl': 'https://app.ambivare.com', 'ctaText': 'Get Started',
                },
            },
        }
    )
```

### Flutter / Dart (Mobile App)
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class MailerService {
  static const _baseUrl = 'https://x4m2x4kscj.execute-api.ap-south-1.amazonaws.com/v1';
  static const _apiKey  = 'Ambivare@9822091922';

  static Future<bool> sendOtp(String toEmail, String name, String otp) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/otp'),
      headers: {'X-API-Key': _apiKey, 'Content-Type': 'application/json'},
      body: jsonEncode({
        'credentials': {'email': 'operations@ambivare.com', 'password': 'YOUR_APP_PASSWORD'},
        'provider': 'zoho',
        'to': toEmail,
        'toName': name,
        'otp': otp,
        'appName': 'Ambivare',
        'validity': 10,
      }),
    );
    return jsonDecode(response.body)['success'] == true;
  }

  static Future<bool> sendWelcome(String toEmail, String name) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/send'),
      headers: {'X-API-Key': _apiKey, 'Content-Type': 'application/json'},
      body: jsonEncode({
        'credentials': {'email': 'operations@ambivare.com', 'password': 'YOUR_APP_PASSWORD'},
        'provider': 'zoho',
        'mail': {
          'to': toEmail,
          'subject': 'Welcome to Ambivare!',
          'template': 'welcome',
          'templateData': {'appName': 'Ambivare', 'toName': name, 'ctaUrl': 'https://app.ambivare.com', 'ctaText': 'Open App'},
        },
      }),
    );
    return jsonDecode(response.body)['success'] == true;
  }
}
```

---

## Security Best Practices

- **Never hardcode** the SMTP password in client-side code (mobile apps, browsers). Store it in your backend environment variables and proxy requests through your own server.
- The `X-API-Key` can be used in mobile/frontend since it only grants access to this mailer — it does not expose your email password.
- Store `SMTP_PASSWORD` only in server-side `.env` / secret managers (AWS Secrets Manager, Doppler, etc.).
- Rotate the Zoho App Password periodically and update your environment variable.

---

## Quick Reference Card

```
Base URL  : https://x4m2x4kscj.execute-api.ap-south-1.amazonaws.com/v1
API Key   : Ambivare@9822091922
Provider  : zoho  (for operations@ambivare.com)

Send email       POST /send
Send OTP         POST /otp
Bulk emails      POST /bulk    (max 50)
Verify creds     POST /verify
List providers   GET  /providers
List templates   GET  /templates
Preview template POST /template/preview
Health check     GET  /health

Built-in templates : otp · welcome · reset-password · notification · invoice
Attachment support : ✅ Base64 any file type (PDF, DOCX, PNG, ZIP, CSV...)
Max bulk per call  : 50 emails
Lambda timeout     : 30 seconds
Runtime            : Node.js 22 on AWS Lambda (ap-south-1)
```
