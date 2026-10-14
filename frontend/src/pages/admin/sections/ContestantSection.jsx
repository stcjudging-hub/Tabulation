import { card } from './card.js'
const ContestantsSection = ({ contestants, setContestants, newName, setNewName, addContestant }) => (
  <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div className="section-heading" style={{ margin: 0 }}>Contestants</div>
      <span className="badge badge-indigo">{contestants.length} registered</span>
    </div>

    {/* Two columns on desktop (add form sticky) · stacks on tablet/mobile */}
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div>
        <div className="xl:sticky xl:top-6">
          <div style={{ background: 'var(--surface2)', border: '1.5px dashed var(--accent-bd)', borderRadius: 6, padding: 14 }}>
            <div className="field-label">Add Contestant</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <input className="field-input" style={{ flex: 1, minWidth: 140 }} placeholder="Full name…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addContestant()} />
              <button className="btn-primary" onClick={addContestant} style={{ flexShrink: 0 }}>+ Add</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {contestants.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '9px 14px', transition: 'border-color .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-bd)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{c.number}</div>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
            <button className="btn-danger" onClick={() => setContestants(contestants.filter(x => x.id !== c.id))}>✕</button>
          </div>
        ))}
        {contestants.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>No contestants registered yet.</div>
        )}
      </div>
    </div>
  </div>
);
export default ContestantsSection
