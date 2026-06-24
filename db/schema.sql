-- ============================================
-- FILE: schema.sql
-- PATH: db/schema.sql
-- VERSION: 2.5.3
-- DESCRIPTION: D1 database schema for HALQ v2 — all tables.
-- ============================================

-- Work Orders — core table, raw AppFolio export + HALQ metadata
CREATE TABLE IF NOT EXISTS work_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wo_number TEXT NOT NULL UNIQUE,
    property TEXT,
    property_name TEXT,
    property_street TEXT,
    unit TEXT,
    primary_resident TEXT,
    created_at TEXT,
    priority TEXT,
    status TEXT,
    vendor TEXT,
    job_description TEXT,
    instructions TEXT,
    work_order_type TEXT,
    home_warranty_expiration TEXT,
    estimate_req_on TEXT,
    estimated_on TEXT,
    estimate_amount REAL,
    estimate_approval_status TEXT,
    estimate_approved_on TEXT,
    estimate_approval_last_requested_on TEXT,
    scheduled_start TEXT,
    scheduled_end TEXT,
    work_done_on TEXT,
    completed_on TEXT,
    amount REAL,
    invoice TEXT,
    unit_turn_id TEXT,
    recurring TEXT,
    work_order_issue TEXT,
    ai_resolved TEXT,
    -- HALQ metadata
    follow_up_date TEXT,
    category_ids TEXT, -- JSON array of category IDs
    is_active INTEGER DEFAULT 1,
    imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Categories — tag-based folder system
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#5b9cf6',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- WO Tags — many-to-many link (redundant with category_ids JSON, but queryable)
CREATE TABLE IF NOT EXISTS wo_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wo_number TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wo_number) REFERENCES work_orders(wo_number) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(wo_number, category_id)
);

-- Vendors — directory for message templates
CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    phone1 TEXT,
    phone2 TEXT,
    email TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Message Templates — tenant/vendor/owner
CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT NOT NULL, -- 'tenant', 'vendor', 'owner'
    type TEXT NOT NULL, -- 'email', 'text'
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Notes — notebook/section/page hierarchy
CREATE TABLE IF NOT EXISTS notebooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    open INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notebook_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#5b9cf6',
    open INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- Audit Log — every action timestamped
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT, -- 'work_order', 'category', 'vendor', etc.
    entity_id TEXT,
    details TEXT, -- JSON
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User Settings — theme, font, layout, preferences
CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Users — single-user auth table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Bridge Heartbeats — sync status
CREATE TABLE IF NOT EXISTS bridge_heartbeats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_seen TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed default categories
INSERT OR IGNORE INTO categories (id, name, color, sort_order) VALUES
(1, 'Follow-up', '#5b9cf6', 1),
(2, 'Urgent', '#ff453a', 2),
(3, 'Waiting on Vendor', '#ff9f0a', 3),
(4, 'Waiting on Tenant', '#34c759', 4),
(5, 'Waiting on Owner', '#bf5af2', 5),
(6, 'Inspection', '#00c7be', 6),
(7, 'Recurring', '#ffd93d', 7);

-- Seed default message templates
INSERT OR IGNORE INTO message_templates (group_name, type, name, body, sort_order) VALUES
('tenant', 'email', 'Not heard from contractor', 'Hello {res},\n\nIf you have not heard from our contractor, please call them directly to schedule your repair.\n\n{vendor_details}\n\n', 1),
('tenant', 'email', 'Vendor trying to reach you', 'Hello {res},\n\nOur vendor is trying to reach you. Please call them directly to schedule your repair.\n\n{vendor_details}\n\n', 2),
('tenant', 'text', 'Not heard from contractor', 'Hi {res}, if you have not heard from our contractor please call them directly: {vendor_details}', 1),
('tenant', 'text', 'Vendor trying to reach you', 'Hi {res}, our vendor is trying to reach you. Please call them: {vendor_details}', 2),
('vendor', 'email', 'Follow up', 'Hello,\n\nWhat is the update on WO #{wo} — {prop}?\n\n', 1),
('vendor', 'email', 'Invoice', 'Hello,\n\nPlease send your invoice for WO #{wo} — {prop}.\n\n', 2),
('vendor', 'text', 'Follow up', 'Hi, what is the update on WO #{wo} at {prop}?', 1),
('vendor', 'text', 'Invoice', 'Hi, please send your invoice for WO #{wo} at {prop}.', 2);
