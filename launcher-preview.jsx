import { useState, useRef, useEffect } from "react"

const T = {
  bg:       '#1c1c1c',
  surface:  '#252525',
  surface2: '#2e2e2e',
  border:   '#3a3a3a',
  border2:  '#484848',
  accent:   '#5b9cf6',
  accent2:  '#a78bfa',
  green:    '#4ade80',
  red:      '#f87171',
  text:     '#f0f0f0',
  text2:    '#a0a0a0',
  text3:    '#666666',
}

const AVATAR_COLORS = [
  '#5b9cf6','#a78bfa','#4ade80','#fb923c',
  '#f87171','#fbbf24','#34d399','#22d3ee',
]

const SAMPLE_PROFILES = [
  { id: 'p1', name: 'Talley Properties',   url: 'talley.appfolio.com',   color: '#5b9cf6', running: true  },
  { id: 'p2', name: 'Westside Management', url: 'westside.appfolio.com', color: '#a78bfa', running: false },
  { id: 'p3', name: 'Harbor Realty',       url: 'harbor.appfolio.com',   color: '#4ade80', running: false },
]

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Custom styled checkbox ────────────────────────────────────────────────────
function Checkbox({ checked, indeterminate, onChange }) {
  const box = {
    width: 15, height: 15, flexShrink: 0,
    borderRadius: 3,
    border: `1.5px solid ${checked || indeterminate ? T.accent : T.border2}`,
    background: checked ? T.accent : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.1s',
  }
  return (
    <div style={box} onClick={e => { e.stopPropagation(); onChange() }}>
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {!checked && indeterminate && (
        <div style={{ width: 7, height: 1.5, background: T.accent, borderRadius: 1 }} />
      )}
    </div>
  )
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ msg, onOK, onCancel }) {
  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>⚠ Confirm</div>
        <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.6 }}>{msg}</div>
        <div style={S.modalFooter}>
          <button style={S.btnCancel} onClick={onCancel}>Cancel</button>
          <button style={{ ...S.btnSave, background: T.red }} onClick={onOK}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── New / Edit profile modal ───────────────────────────────────────────────────
