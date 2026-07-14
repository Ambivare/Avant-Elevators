# HTML to PDF API — Integration Guide

**Base URL:** `https://lr5pimglda.execute-api.us-east-1.amazonaws.com`
**Auth header:** `X-Api-Key: YOUR_API_KEY`

---

## Custom Page Sizes

Pass `page.width` and `page.height` with any CSS unit: `mm`, `cm`, `in`, `px`, `pt`

```json
{
  "page": {
    "width": "210mm",
    "height": "254mm"
  }
}
```

### Named sizes (no width/height needed)

```json
{ "page": { "size": "A4" } }
{ "page": { "size": "A3" } }
{ "page": { "size": "Letter" } }
{ "page": { "size": "Legal" } }
{ "page": { "size": "16:9" } }
{ "page": { "size": "FHD" } }
```

Full list → `GET /sizes`

### Landscape any size

```json
{ "page": { "size": "A4", "landscape": true } }
{ "page": { "width": "210mm", "height": "254mm", "landscape": true } }
```

---

## Download URL — How It Works

Every `/convert` response gives you **two URLs**:

```json
{
  "id": "2026-04-11/550e8400-xxxx",
  "retrieveUrl": "https://lr5pimglda.../pdf/2026-04-11%2F550e8400-xxxx",
  "downloadUrl":  "https://s3.amazonaws.com/...?X-Amz-Expires=3600&..."
}
```

| | `retrieveUrl` | `downloadUrl` |
|---|---|---|
| **Expires** | Never | 1 hour |
| **What it does** | Calls your API → fresh redirect | Direct S3 download |
| **Store in DB** | ✅ Yes — this is permanent | ❌ No — it expires |
| **Use for download button** | ✅ Best choice | Only for immediate use |

**Always store `id` and `retrieveUrl` in your database. Never store `downloadUrl`.**

When the user clicks Download → hit `retrieveUrl` → it redirects to a fresh S3 link automatically.

---

## Request — Full Reference

```json
{
  "type": "html",
  "content": "<html>...</html>",

  "page": {
    "size": "A4",
    "width": "210mm",
    "height": "254mm",
    "landscape": false,
    "margin": {
      "top": "15mm",
      "bottom": "15mm",
      "left": "15mm",
      "right": "15mm"
    }
  },

  "pdf": {
    "printBackground": true,
    "scale": 1,
    "displayHeaderFooter": false,
    "headerTemplate": "<div style='font-size:10px'>Header</div>",
    "footerTemplate": "<div style='font-size:10px'>Page <span class='pageNumber'></span></div>"
  },

  "render": {
    "waitUntil": "networkidle0",
    "waitFor": "#content-ready",
    "waitForTimeout": 500,
    "mediaType": "print",
    "deviceScaleFactor": 2,
    "injectCss": "body { font-family: Arial; }",
    "headers": { "Authorization": "Bearer token" }
  },

  "output": "s3",
  "softwareId": "my-app",
  "documentRef": "INV-001",
  "filename": "invoice-001.pdf",
  "tags": { "client": "acme", "type": "invoice" }
}
```

---

## JavaScript (Vanilla / Browser)

