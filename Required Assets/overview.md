# Avant Elevators — Enterprise Management System
## Complete Application Overview

---

## Table of Contents

1. [What the App Does](#what-the-app-does)
2. [How the App Works — End to End](#how-the-app-works--end-to-end)
3. [User Roles & Access Control](#user-roles--access-control)
4. [Login & Authentication](#login--authentication)
5. [Navigation & Layout](#navigation--layout)
6. [Push Notifications System](#push-notifications-system)
7. [Module Reference](#module-reference)
   - [Dashboard](#1-dashboard)
   - [Projects](#2-projects)
   - [Tasks](#3-tasks)
   - [Complaints](#4-complaints)
   - [AMC (Annual Maintenance Contracts)](#5-amc-annual-maintenance-contracts)
   - [Installation Activities](#6-installation-activities)
   - [Repairs](#7-repairs)
   - [Modernisation](#8-modernisation)
   - [Maintenance Scheduling](#9-maintenance-scheduling)
   - [Sales & CRM](#10-sales--crm)
   - [Billing](#11-billing)
   - [Bill of Materials (BOM)](#12-bill-of-materials-bom)
   - [Inventory](#13-inventory)
   - [Vendors](#14-vendors)
   - [HR — Employee Management](#15-hr--employee-management)
   - [Salary Management](#16-salary-management)
   - [Attendance](#17-attendance)
   - [Leave Management](#18-leave-management)
   - [Technician Tracking](#19-technician-tracking)
   - [Inspection](#20-inspection)
   - [Gallery](#21-gallery)
   - [Activities (Audit Log)](#22-activities-audit-log)
   - [Reminders](#23-reminders)
   - [AI Assistant](#24-ai-assistant)
   - [Settings](#25-settings)
   - [Configurations](#26-configurations)
8. [Cloud Functions & Automation](#cloud-functions--automation)
9. [Scheduled Reminders](#scheduled-reminders)
10. [Document Generation — PDF & Excel](#document-generation--pdf--excel)
11. [HTML Billing Templates](#html-billing-templates)
12. [Data Collections Reference](#data-collections-reference)
13. [Admin Management](#admin-management)

---

## What the App Does

**Avant Elevators EMS** is a full-featured enterprise management system built for a lift/elevator installation and service company. It covers every operational area of the business — from first contact with a client (lead/CRM) all the way through installation, ongoing annual maintenance contracts, repair visits, billing, team HR, and payroll.

The system is used daily by the admin, sales team, technicians in the field, and office reception. Each role sees only the modules and data relevant to their work, with real-time push notifications keeping everyone informed as jobs are assigned, completed, or require attention.

Everything syncs live across devices. A technician logging a maintenance visit in the field instantly notifies the admin. A sales rep closing a lead as won automatically creates a project. An invoice becoming overdue triggers an automated reminder the next morning.

---

## How the App Works — End to End

### The full lifecycle of business operations:

**1. Lead Comes In**
A potential client enquires about a new lift installation, modernisation, or service. Sales creates a lead in the CRM with the client name, contact details, requirement type, budget, and assigns a follow-up date. The admin is notified immediately. The lead enters the sales pipeline.

**2. Pipeline to Won**
As the lead progresses, the salesperson updates the stage (New → Contacted → Qualified → Proposal Sent). Quotations are generated from the Billing module, exported as PDFs with the Avant letterhead, and emailed to the client. When the deal closes, the lead is marked **Won** — the system automatically creates a Project record with all client details, address, and lift type already filled in.

**3. Project Execution**
The newly created project tracks the installation job. Admin configures the building structure (how many buildings, wings, and lifts), assigns a project manager, and sets expected completion. Each lift gets a unique ID (e.g. `B1-W1-L01`). Installation activities are logged as the work progresses, with technicians assigned, status tracked, and photos/signatures captured on completion.

**4. AMC After Installation**
Once installation is complete, an Annual Maintenance Contract is created for the client. The AMC records the contract value, payment schedule (monthly/quarterly/yearly instalments or one-time), assigned technicians, and contract dates. Monthly maintenance visits are logged by technicians with building/wing/lift details, and the admin sees a real-time overview of which sites have been visited this month and which are still pending.

**5. Ongoing Complaints & Repairs**
Client complaints are logged whenever there's a fault. Each complaint is assigned to a technician with a scheduled visit date. On resolution, the technician captures arrival/completion times, obtains a client signature, takes site photos, and rates the satisfaction. Repair activities are tracked similarly for jobs that aren't linked to a complaint.

**6. Billing & Finance**
The billing pipeline covers quotations, proforma invoices, tax invoices, and purchase orders. All documents are generated as PDFs using the company's HTML templates with auto-filled variables. Invoices track payment status (Pending, Partial, Paid) and overdue invoices trigger automated morning reminders.

**7. Team Management**
HR manages the employee roster, leave requests, attendance records, and salary slips. Employees mark attendance daily. Technicians in the field are tracked via GPS. The admin approves leave. Salary slips are generated monthly and sent to employees.

**8. Automation Runs in the Background**
Cloud Functions handle all real-time notifications and scheduled daily reminders — overdue tasks, AMC expiries, instalment due dates, punch-in reminders, job schedule reminders — all delivered as push notifications to the relevant person's phone.

---

## User Roles & Access Control

The system has five roles. Each role sees only specific tabs and has specific abilities.

### Admin
Full access to all 27 modules. Can delete records, approve leave, access HR, create tasks for others, and view all data across all employees and clients.

**Access**: Dashboard, Warehouse, Service Van, Office, Projects, Repairs, Complaints, Installation, Modernisation, AMC, Tasks, Tracking, Billing, Sales, Activities, HR, Attendance, Leave, Salary, Vendors, BOM, Settings, Maintenance, Configurations, AI Assistant, Gallery, Inspection, Reminders

### Sales
Access to business-facing modules. Cannot delete records or access HR. Primarily works with leads, projects, quotations, invoices, and AMC contracts.

**Access**: Dashboard, Sales, Projects, AMC, Billing, Tasks, Complaints, Attendance, Leave, Gallery, Inspection, Reminders

### Technician
Field-facing modules only. Cannot delete records, cannot create tasks for others, cannot access HR or billing. Primarily works on assigned jobs.

**Access**: Dashboard, Tasks, Installation, Modernisation, Repairs, Complaints, AMC, Tracking, Service Van, Attendance, Leave, Gallery, Inspection, Reminders

### Reception
Office operations — complaint intake, task management, project visibility.

**Access**: Dashboard, Complaints, Tasks, Projects, Attendance, Leave, Gallery, Reminders

### User
Basic employee access — personal tasks, project view, attendance, leave.

**Access**: Dashboard, Projects, Tasks, Office, Attendance, Leave, Gallery, Reminders

---

## Login & Authentication

The login screen accepts a **username** and **password**. All accounts are stored in Firestore.

- Staff added via the HR module are stored in the `employees` collection
- Admin accounts created via `/create-admin-user` are stored in the `users` collection
- Login checks `employees` first, then falls back to `users`
- Inactive accounts (`status: inactive`) cannot log in
- The session is saved locally on the device and auto-restored on next open
- Firebase anonymous authentication is used to secure Firestore access

On successful login, FCM push notifications are initialised — the device's push token is saved to Firestore under the user's ID with their role, so Cloud Functions can send targeted notifications to the right people.

On logout, the FCM token is removed from Firestore so the device stops receiving notifications for that account. When a different user logs in on the same device, any stale tokens from the previous user are automatically cleaned up so there is no cross-user notification bleed.

---

## Navigation & Layout

The app has a **collapsible sidebar** on the left and a **content area** on the right.

### Sidebar
- Shows the company logo and name at the top
- Displays the currently logged-in user's name and role badge
- Lists all accessible navigation items grouped into 6 sections:
  - **Overview**: Dashboard, Activities, AI Assistant
  - **Inventory**: Warehouse, Service Van, Office
  - **Operations**: Projects, Repairs, Complaints, Installation, Modernisation, Maintenance, Tracking
  - **Contracts**: AMC, Tasks, Billing, Sales, BOM, Vendors
  - **Team**: HR, Attendance, Leave, Salary, Gallery, Inspection
  - **System**: Settings, Configurations, Reminders
- The last-visited tab is remembered and restored on next open
- On mobile, the sidebar becomes a slide-in drawer with an overlay backdrop

### Header
- Contains the app name, current section title
- Theme toggle (dark/light mode)
- Notification bell with unread count badge — opens the **Notifications Panel**

### Notifications Panel
A slide-in panel from the right showing live alerts pulled from Firestore:
- **AMC Renewals**: Contracts expiring within 45 days (admin/sales only)
- **Open Complaints**: All open or in-progress complaints (admin sees all, others see only their assigned ones)
- **Pending Repairs**: Repairs in reported/diagnosed state
- **Overdue Tasks**: Tasks past their due date (admin sees all, others see only their own)
- **Projects Due Soon**: Active projects with expected completion within 14 days

The panel is role-aware — technicians only see items assigned to them. Sales/admin see business-wide data.

---

## Push Notifications System

The app sends real-time push notifications to Android devices via Firebase Cloud Messaging (FCM). Notifications are targeted to specific users or roles.

### Notification Channels (Android)
| Channel | Purpose | Importance |
|---|---|---|
| `avant_assignments` | New work assigned to you | High — sound + vibrate |
| `avant_alerts` | Urgent issues, complaints, late check-in | High — sound + vibrate |
| `avant_reminders` | AMC expiry, follow-ups, due dates | Medium — sound |
| `avant_updates` | Status changes, completions, approvals | Low — silent |
| `avant_general` | Check-ins, new records created | Low — silent |

### How Targeting Works
Each user's FCM push token is stored in Firestore under `fcmTokens/{userId}` with their `role` and `userName`. Cloud Functions query this collection to find the right recipients:
- Admin notifications: query by role = 'admin'
- Technician notifications: query by userName matching the assigned technician's name
- Employee notifications: query by userId

Tapping a notification navigates the user to the relevant section of the app (e.g., tapping a complaint notification opens the Complaints tab).

---

## Module Reference

---

### 1. Dashboard

**Who uses it**: Everyone (role-specific content)

The dashboard is the home screen after login. It shows a personalised greeting (Good morning/afternoon/evening with the user's name), the current date, and a summary of business metrics.

**Admin Dashboard includes**:
- Projects: total count, active, completed, on-hold counts
- AMC: total contracts, active, expiring within 30 days
- Tasks: pending count, completed count
- Complaints: open count
- Employees: total, active count
- Leads: total active leads
- Inventory: number of low-stock items
- Revenue: sum of invoices paid this month
- Visual charts: project status breakdown, task status breakdown

**Technician Dashboard shows**:
- Their assigned tasks (pending/overdue)
- AMC contracts they maintain (with this month's pending sites)
- Upcoming scheduled repairs/installations

**Sales Dashboard shows**:
- Active leads count, conversion rate
- Quotations pending follow-up
- AMC contracts expiring soon
- Pipeline value

The dashboard has a **Refresh** button to reload all metrics on demand.

---

### 2. Projects

**Who uses it**: Admin, Sales, Reception, User (view-only for non-admin)

Projects represent the actual lift jobs — new installations, ongoing AMC sites, modernisation scopes. Each project has a full building/wing/lift hierarchy and tracks all associated activities.

#### Creating a Project (3-Step Wizard)

**Step 1 — Project Details**
- Project Name (required)
- File Number (optional reference number, e.g. ARK-2024-001)
- Project Type: New Installation, AMC, Modernisation, Repair, Inspection, Other
- Status: Active, In Progress, Completed, On Hold, Cancelled, Discontinued
- Discontinuation Reason (shown if status = Discontinued)
- **Multi-Client Contacts**: Add multiple client contacts, each with name, designation, phone, email
- Project Value (₹) and Advance Amount (₹)
- Project Manager name
- City
- Address (site address)
- Google Maps Link + Latitude/Longitude coordinates + Arrival Radius (km) for geofence check-in
- Start Date and Expected Completion Date
- Description / Notes

**Step 2 — Building Configuration**
Configure the physical structure of lifts at the site:
- Number of Buildings (1–10)
- For each building: number of Wings/Sections (1–10)
- For each wing: number of Lifts (1–20)
- "Same configuration for all lifts" toggle to bulk-fill properties
- Per-lift properties: Lift Type, Controller/Drive type, Capacity (kg), Speed (m/s), OEM brand, Number of Stops, Door Type, Machine Room type, Rated Load
- Each lift auto-receives a unique ID in format `B1-W1-L01`

**Step 3 — Review & Submit**
Shows all entered data for verification before saving.

#### Viewing Projects
- **Cards view**: Grid layout showing project name, client, type, value, city, lift count, status badge, quick action buttons
- **Table view**: Compact tabular list with all key columns

#### Filters & Search
- Search by project name or client name
- Filter by status (Active, In Progress, Completed, etc.)
- Filter by project type

#### Project Actions
- **View**: Read-only detail modal showing all fields, client contacts, address, lift summary
- **Edit**: Re-opens wizard with existing data
- **Delete**: Admin only, with confirmation dialog
- **Export PDF**: Individual or bulk (with period selection)
- **Export Excel**: Tabular export of filtered projects
- **Bulk Import**: Upload an Excel file to create multiple projects at once (with sample template download and preview before import)
- **Activity Timeline**: Per-project change history log

---

### 3. Tasks

**Who uses it**: All roles (filtered by assignment for non-admin)

Tasks are work items assigned to team members with deadlines and priority levels.

#### Task Form Fields
- Title (required)
- Description
- Assigned To (required) — dropdown of employees; non-admin users can assign to themselves
- Priority: Low, Medium, High, Urgent
- Due Date (required)
- Status: Pending, In Progress, Completed, On Hold
- Category: General, Installation, Repair, AMC, Complaint, Other
- Project Link (optional — links task to a specific project)

#### Views
- **List View**: Table with inline status selector — change status without opening modal
- **Kanban View**: Three columns — Pending, In Progress, Completed — with drag-to-update cards

#### Tabs
- **All Tasks** (admin sees everyone's; others see own)
- **My Tasks**: Tasks assigned to the logged-in user
- **Created by Me**: Tasks the logged-in user created
- **Completed**: Closed tasks

#### Filters
- Search by title or description
- Filter by priority
- Filter by status
- Filter by assignee (admin/reception only)
- Date range filter (from/to due date)
- Clear all filters button

#### Overdue Handling
Tasks with a due date in the past and status ≠ completed are flagged visually as overdue (red highlight). These trigger daily automated reminders (see Cloud Functions).

#### Actions
- Create new task
- Edit task
- Delete task (admin only)
- Update status inline (list view) or via card (kanban)

---

### 4. Complaints

**Who uses it**: Admin, Sales, Technician, Reception

Complaints are client service calls — stuck lifts, door faults, noise, speed issues, etc. They have a full lifecycle from filing to resolution with photos and signatures.

#### Status Flow
**Open → In Progress → Resolved → Closed**

#### Complaint Form
- **Project Link Toggle**: When enabled, select from existing projects to auto-fill client name, address, contacts. Also shows building/wing/lift selector from the project's structure.
- **Manual Entry** (when not linked to project):
  - Client Name (required)
  - Client Phone
  - Address

- Core fields:
  - Issue Type: Stuck Elevator, Door Issue, Noise, Speed, Other
  - Priority: Low, Medium, High, Urgent
  - Status
  - Assigned Technicians (multi-select)
  - Scheduled Date and Time
  - Description of the problem

#### Completion / Resolution Modal
When marking a complaint as resolved, a modal captures:
- Description of work done (required)
- Arrival Date + Time
- Completed By (auto-filled if technician is the logged-in user)
- Signatory Name and Designation (the person signing off on behalf of the client)
- **Client Signature Canvas**: Touch/stylus/mouse drawing area for customer acknowledgement
- **Site Photos**: Upload from gallery or capture from camera directly; shows thumbnail previews with delete option

#### Payment Recording
Each complaint can have payment logs attached (if applicable):
- Amount (₹)
- Payment Date
- Method: Cash, Bank Transfer, Cheque, UPI, Other
- Reference / Cheque Number
- Notes
- Running total of all payments recorded is shown

#### Export / Reports
- **Individual Complaint PDF**: Full receipt with Avant header, complaint details, resolution summary, signatures, photos
- **Bulk PDF Export**: Multiple complaints for a selected date period
- **Bulk Excel Import**: Create many complaints at once from a spreadsheet (required: client name, issue type, priority; optional: phone, address, status, assigned tech, date, description)

#### Tabs
All, Open, In Progress, Resolved, Closed — each with a live count badge.

#### Filters
- Search by complaint number or client name
- Filter by priority
- Filter by issue type

---

### 5. AMC (Annual Maintenance Contracts)

**Who uses it**: Admin (full), Sales (view + create), Technician (monthly log only)

AMC is the recurring maintenance contracts module — the core of Avant's service business. Contracts define what sites get maintained, how often, and for how much.

#### Tabs

**Contracts Tab**
The main list of all AMC contracts with filters and bulk actions.

**Contract Form Fields**:
- Contract Number (auto-generated or manual)
- Project Link (optional — links to a project in the system)
- Client Name (required)
- Client Phone
- Contract Start Date and End Date
- Maintenance Frequency: Monthly, Bi-monthly, Quarterly, 4-monthly, Half-yearly, Yearly
- Payment Type: One-time or Installments
- Contract Value / Total Value with GST
- Assigned Technicians (multi-select)
- Comprehensive contract flag (toggle)
- Status: Active, Expired, Expiring Soon, Cancelled

**Stats Row** at the top:
- Count of active contracts
- Count expiring within 30 days (highlighted in amber)
- Count of expired contracts
- Total aggregate contract value

**Renewals Tab**
Contracts due for renewal — filtered to show expiring and expired. Quick renewal button per contract.

**Payments Tab**
All payment records across AMC contracts. Search by client name. Log new payment:
- Amount
- Date
- Method (Cash, Bank Transfer, Cheque, UPI, Other)
- Reference Number
- Notes

Shows payment history with running totals vs contract value.

**Monthly Maintenance Tab** (two sub-tabs)

*Overview Sub-tab* (admin only):
A card grid showing ALL contracts and their current month maintenance status:
- Contract name, client, technician
- Status badge: **Done** (green) or **Pending** (amber)
- If done: shows the log date, technician who visited, and building/wing/lift details
- Expandable section showing full log details
- **"Log Maintenance"** quick button on pending cards
- Month label shown (e.g. "June 2026")

*Contracts Sub-tab*:
- Search/select a specific contract
- Opens the log entry form for that contract
- Log Form fields:
  - Visit Date (required)
  - Technician Name (required)
  - Building Name (optional — from project structure)
  - Wing/Floor (optional)
  - Lift No. (optional)
  - Remarks / Work Done
  - Signatory Name and Designation
  - Client Signature Canvas

Building/Wing/Lift selection is linked to the contract's project if one is assigned, allowing structured location tracking. This data prints in PDF reports and renders in the Overview tab cards.

#### Actions
- Create / Edit / Delete contracts
- Export individual contract PDF (using AMC contract HTML template)
- Log monthly maintenance visit
- Log payment received
- View payment history
- Bulk export (PDF or Excel)

---

### 6. Installation Activities

**Who uses it**: Admin (full), Technician (assigned jobs)

Tracks individual lift installation jobs — either standalone or linked to a project.

**Fields**:
- Project Name / Client Name
- Lift Type (Passenger, Goods, Hospital, MRL, etc.)
- Building, Wing, and Lift ID
- Assigned Technician(s)
- Scheduled Date
- Actual Start and Completion Date
- Status: Pending, In Progress, Completed
- Work Description
- Completion Photos (upload/camera)
- Completion Signature (client sign-off)
- Notes

**Actions**:
- Create new installation activity
- Edit / Update status
- Mark complete (captures time, signature, photos)
- View details
- Delete (admin only)
- Export PDF completion report

**Notifications**: When an installation is created, the assigned technician is notified. When it is marked complete, the admin is notified.

---

### 7. Repairs

**Who uses it**: Admin (full), Technician (assigned repairs)

Logs and tracks repair jobs that are not linked to a formal complaint.

**Fields**:
- Client Name / Project Link
- Address / Location
- Lift Type, Fault / Issue Type
- Priority: Low, Medium, High, Urgent
- Status: Reported, Diagnosed, In Progress, Completed, Cancelled
- Assigned Technician
- Scheduled Date
- Description of fault
- Repair work done
- Completion Photos
- Completion Signature

**Actions**:
- Create repair job
- Edit / Update progress
- Mark complete with photos and signature
- Delete (admin only)
- Export PDF report
- Bulk export

**Notifications**: Assigned technician notified on creation. Admin notified on completion.

---

### 8. Modernisation

**Who uses it**: Admin (full), Technician (assigned jobs)

Manages lift modernisation projects — controller upgrades, cabin refurbishments, drive replacements.

**Fields**:
- Project Name, Client Name
- Building, Wing, Lift ID
- Scope of work / Modernisation type
- Technician assignment
- Timeline: Start and End dates
- Status: Pending, In Progress, Completed, On Hold
- Work descriptions per phase
- Completion documentation (photos, signature)

**Actions**: Create, edit, complete with documentation, delete, export PDF.

**Notifications**: Technician notified on assignment. Admin notified on completion.

---

### 9. Maintenance Scheduling

**Who uses it**: Admin, Technician

The Maintenance view shows scheduled service visits derived from AMC contracts and individual maintenance schedules.

- View upcoming maintenance jobs by date
- See which technician is assigned per job
- Mark a visit complete (with photos and signature)
- Link each maintenance event back to its parent AMC contract or activity
- Generate a daily maintenance schedule report

---

### 10. Sales & CRM

**Who uses it**: Admin, Sales

The Sales module manages the full lead lifecycle from first enquiry to project creation.

#### Lead Form Fields
- Client Name (required)
- Contact Person, Designation
- Phone, Email
- Plot/Door No., Sector/Area, Address
- Lead Source: Direct, Website, Referral, Google, Social Media, Exhibition, Other
- Lead Type (multi-select): New Installation, Modernisation, AMC, Repair, Inspection
- Per-type notes (e.g. lift type required, number of floors, budget details)
- Multi-requirement flag — allows multiple elevator requirements on one lead
- Elevator Type, Drive Type, Capacity, Number of Lifts (per requirement)
- Budget (₹)
- Lead Stage: New, Contacted, Qualified, Proposal Sent, Won, Lost
- Priority: Low, Medium, High, Urgent
- Assigned To (salesperson)
- Next Follow-up Date
- Notes

#### Views
- **Pipeline View**: Kanban board with columns per stage — cards showing client name, requirement, value, priority badge, follow-up date
- **All Leads View**: Searchable table list with all fields

#### Lead Card Actions
- **Activity** button: Opens per-lead activity timeline (calls made, emails sent, meetings)
- **PDF** button: Exports a formatted lead summary PDF
- **Edit** button: Opens full edit modal
- **Close** button: Opens close modal to mark lead Won or Lost
  - If **Won**: Admin/sales marks the deal closed, enters win details. The system **automatically creates a Project record** with all lead data (client name, phone, email, address — combining plotNo + sector + address fields, elevator type, value, notes)
  - If **Lost**: Enter lost reason for reporting

#### Filters
- Search by client name, contact person, phone
- Filter by stage
- Filter by priority
- Filter by assigned salesperson
- Date range

#### Export
- **Excel Export**: Full leads data with custom period and report title
- **PDF Export**: Summary report for selected period and filters
- Custom report title field (saved per user)

#### Automated Follow-ups
Cloud Functions send a daily push notification at 8:30 AM to the assigned salesperson (or admin) for any leads whose follow-up date is today.

---

### 11. Billing

**Who uses it**: Admin (full), Sales (create + view)

The Billing module has four document types that follow the sales-to-payment pipeline.

#### Quotations
Generated when a proposal is being sent to a client before work begins.

- **Fields**: Client name, contact, project reference, quotation number (auto), date, validity, line items (description + quantity + rate + amount), discount, CGST/SGST/IGST, grand total, terms and conditions, notes
- **Actions**: Create, edit, delete, export PDF (using HTML template), email to client, convert to invoice
- **Status**: Draft, Sent, Accepted, Rejected, Expired

#### Proforma Invoices
Pre-invoices sent to clients before formal billing. Structurally similar to quotations.

- **Fields**: Same as quotation plus proforma invoice number, expected payment date
- **Actions**: Create, edit, delete, export PDF, email, convert to tax invoice
- **Status**: Draft, Sent, Paid, Cancelled

#### Tax Invoices
GST-compliant invoices with full tax breakdown.

- **Fields**: Invoice number (auto), date, due date, client name, client GST number, billing address, line items, HSN/SAC codes, CGST rate + amount, SGST rate + amount, IGST rate + amount, grand total, payment terms
- **Payment Tracking**: Status (Pending, Partial, Paid, Cancelled), payment date, payment method, reference
- **Overdue Detection**: Invoices past due date highlighted, trigger automated morning reminders
- **Actions**: Create, edit, delete, export PDF, email, record payment, bulk export

#### Purchase Orders
Orders placed to vendors/suppliers for parts and materials.

- **Fields**: PO number (auto), vendor name (from vendors collection), date, expected delivery, line items (item/description + quantity + unit price + amount), total, payment terms, delivery address, notes
- **Status**: Draft, Sent to Vendor, Received, Cancelled
- **Actions**: Create, edit, delete, export PDF, email to vendor, mark received

#### Bulk Operations (all billing types)
- Excel import (batch create)
- PDF export with period selection
- Excel export with period selection

---

### 12. Bill of Materials (BOM)

**Who uses it**: Admin, Sales

BOMs detail the parts and materials required for a project or repair.

#### BOM Form
- BOM Number (auto-generated)
- Project Link (optional)
- Client Name
- Description / Scope reference
- **Item Lines** (add/remove dynamically):
  - Item Name / Part Number
  - Category
  - Quantity
  - Unit Price (₹)
  - Supplier
  - Notes
- Total value (auto-calculated)
- Status: Draft, Finalized, Ordered, Received

#### Actions
- Create / edit / delete BOMs
- Link items from the materials/inventory catalogue
- Export BOM as PDF (using BOM HTML template with description column sized for long text, separate column widths for compact display)
- Convert to Purchase Order
- Link to invoice
- Bulk export

#### Notification
When a BOM is created, the admin is notified with the BOM number, project/client, and total item count.

---

### 13. Inventory

**Who uses it**: Admin, Technician (service van view only)

Tracks physical stock across three locations.

#### Locations
- **Warehouse**: Main stock storage
- **Service Van**: Parts carried in technician vehicles
- **Office**: Consumables and office supplies

Each location is a separate tab showing only items at that location.

#### Item Fields
- Item Name (required)
- SKU / Part Code
- Category
- Current Quantity (required)
- Minimum Stock / Reorder Level (required) — items at or below this level show as low stock
- Unit (each, kg, metres, litres, etc.)
- Unit Price (₹)
- Supplier
- Location
- Last Updated date

#### Features
- **Low Stock Alerts**: Items flagged in red when quantity ≤ minimum stock
- **Add Stock**: Record receipt of new stock with date and quantity received
- **Consume Stock**: Deduct quantity used on a job
- **Transfer**: Move items between warehouse, service van, office
- **Search and filter** by name, category, low-stock toggle
- **Bulk Import**: Upload Excel file with item list
- **Export**: Full inventory report (PDF or Excel)

---

### 14. Vendors

**Who uses it**: Admin

Central database of all suppliers and service providers.

#### Vendor Fields
- Vendor Name (required)
- Contact Person
- Phone, Email
- Address, City
- GST Number
- Bank Details (for payment processing)
- Payment Terms (e.g. Net 30, Advance, COD)
- Category: Parts Supplier, Service Provider, Electrical, Mechanical, IT, Other
- Rating (1–5 stars)
- Status: Active, Inactive
- Notes

#### Actions
- Create / edit / delete vendors
- Search by name or category
- Filter by status, category, rating
- View linked Purchase Orders per vendor
- Quick contact buttons (call, email)
- Export vendor list (PDF or Excel)

---

### 15. HR — Employee Management

**Who uses it**: Admin only

Complete employee directory and records management.

#### Employee Form Fields
- Full Name (required)
- Username (for app login)
- Password (set on create; changed separately via "Change Password" button)
- Email, Phone
- Department
- Role: Admin, Sales, Technician, Reception, User
- Status: Active, Inactive
- Employee ID
- Joining Date
- Address
- Emergency Contact Name and Phone
- Qualification
- Skills
- Bank Account Details (bank name, account number, IFSC)
- PAN Number, Aadhar Number

#### Features
- **Employee Directory**: Card and table views with search by name, role, department
- **Filter**: By role, department, status (active/inactive)
- **Change Password**: Separate modal to update an employee's login password without revealing the current one
- **Deactivate**: Mark employee inactive (prevents login, removes from assignment dropdowns)
- **Bulk Import**: Upload Excel file to create multiple employees
- **Export**: Employee roster PDF or Excel
- **Salary Configuration**: Per-employee salary breakdown (shown in the employee detail)
- Leave balance tracking per employee

#### Salary Slips (within HR view)
- Generate salary slips per employee per month
- Shows earnings (basic, HRA, DA, allowances) and deductions (PF, ESI, income tax, other)
- Net pay auto-calculated
- Slip number auto-generated (SL-YYYYMM-XXXXX format)
- Export individual slip as PDF
- Email slip to employee
- Delete slip

#### Notification
When a salary slip is generated, the employee receives a push notification with the month and net pay amount. HR/admin also get a notification.

---

### 16. Salary Management

**Who uses it**: Admin only

Dedicated salary configuration and payroll module (accessible via HR sub-section).

#### Salary Configuration (per employee)
- Monthly Basic Salary
- HRA (₹)
- Dearness Allowance (₹)
- Other Allowances (itemised)
- Deductions: PF (₹), ESI (₹), Income Tax (₹), Other Deductions (itemised)
- Net Pay (auto-calculated)
- Effective From date

#### Payroll Run
- Select month/year
- Generate slips for all active employees (batch)
- Review before confirming
- Send notifications to all employees

#### Reports
- Monthly payroll summary (all employees)
- Individual slip (PDF download)
- Bank transfer file (for bulk salary payment)

---

### 17. Attendance

**Who uses it**: Admin (full), All roles (own records)

Tracks daily employee check-in and check-out.

#### How It Works
- Employees open the Attendance tab and tap **Check In** — the system records the timestamp automatically
- At the end of the day, they tap **Check Out**
- Check-ins after 10:00 AM IST are flagged as **late** — the admin receives a separate "Late Check-In" notification immediately
- Regular check-ins trigger a standard "Employee Checked In" notification to the admin

#### Admin Features
- See all employees' attendance for any date
- **Edit attendance**: Override or add records for any employee (sets `adminEdited: true` flag, which triggers a notification to the employee)
- Filter by date, employee, status
- Mark employee as on-leave for a date
- **Bulk import**: Upload attendance records for past dates

#### Attendance Status Values
- Present, Absent, Leave, Late, Half-Day

#### Reports
- Daily attendance sheet (who's in, who's out, late arrivals)
- Monthly summary per employee (days present, absent, leaves)
- Absent employee list for a date

#### Punch-In Reminder
A scheduled Cloud Function runs at 9:30 AM IST daily. It checks all active employees (excluding admins) who have not yet checked in and sends each one a push notification reminding them to mark attendance.

---

### 18. Leave Management

**Who uses it**: All roles (request), Admin (approve/reject)

#### Leave Request Form
- Employee Name (auto-filled for logged-in user; admin can select any employee)
- Leave Type: Casual, Sick, Earned, Maternity, Unpaid, Other
- Start Date (required)
- End Date (required)
- Number of Days (auto-calculated, excludes weekends if configured)
- Reason / Remarks

#### Status Flow
**Pending → Approved** or **Pending → Rejected** (with rejection reason)

#### Features
- Employees submit requests from the app; they see their own requests and status
- Admin sees all pending requests with approve/reject buttons
- On approval or rejection, the employee receives an immediate push notification with the decision
- Leave balance tracking per type per employee
- Calendar view of approved leaves across the team
- Bulk export leave report

---

### 19. Technician Tracking

**Who uses it**: Admin (view all), Technician (own session)

Real-time GPS location tracking of field technicians.

#### How It Works
- Technician opens the Tracking tab and starts a **Tracking Session**
- Their GPS coordinates are streamed to Firestore at regular intervals
- Admin sees a live map with all active technicians' locations
- When a technician arrives at a project site (within the configured geofence radius), the app records a **Site Visit Event** — a timestamped arrival confirmation
- When the session ends, the full route is saved to Location History

#### Data Captured
- Real-time coordinates (lat/lng) at intervals
- Session start and end timestamps
- Total distance covered (estimated)
- Site arrival events with timestamp
- Time spent on-site per project

#### Admin Map Features
- Live map showing dots for each active technician
- Click on a dot to see the technician's name and current location
- Historical route playback per session
- Filter by technician or date

#### Geofence Check-In
Each project has a configured latitude, longitude, and arrival radius (km). When a technician's GPS enters this radius, a site visit event is auto-created — this can be used to verify attendance at the job site and auto-generate attendance records.

---

### 20. Inspection

**Who uses it**: Admin, Sales, Technician

Formal lift inspection and compliance audit module.

#### Inspection Form
- Project / Lift ID (links to a project in the system)
- Inspection Date (required)
- Inspector Name
- Inspection Type: Pre-operational, Periodic, Safety, Compliance, Handover, Other
- **Checklist** (pass / fail / N.A. per item):
  - Safety gates and interlocks
  - Emergency stop button
  - Emergency lighting
  - Ventilation
  - Speed and emergency brake
  - Oil and hydraulic condition (if applicable)
  - Wire rope / cable condition
  - Buffer condition
  - Car and landing door operation
  - Overload device
  - Phone / intercom system
  - Machine room condition
  - ... and more items per inspection type
- Non-conformances / Defects found (free text)
- Photos (upload or camera)
- Inspector Signature
- Client/Representative Signature
- Overall Result: Passed, Failed, Conditional Pass
- Next Inspection Due Date

#### Actions
- Create inspection record
- Edit / update
- Generate PDF inspection report (with checklist, findings, photos, signatures)
- Track remedial action items
- Schedule next inspection
- Compliance calendar view (upcoming inspections across all sites)

---

### 21. Gallery

**Who uses it**: All roles (with upload rights per role)

Centralised photo and document storage linked to business records.

#### Features
- **Folders**: Create named folders to organise files by project, client, or category
- **Upload**: Multiple files at once from device gallery or camera capture
- **Link to records**: Each photo/document can be tagged to a project, complaint, repair, or inspection
- **Search**: By file name, folder, or linked record
- **Bulk download**: Select multiple files for ZIP download
- **Delete**: With confirmation (admin only)
- **Preview**: In-app image viewer for photos

#### File Types Supported
Photos (JPG, PNG, HEIC), PDFs, and common document types.

---

### 22. Activities (Audit Log)

**Who uses it**: Admin only

A complete chronological log of all changes made in the system.

#### What Gets Logged
- Record creation (who created what, when)
- Record updates (what changed, who changed it, what the old and new values were)
- Record deletion
- Status changes
- User login/logout events
- File uploads
- Document exports

#### Features
- Search by keyword
- Filter by record type (project, complaint, AMC, task, etc.)
- Filter by date range
- Filter by user (who performed the action)
- Paginated list with timestamps and actor names
- Click through to the referenced record

---

### 23. Reminders

**Who uses it**: All roles (role-filtered)

A unified screen showing all pending alerts and time-sensitive items for the logged-in user.

#### Reminder Categories (shown based on role)
- Overdue Tasks (their own for non-admin, all for admin)
- AMC contracts expiring soon (admin/sales)
- Quotations pending follow-up (admin/sales)
- Leave requests awaiting approval (admin)
- Monthly maintenance visits pending (admin/technician)
- Complaints open and unresolved (admin/technician)
- Invoice payment overdue (admin/sales)

Items are sorted by urgency (most overdue or nearest due date first). Each item has a quick-navigate button to jump to the relevant module.

---

### 24. AI Assistant

**Who uses it**: Admin (full), other roles (limited)

The **Elevex AI** assistant chat interface provides intelligent help within the app context.

#### Features
- **Chat interface**: Natural language conversation
- **Context awareness**: The AI knows the current user's role and can reference business data
- **Smart suggestions**: 
  - Which tasks are overdue and should be escalated
  - Which leads need follow-up today
  - Which AMC contracts are approaching expiry
  - Best technician available for an assignment
- **Report generation**: Ask for a summary (e.g. "show me complaints resolved this month") and get a formatted response
- **Data analysis**: Revenue trends, team performance, pipeline conversion
- **Q&A**: Answer business questions using live Firestore data

---

### 25. Settings

**Who uses it**: All roles (personal settings)

Personal preferences for the logged-in user.

#### Settings Available
- **Theme**: Dark mode / Light mode toggle
- **Language**: Interface language preference
- **Date/Time Format**: Regional formatting (DD/MM/YYYY or MM/DD/YYYY, 12h/24h)
- **Timezone**: IST (default), configurable
- **Default Currency**: ₹ Indian Rupee (default)
- **Notification Preferences**: Enable/disable per channel (assignments, reminders, alerts, updates)
- **Change Password**: Update login password
- **Pinned Tab**: Set the default landing tab after login

---

### 26. Configurations

**Who uses it**: Admin only

System-wide settings that affect all users.

#### Configuration Areas
- **Company Details**: Name, registered address, logo, GST number, phone, email — used in all PDF templates
- **Email Settings**: SMTP server configuration for sending emails from the app
- **Invoice Configuration**: Default tax rates (CGST/SGST/IGST), invoice prefix format, payment terms
- **Notification Configuration**: Which events trigger notifications, notification preferences per role
- **Module Visibility**: Enable/disable specific modules per role
- **Custom Fields**: Add extra fields to specific record types
- **Billing Templates**: Manage which HTML templates are active for PDF generation

---

## Cloud Functions & Automation

Cloud Functions are server-side automated processes that run in response to database events. They power all push notifications and business automations.

### Triggers on New Record Created

| Event | Who Gets Notified | Channel |
|---|---|---|
| New task created | Assigned technician/employee | Assignments |
| New lead created | Admin + assigned salesperson | Assignments |
| New complaint filed | Admin + all technicians | Alerts |
| New installation activity created | Assigned technicians + admin | Assignments |
| New repair job created | Assigned technicians + admin | Updates |
| New modernisation job created | Assigned technicians + admin | Assignments |
| New AMC contract created | Admin | Updates |
| AMC monthly maintenance log saved | Admin (with location detail) | Updates |
| New quotation created | Admin | Updates |
| New invoice created (all 3 types) | Admin | Updates |
| New BOM created | Admin | Updates |
| Salary slip generated | Employee (net pay amount) + Admin/HR | Updates |
| Leave request submitted | Admin + HR | Alerts |
| New project created | Admin | Updates |
| New purchase order created | Admin | Updates |

### Triggers on Record Updated

| Event | Who Gets Notified | Channel |
|---|---|---|
| Task reassigned to new person | New assignee | Assignments |
| Task marked completed | Admin | Updates |
| Lead assigned to salesperson | That salesperson | Assignments |
| Lead won / qualified | Admin | Updates |
| Lead follow-up date set | Admin | Reminders |
| Complaint assigned to technician | That technician | Assignments |
| Complaint resolved/closed | Admin | Updates |
| Installation marked complete | Admin | Updates |
| Repair marked complete | Admin | Updates |
| Modernisation marked complete | Admin | Updates |
| AMC payment logged | Admin (amount + method) | Updates |
| AMC status changed | Admin (client + what changed + who) | Updates |
| AMC monthly maintenance completed | Admin | Updates |
| Employee checks out | Admin (check-out time) | General |
| Admin edits an attendance record | That employee | Updates |
| Leave approved or rejected | That employee | Updates / Alerts |
| Project status changed | Admin | Updates |

---

## Scheduled Reminders

Automated jobs run at fixed times daily or monthly to keep everyone on top of upcoming obligations.

| Time (IST) | What Runs | Who Gets It |
|---|---|---|
| 8:00 AM daily | Overdue tasks reminder | Assigned employee + admin (daily summary) |
| 8:00 AM daily | Service/repair/installation due today or tomorrow | Assigned technician + admin |
| 8:30 AM daily | Lead follow-up reminders (any lead with follow-up = today) | Assigned salesperson or admin |
| 9:00 AM daily | AMC expiry alert (1 day / 7 days / 30 days away) | Admin + sales |
| 9:00 AM daily | AMC instalment payment due (3 days / 7 days away) | Admin + sales |
| 9:30 AM daily | Invoice overdue reminder | Admin + sales |
| 9:30 AM daily | Punch-in reminder (employees who haven't checked in) | That employee individually |
| 1st of month, 8:00 AM | Monthly maintenance due — per technician summary | Each technician (their pending sites) + admin (total count) |

---

## Document Generation — PDF & Excel

### PDF Generation
All billing and operational PDFs are generated in the browser by rendering an HTML template, injecting data, and converting to PDF using jsPDF. The output preserves the full design of the HTML template including letterheads, tables, signature blocks, and terms.

**PDF Documents Generated**:
- Quotation (with lift-wise BOM, terms, signature blocks)
- Proforma Invoice
- Tax Invoice (with GST breakdown)
- Bill of Materials
- AMC Contract
- Complaint Receipt (with signature and satisfaction rating)
- Salary Slip
- Inspection Report
- Project Summary
- Bulk list exports (complaints, tasks, AMC, leads, etc.)

### Excel Generation
Excel exports use ExcelJS to produce formatted .xlsx files with company headers, column formatting, data rows, and summary rows.

**Excel Exports**:
- All of the above document types
- Attendance reports
- Leave summaries
- Payroll summaries
- Inventory reports
- Vendor lists
- Lead pipeline reports

### Address Format (all billing documents)
The "To" section of all invoices and quotations follows this structure:

**Left side**:
- Secretary / Chairman,
- [Society / Building Name]
- [Address]

**Right side**:
- Reference No. and Date
- [Client Contact Name] (bold)
- [Contact Person]
- [Phone]
- [Email]

### Signature Block (all billing documents)
All documents have a two-column signature section at the bottom:
- **Left**: "For [Company Name]" with authorised signatory line
- **Right**: "ACCEPTANCE OF QUOTATION" / "ACCEPTANCE" with client signature line

---

## HTML Billing Templates

Five HTML template files drive the visual design of all generated PDFs. Each template uses `{{variable}}` placeholders that are replaced at generation time.

### Template Variables

**Company variables**: `{{company.name}}`, `{{company.address}}`, `{{company.phone}}`, `{{company.email}}`, `{{company.gst}}`

**Client variables**: `{{client.name}}` (contact person), `{{client.societyName}}` (building/society name), `{{client.contactPerson}}`, `{{client.phone}}`, `{{client.email}}`, `{{client.address}}`

**Document variables**: `{{doc.number}}`, `{{doc.date}}`, `{{doc.validUntil}}`, `{{doc.subject}}`

**Templates**:
1. **Avant Quotation.html** — Quotation with lift specs, BOM table, terms, two-column signature
2. **BOM-Template.html** — Bill of Materials with wider description column, compact quantity/rate columns
3. **Avant invoice.html** — Standard invoice with payment details
4. **Avant proforma invoice.html** — Proforma with expiry date
5. **Avant tax invoice.html** — GST-compliant with HSN codes, CGST/SGST/IGST columns

---

## Data Collections Reference

The following Firestore collections store all app data:

| Collection | What It Stores |
|---|---|
| `employees` | Staff records with login credentials, role, contact info, bank details |
| `users` | Legacy/admin accounts (CreateAdmin page writes here) |
| `projects` | Lift installation/service projects with building/wing/lift hierarchy |
| `projectTimeline` | Audit trail of changes per project |
| `maintenance` | Scheduled maintenance visit records |
| `amc` | Annual maintenance contracts |
| `amcMonthlyMaintenance` | Monthly maintenance visit logs |
| `installationActivities` | Individual installation job records |
| `modernisationActivities` | Modernisation job records |
| `repairActivities` | Repair job records |
| `complaintActivities` | Client complaint records |
| `tasks` | Team task assignments |
| `leads` | CRM leads and sales pipeline |
| `activities` | System-wide audit log |
| `invoices` | Standard invoices |
| `proformaInvoices` | Proforma invoice records |
| `taxInvoices` | GST tax invoice records |
| `quotations` | Sales quotations |
| `purchaseOrders` | Vendor purchase orders |
| `bom` | Bills of materials |
| `vendors` | Supplier/vendor database |
| `materials` | Parts and materials catalogue |
| `inventory` | Physical stock records by location |
| `salarySlips` | Monthly salary slip documents |
| `salaryConfig` | Per-employee salary structure |
| `leaveRequests` | Employee leave applications |
| `attendance` | Daily check-in/check-out records |
| `technicianLocations` | Real-time GPS coordinates |
| `trackingSessions` | Tracking session records |
| `siteVisitEvents` | Geofence-based site arrival events |
| `locationHistory` | Historical route data per session |
| `gallery` | Photo and document file references |
| `galleryFolders` | Gallery folder hierarchy |
| `inspections` | Lift inspection records |
| `fcmTokens` | Device push notification tokens per user |
| `settings` | Global system settings |
| `configurations` | System configuration per module |
| `pdfCache` | Cached generated PDF data |

---

## Admin Management

**URL**: `/create-admin-user`

A public utility page (no login required) for setting up and managing admin accounts.

- **Lists all existing admin accounts** with username and email
- **Edit button** per admin to update their name, username, email, or password
  - Password is optional when editing — leave blank to keep current
- **Create New Admin** form always visible at the bottom — allows multiple admin accounts
- All admin accounts are stored in the `users` collection with `role: 'admin'` and `status: 'active'`

**DeleteAllView** (`/delete-all`) — Restricted utility for clearing the database in development/testing scenarios. Protected in production.

---

*Avant Elevators EMS v2.0 — Developed by Ambivare*