function ProfileModal({ profile, onSave, onClose }) {
  const [name,  setName]  = useState(profile?.name  || '')
  const [url,   setUrl]   = useState(profile?.url   || '')
  const [color, setColor] = useState(profile?.color || AVATAR_COLORS[0])
  const isEdit = !!profile

  function handleSave() {
    if (!name.trim()) return
    onSave({ name: name.trim(), url: url.trim(), color })
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>{isEdit ? '✎ Edit Profile' : '+ New Profile'}</div>

        <div style={S.field}>
          <div style={S.label}>Profile Name</div>
          <input style={S.input} value={name} placeholder="e.g. Talley Properties"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
        </div>

        <div style={S.field}>
          <div style={S.label}>Appfolio URL</div>
          <input style={S.input} value={url} placeholder="yourcompany.appfolio.com"
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </div>

        <div style={S.field}>
          <div style={S.label}>Color</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {AVATAR_COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{
                width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                border: c === color ? '2px solid #fff' : '2px solid transparent',
                transform: c === color ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.1s',
              }} />
            ))}
          </div>
        </div>

        <div style={S.modalFooter}>
          <button style={S.btnCancel} onClick={onClose}>Cancel</button>
          <button style={S.btnSave} onClick={handleSave}>{isEdit ? '💾 Save' : '+ Create'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Profile card ───────────────────────────────────────────────────────────────
function ProfileCard({ profile, selected, onToggle, onLaunch, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function away(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [menuOpen])

  return (
    <div style={{
      background: selected ? T.accent + '0e' : T.surface,
      border: `1px solid ${profile.running ? T.accent + '55' : selected ? T.accent + '55' : T.border}`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      transition: 'all 0.12s', position: 'relative',
      boxShadow: profile.running ? `0 0 0 1px ${T.accent}18` : 'none',
    }}>

      {/* Checkbox */}
      <Checkbox checked={selected} onChange={() => onToggle(profile.id)} />

      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: 9,
        background: profile.color + '22', border: `1px solid ${profile.color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 12, color: profile.color, flexShrink: 0,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {initials(profile.name)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {profile.name}
        </div>
        <div style={{ fontSize: 10, color: T.text3, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {profile.url || '—'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {profile.running && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: T.green + '18', border: `1px solid ${T.green}44`,
            borderRadius: 10, padding: '3px 8px',
            fontSize: 9, color: T.green, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, animation: 'blink 2s infinite' }} />
            Running
          </div>
        )}

        <button onClick={() => onLaunch(profile)} style={{
          padding: '4px 12px', borderRadius: 6, border: 'none',
          background: profile.running ? T.surface2 : T.accent,
          color: profile.running ? T.text2 : '#fff',
          fontSize: 11, fontWeight: 500, cursor: 'pointer',
        }}>
          {profile.running ? '↗ Focus' : '▶ Launch'}
        </button>

        <div style={{ position: 'relative' }} ref={menuRef}>
          <button onClick={() => setMenuOpen(v => !v)} style={{
            width: 26, height: 26, borderRadius: 5,
            border: `1px solid ${T.border2}`, background: 'transparent',
            color: T.text3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>⋮</button>

          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 30, zIndex: 100,
              background: T.surface, border: `1px solid ${T.border2}`,
              borderRadius: 8, padding: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 150,
            }}>
              <div onClick={() => { setMenuOpen(false); onEdit(profile) }}
                onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ padding: '7px 12px', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: T.text2, display: 'flex', alignItems: 'center', gap: 8 }}>
                ✎ &nbsp;Edit Profile
              </div>
              <div style={{ height: 1, background: T.border, margin: '3px 4px' }} />
              <div onClick={() => { setMenuOpen(false); onDelete(profile) }}
                onMouseEnter={e => e.currentTarget.style.background = T.red + '18'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ padding: '7px 12px', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: T.red, display: 'flex', alignItems: 'center', gap: 8 }}>
                🗑 &nbsp;Delete Profile
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  modalBox: {
    background: T.surface, border: `1px solid ${T.border2}`,
    borderRadius: 12, padding: '22px 26px', width: 340,
    display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  modalTitle: { fontSize: 13, fontWeight: 600, color: T.text },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: {
    fontSize: 9, color: T.text3, textTransform: 'uppercase',
    letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
  },
  input: {
    background: T.surface2, border: `1px solid ${T.border2}`,
    borderRadius: 6, padding: '6px 10px', fontSize: 11,
    color: T.text, outline: 'none', fontFamily: "'Inter', sans-serif",
  },
  modalFooter: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  btnCancel: {
    padding: '7px 16px', borderRadius: 6, border: `1px solid ${T.border2}`,
    background: 'none', color: T.text2, cursor: 'pointer', fontSize: 12,
  },
  btnSave: {
    padding: '7px 20px', borderRadius: 6, border: 'none',
    background: T.accent, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500,
  },
}

// ── Main launcher ──────────────────────────────────────────────────────────────
export default function HALQLauncher() {
  const [profiles,     setProfiles]     = useState(SAMPLE_PROFILES)
  const [selected,     setSelected]     = useState(new Set())
  const [showNew,      setShowNew]      = useState(false)
  const [editTarget,   setEditTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [statusMsg,    setStatusMsg]    = useState('Ready')
  const nextId = useRef(4)

  // ── Selection state ─────────────────────────────────────────────────────
  const allIds       = profiles.map(p => p.id)
  const allChecked   = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someChecked  = allIds.some(id => selected.has(id)) && !allChecked
  const selectedList = profiles.filter(p => selected.has(p.id))

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(allIds))
  }

  // ── Launch logic ─────────────────────────────────────────────────────────
  function launchOne(profile) {
    if (profile.running) { setStatusMsg(`Focused: ${profile.name}`); return }
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, running: true } : p))
    setStatusMsg(`Launched: ${profile.name}`)
  }

  function launchSelected() {
    const toStart = selectedList.filter(p => !p.running)
    if (!toStart.length) return
    setProfiles(prev => prev.map(p => selected.has(p.id) ? { ...p, running: true } : p))
    setStatusMsg(`Launched ${toStart.length} profile${toStart.length > 1 ? 's' : ''}`)
  }

  function launchAll() {
    const toStart = profiles.filter(p => !p.running)
    if (!toStart.length) return
    setProfiles(prev => prev.map(p => ({ ...p, running: true })))
    setStatusMsg(`Launched all ${toStart.length} profile${toStart.length > 1 ? 's' : ''}`)
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  function handleCreate(data) {
    const id = 'p' + nextId.current++
    setProfiles(prev => [...prev, { id, ...data, running: false }])
    setShowNew(false)
  }

  function handleEdit(data) {
    setProfiles(prev => prev.map(p => p.id === editTarget.id ? { ...p, ...data } : p))
    setEditTarget(null)
  }

  function handleDelete() {
    setSelected(prev => { const n = new Set(prev); n.delete(deleteTarget.id); return n })
    setProfiles(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const runningCount       = profiles.filter(p => p.running).length
  const selectedNotRunning = selectedList.filter(p => !p.running).length
  const allAlreadyRunning  = profiles.length > 0 && profiles.every(p => p.running)

  return (
    <div style={{
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: T.bg, color: T.text, minHeight: '100vh',
      display: 'flex', flexDirection: 'column', WebkitFontSmoothing: 'antialiased',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        button { transition: filter 0.1s; }
        button:not([disabled]):hover { filter: brightness(1.12); }
        input:focus { border-color: ${T.accent} !important; outline: none; }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Titlebar ── */}
      <div style={{
        height: 36, background: T.surface, borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8,
        flexShrink: 0, userSelect: 'none',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 11, color: '#fff',
        }}>H</div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.15em' }}>HALQ</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: T.text3, marginLeft: 2 }}>LAUNCHER</span>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, padding: '24px 28px', maxWidth: 660, width: '100%', margin: '0 auto' }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Profiles</div>
            <div style={{ fontSize: 10, color: T.text3, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
              {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
              {runningCount > 0 ? ` · ${runningCount} running` : ''}
            </div>
          </div>
          <button onClick={() => setShowNew(true)} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: T.accent, color: '#fff', fontSize: 11, fontWeight: 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> New Profile
          </button>
        </div>

        {profiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: T.text3, fontSize: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
            <div>No profiles yet.</div>
            <div style={{ fontSize: 11, marginTop: 6 }}>Create one to get started.</div>
          </div>
        ) : (<>

          {/* ── Select-all / bulk action bar ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', marginBottom: 8,
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
          }}>
            {/* Select all checkbox */}
            <Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} />

            {/* Label */}
            <span style={{ flex: 1, fontSize: 11, color: T.text2 }}>
              {selected.size === 0
                ? <span style={{ color: T.text3 }}>Select all</span>
                : <span>{selected.size} of {profiles.length} selected</span>
              }
            </span>

            {/* Launch Selected — visible only when ≥1 selected */}
            {selected.size > 0 && (
              <button
                onClick={launchSelected}
                disabled={selectedNotRunning === 0}
                style={{
                  padding: '5px 13px', borderRadius: 6, border: 'none',
                  background: selectedNotRunning > 0 ? T.accent : T.surface2,
                  color: selectedNotRunning > 0 ? '#fff' : T.text3,
                  fontSize: 11, fontWeight: 500,
                  cursor: selectedNotRunning > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 6, opacity: selectedNotRunning > 0 ? 1 : 0.5,
                }}>
                ▶ Launch Selected
                {selectedNotRunning > 0 && (
                  <span style={{
                    background: 'rgba(255,255,255,0.22)', borderRadius: 8,
                    padding: '1px 6px', fontSize: 9, fontWeight: 700,
                  }}>{selectedNotRunning}</span>
                )}
              </button>
            )}

            {/* Launch All — always visible */}
            <button
              onClick={launchAll}
              disabled={allAlreadyRunning}
              style={{
                padding: '5px 13px', borderRadius: 6,
                border: `1px solid ${allAlreadyRunning ? T.border : T.border2}`,
                background: 'transparent',
                color: allAlreadyRunning ? T.text3 : T.text2,
                fontSize: 11, fontWeight: 500,
                cursor: allAlreadyRunning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                opacity: allAlreadyRunning ? 0.45 : 1,
              }}>
              ▶▶ Launch All
            </button>
          </div>

          {/* ── Cards ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {profiles.map(p => (
              <ProfileCard
                key={p.id}
                profile={p}
                selected={selected.has(p.id)}
                onToggle={toggleOne}
                onLaunch={launchOne}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>

        </>)}
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        height: 26, background: T.surface, borderTop: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 12, flexShrink: 0,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: runningCount > 0 ? T.green : T.text3, flexShrink: 0, animation: runningCount > 0 ? 'blink 2s infinite' : 'none' }} />
        <span style={{ fontSize: 10, color: T.text2, fontFamily: "'JetBrains Mono', monospace" }}>{statusMsg}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: T.text3, fontFamily: "'JetBrains Mono', monospace" }}>
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* ── Modals ── */}
      {showNew      && <ProfileModal onSave={handleCreate} onClose={() => setShowNew(false)} />}
      {editTarget   && <ProfileModal profile={editTarget} onSave={handleEdit} onClose={() => setEditTarget(null)} />}
      {deleteTarget && (
        <ConfirmModal
          msg={`Delete "${deleteTarget.name}"? This will permanently erase all saved credentials, settings, and notes for this profile.`}
          onOK={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}