```javascript
const API_BASE = 'https://lr5pimglda.execute-api.us-east-1.amazonaws.com';
const API_KEY  = 'YOUR_API_KEY';

async function generatePdf(htmlContent, options = {}) {
  const res = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      type:       'html',
      content:    htmlContent,
      softwareId: options.softwareId || 'my-app',
      documentRef: options.documentRef,
      filename:   options.filename || 'document.pdf',
      output:     's3',
      page: {
        size:      options.size      || 'A4',
        width:     options.width,
        height:    options.height,
        landscape: options.landscape || false,
        margin:    options.margin    || { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      },
      pdf: {
        printBackground: true,
        scale: options.scale || 1,
      },
      render: {
        waitUntil:         'networkidle0',
        deviceScaleFactor: 2,
        injectCss:         options.injectCss,
      },
      tags: options.tags || {},
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'PDF generation failed');
  }

  return res.json();
  // Returns: { id, retrieveUrl, downloadUrl, sizeBytes, generatedAt }
}

// ── Download button on click ──────────────────────────────────────────────────
// Use retrieveUrl (permanent) — NOT downloadUrl (expires in 1 hour)
function downloadPdf(retrieveUrl, filename = 'document.pdf') {
  const a = document.createElement('a');
  a.href     = retrieveUrl;
  a.target   = '_blank';           // opens redirect → downloads PDF
  a.download = filename;
  a.click();
}

// ── Usage example ─────────────────────────────────────────────────────────────
const html = `
  <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; margin: 0; }
        .invoice { padding: 40px; }
        h1 { color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 10px; border: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="invoice">
        <h1>Invoice #INV-001</h1>
        <p>Client: Acme Corp</p>
        <table>
          <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
          <tr><td>Service</td><td>1</td><td>$500</td></tr>
        </table>
      </div>
    </body>
  </html>
`;

// Generate PDF
const pdf = await generatePdf(html, {
  softwareId:  'invoice-app',
  documentRef: 'INV-001',
  filename:    'invoice-001.pdf',
  size:        'A4',
  margin:      { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
});

// Save to your database
await db.save({ pdfId: pdf.id, url: pdf.retrieveUrl });

// Download button click handler
document.getElementById('download-btn').addEventListener('click', () => {
  downloadPdf(pdf.retrieveUrl, 'invoice-001.pdf');
});
```

---

## React

```jsx
import { useState } from 'react';

const API_BASE = 'https://lr5pimglda.execute-api.us-east-1.amazonaws.com';
const API_KEY  = 'YOUR_API_KEY';

function PdfDownloadButton({ htmlContent, filename = 'document.pdf', pageSize = 'A4' }) {
  const [loading,  setLoading]  = useState(false);
  const [pdfData,  setPdfData]  = useState(null);  // { id, retrieveUrl }
  const [error,    setError]    = useState(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
        body: JSON.stringify({
          type:    'html',
          content: htmlContent,
          output:  's3',
          page:    { size: pageSize },
          pdf:     { printBackground: true },
          render:  { deviceScaleFactor: 2 },
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPdfData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    // retrieveUrl is permanent — always use this for download buttons
    window.open(pdfData.retrieveUrl, '_blank');
  };

  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      {!pdfData ? (
        <button onClick={generate} disabled={loading}>
          {loading ? 'Generating PDF...' : 'Generate PDF'}
        </button>
      ) : (
        <button onClick={download}>
          Download PDF ({(pdfData.sizeBytes / 1024).toFixed(1)} KB)
        </button>
      )}
    </div>
  );
}

// Custom size example
<PdfDownloadButton
  htmlContent={myHtml}
  filename="report.pdf"
  pageSize="A4"
/>

// For custom dimensions — extend the component to accept width/height props
```

---

## Node.js / Express (Backend)

```javascript
const express = require('express');
const app     = express();
app.use(express.json());

const API_BASE = 'https://lr5pimglda.execute-api.us-east-1.amazonaws.com';
const API_KEY  = 'YOUR_API_KEY';

// Generate PDF and return download URL
app.post('/api/generate-pdf', async (req, res) => {
  const { html, size, width, height, documentRef, filename } = req.body;

  try {
    const response = await fetch(`${API_BASE}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
      body: JSON.stringify({
        type:        'html',
        content:     html,
        output:      's3',
        softwareId:  'my-node-app',
        documentRef,
        filename:    filename || 'document.pdf',
        page: {
          size,
          width,            // e.g. "210mm"  — custom size
          height,           // e.g. "254mm"  — custom size
          margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
        },
        pdf:    { printBackground: true },
        render: { deviceScaleFactor: 2, waitUntil: 'networkidle0' },
      }),
    });

    const data = await response.json();
    if (!data.success) return res.status(500).json({ error: data.message });

    // Store pdf.id + pdf.retrieveUrl in your database here
    res.json({
      id:          data.id,
      retrieveUrl: data.retrieveUrl,   // permanent — store this
      downloadUrl: data.downloadUrl,   // 1-hour link — for immediate download only
      sizeBytes:   data.sizeBytes,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy download — keeps API key secret from frontend
app.get('/api/download-pdf/:id', async (req, res) => {
  const { id } = req.params;
  const { softwareId = 'my-node-app' } = req.query;

  // Redirect to the API retrieve endpoint — it generates a fresh presigned URL
  res.redirect(`${API_BASE}/pdf/${encodeURIComponent(id)}?softwareId=${softwareId}`);
});
```

---

## Python

```python
import requests

API_BASE = 'https://lr5pimglda.execute-api.us-east-1.amazonaws.com'
API_KEY  = 'YOUR_API_KEY'

def generate_pdf(html_content, **options):
    """
    Generate PDF and return { id, retrieveUrl, downloadUrl, sizeBytes }
    
    options:
        size        = 'A4'          named size
        width       = '210mm'       custom width  (overrides size)
        height      = '254mm'       custom height (overrides size)
        landscape   = False
        margin      = { top, bottom, left, right }  e.g. '15mm'
        software_id = 'my-app'
        doc_ref     = 'INV-001'
        filename    = 'invoice.pdf'
        tags        = { 'key': 'value' }
    """
    page = {}
    if options.get('width') and options.get('height'):
        page['width']  = options['width']
        page['height'] = options['height']
    else:
        page['size'] = options.get('size', 'A4')

    page['landscape'] = options.get('landscape', False)
    page['margin']    = options.get('margin', {
        'top': '15mm', 'bottom': '15mm', 'left': '15mm', 'right': '15mm'
    })

    payload = {
        'type':        'html',
        'content':     html_content,
        'output':      's3',
        'softwareId':  options.get('software_id', 'python-app'),
        'documentRef': options.get('doc_ref'),
        'filename':    options.get('filename', 'document.pdf'),
        'page':        page,
        'pdf':         { 'printBackground': True },
        'render':      { 'deviceScaleFactor': 2, 'waitUntil': 'networkidle0' },
        'tags':        options.get('tags', {}),
    }

    r = requests.post(
        f'{API_BASE}/convert',
        headers={ 'X-Api-Key': API_KEY },
        json=payload,
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    if not data.get('success'):
        raise Exception(data.get('message', 'PDF generation failed'))
    return data


def download_pdf(retrieve_url, save_path):
    """Download PDF from retrieveUrl and save to disk."""
    r = requests.get(retrieve_url, allow_redirects=True, timeout=30)
    r.raise_for_status()
    with open(save_path, 'wb') as f:
        f.write(r.content)


# ── Usage ─────────────────────────────────────────────────────────────────────
html = """
<html>
  <body style="font-family: Arial; padding: 40px;">
    <h1>Invoice #001</h1>
    <p>Client: Acme Corp | Amount: $500</p>
  </body>
</html>
"""

# Named size
pdf = generate_pdf(html, size='A4', doc_ref='INV-001', software_id='invoice-app')

# Custom size
pdf = generate_pdf(html, width='210mm', height='254mm', software_id='invoice-app')

print(pdf['id'])           # store in DB
print(pdf['retrieveUrl'])  # permanent download URL — store in DB
print(pdf['downloadUrl'])  # 1-hour link — immediate use only

# Download to disk
download_pdf(pdf['retrieveUrl'], '/tmp/invoice.pdf')
```

---

## PHP

```php
<?php

define('API_BASE', 'https://lr5pimglda.execute-api.us-east-1.amazonaws.com');
define('API_KEY',  'YOUR_API_KEY');

function generatePdf(string $html, array $options = []): array
{
    $page = [];
    if (!empty($options['width']) && !empty($options['height'])) {
        $page['width']  = $options['width'];   // e.g. "210mm"
        $page['height'] = $options['height'];  // e.g. "254mm"
    } else {
        $page['size'] = $options['size'] ?? 'A4';
    }
    $page['landscape'] = $options['landscape'] ?? false;
    $page['margin']    = $options['margin'] ?? [
        'top' => '15mm', 'bottom' => '15mm', 'left' => '15mm', 'right' => '15mm',
    ];

    $payload = json_encode([
        'type'        => 'html',
        'content'     => $html,
        'output'      => 's3',
        'softwareId'  => $options['softwareId']  ?? 'php-app',
        'documentRef' => $options['documentRef'] ?? null,
        'filename'    => $options['filename']    ?? 'document.pdf',
        'page'        => $page,
        'pdf'         => ['printBackground' => true],
        'render'      => ['deviceScaleFactor' => 2, 'waitUntil' => 'networkidle0'],
        'tags'        => $options['tags'] ?? [],
    ]);

    $ch = curl_init(API_BASE . '/convert');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Api-Key: ' . API_KEY,
        ],
    ]);
    $body = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($body, true);
    if (!$data['success']) {
        throw new Exception($data['message'] ?? 'PDF generation failed');
    }
    return $data;
}

// ── Usage ──────────────────────────────────────────────────────────────────────
$html = '<html><body><h1>Invoice #001</h1><p>$500</p></body></html>';

// Named size
$pdf = generatePdf($html, ['size' => 'A4', 'documentRef' => 'INV-001']);

// Custom size
$pdf = generatePdf($html, ['width' => '210mm', 'height' => '254mm']);

// Store in DB
$pdfId       = $pdf['id'];
$retrieveUrl = $pdf['retrieveUrl'];  // permanent — store this
$downloadUrl = $pdf['downloadUrl'];  // 1-hour — immediate use only

// Download button in PHP/HTML — always use retrieveUrl
echo '<a href="' . htmlspecialchars($retrieveUrl) . '" target="_blank">Download PDF</a>';
```

---

## Flutter / Dart

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

const String apiBase = 'https://lr5pimglda.execute-api.us-east-1.amazonaws.com';
const String apiKey  = 'YOUR_API_KEY';

Future<Map<String, dynamic>> generatePdf(
  String htmlContent, {
  String? size,
  String? width,
  String? height,
  bool landscape = false,
  String softwareId = 'flutter-app',
  String? documentRef,
  String filename = 'document.pdf',
}) async {
  final page = <String, dynamic>{
    'landscape': landscape,
    'margin': {'top': '15mm', 'bottom': '15mm', 'left': '15mm', 'right': '15mm'},
  };

  if (width != null && height != null) {
    page['width']  = width;   // e.g. '210mm'
    page['height'] = height;  // e.g. '254mm'
  } else {
    page['size'] = size ?? 'A4';
  }

  final response = await http.post(
    Uri.parse('$apiBase/convert'),
    headers: {'Content-Type': 'application/json', 'X-Api-Key': apiKey},
    body: jsonEncode({
      'type':        'html',
      'content':     htmlContent,
      'output':      's3',
      'softwareId':  softwareId,
      'documentRef': documentRef,
      'filename':    filename,
      'page':        page,
      'pdf':         {'printBackground': true},
      'render':      {'deviceScaleFactor': 2},
    }),
  );

  final data = jsonDecode(response.body) as Map<String, dynamic>;
  if (data['success'] != true) throw Exception(data['message']);
  return data;
}

// Download PDF — opens in browser/PDF viewer
Future<void> downloadPdf(String retrieveUrl) async {
  final uri = Uri.parse(retrieveUrl);
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

// Usage
final pdf = await generatePdf(
  '<h1>Invoice</h1>',
  size: 'A4',
  softwareId: 'flutter-invoice-app',
  documentRef: 'INV-001',
);
await downloadPdf(pdf['retrieveUrl']);
```

---

## Custom Size Examples

```json
{ "page": { "width": "210mm",  "height": "254mm" } }   ← 210x254mm custom
{ "page": { "width": "8.5in",  "height": "11in"  } }   ← US Letter in inches
{ "page": { "width": "1920px", "height": "1080px"} }   ← exact 1080p screen
{ "page": { "width": "100mm",  "height": "150mm" } }   ← postcard size
{ "page": { "width": "21cm",   "height": "29.7cm"} }   ← A4 in centimeters
{ "page": { "size": "A4", "landscape": true      } }   ← A4 landscape
{ "page": { "size": "16:9"                        } }   ← presentation slide
{ "page": { "size": "FHD"                         } }   ← 1920x1080 preset
```

---

## Common Mistakes to Avoid

| Wrong | Right |
|---|---|
| Store `downloadUrl` in DB | Store `id` + `retrieveUrl` in DB |
| `<a href={downloadUrl}>` | `<a href={retrieveUrl}>` |
| Save curl response as PDF directly | Use `output:s3` and download from `downloadUrl` |
| Hardcode `output:"raw"` | Use `output:"s3"` for all software integrations |
| No `printBackground: true` | Always set `printBackground: true` for coloured PDFs |

---

## List / Retrieve Stored PDFs

```javascript
// List all PDFs for your app
const list = await fetch(`${API_BASE}/pdfs?softwareId=my-app&limit=50`, {
  headers: { 'X-Api-Key': API_KEY }
}).then(r => r.json());

// Get info for one PDF
const info = await fetch(`${API_BASE}/pdf/${id}?info=true`, {
  headers: { 'X-Api-Key': API_KEY }
}).then(r => r.json());

// Delete a PDF
await fetch(`${API_BASE}/pdf/${id}?softwareId=my-app`, {
  method: 'DELETE',
  headers: { 'X-Api-Key': API_KEY }
});
```
