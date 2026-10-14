import React, {useEffect } from 'react';
import {
  CheckCircle,

 Palette, LayoutTemplate, SlidersHorizontal,

} from 'lucide-react';
import {HEADER_TEMPLATES, LogoUploadField} from './index'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const SystemConfigSection = ({
  schoolName, setSchoolName, portalName, setPortalName,
  schoolLogo, setSchoolLogo, backgroundLogo, setBackgroundLogo,
  primaryColor, setPrimaryColor, secondaryColor, setSecondaryColor,
  footerText, setFooterText, logoRadius, setLogoRadius,
  headerTemplate: headerTemplateProp,
  setHeaderTemplate: setHeaderTemplateProp,
}) => {
  const [configTab, setConfigTab] = React.useState('branding');
  const [localTemplate, setLocalTemplate] = React.useState(headerTemplateProp || 'structured');

  React.useEffect(() => {
    if (headerTemplateProp && headerTemplateProp !== localTemplate) setLocalTemplate(headerTemplateProp);
  }, [headerTemplateProp]);

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const schoolId = (() => {
          try {
            const p = new URLSearchParams(window.location.search);
            if (p.get('school_id')) return p.get('school_id');
            const u = localStorage.getItem('adminUser');
            if (u) return JSON.parse(u)?.school_id || 1;
          } catch { return 1; }
          return 1;
        })();
        const res  = await fetch(`${API_BASE}/public/system-config?school_id=${schoolId}`);
        const data = await res.json();
        if (data?.header_template) {
          setLocalTemplate(data.header_template);
          if (typeof setHeaderTemplateProp === 'function') setHeaderTemplateProp(data.header_template);
        }
      } catch (err) {
        console.warn('Could not load saved header template:', err);
      }
    };
    fetchSaved();
  }, []);

  const headerTemplate  = localTemplate;
  const setHeaderTemplate = (id) => {
    setLocalTemplate(id);
    if (typeof setHeaderTemplateProp === 'function') setHeaderTemplateProp(id);
  };

  const primary   = primaryColor   || '#1B4332';
  const secondary = secondaryColor || '#2D6A4F';
  const r         = logoRadius >= 999 ? '50%' : `${logoRadius}px`;

  const radiusPresets = [
    { label: 'Square', value: 0 }, { label: 'Rounded', value: 8 },
    { label: 'Pill', value: 16 },  { label: 'Circle', value: 999 },
  ];

  const tabs = [
    { id: 'branding', label: 'Branding & Colors', icon: <Palette size={13} /> },
    { id: 'header',   label: 'Header Template',   icon: <LayoutTemplate size={13} /> },
  ];

  const activeTemplate = HEADER_TEMPLATES.find(t => t.id === (headerTemplate || 'structured')) || HEADER_TEMPLATES[0];

  return (
    <div className="panel p-4 sm:p-6 flex flex-col gap-6">
      <div className="section-heading" style={{ margin: 0 }}>System Configuration</div>

      {/* Two columns on desktop · stacks on tablet/mobile */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <div>
          <div className="flex flex-col gap-6 xl:sticky xl:top-6">
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 3, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setConfigTab(tab.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all .18s', background: configTab === tab.id ? 'var(--surface)' : 'transparent', color: configTab === tab.id ? 'var(--accent)' : 'var(--text3)', boxShadow: configTab === tab.id ? 'var(--shadow-sm)' : 'none' }}>
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.id === 'branding' ? 'Branding' : 'Header'}</span>
          </button>
        ))}
      </div>

      {/* ── BRANDING TAB ── */}
      {configTab === 'branding' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div><div className="field-label">School Name</div><input className="field-input" placeholder="e.g. Harvard University" value={schoolName} onChange={e => setSchoolName(e.target.value)} /></div>
            <div><div className="field-label">Portal Name</div><input className="field-input" placeholder="e.g. Veridict" value={portalName} onChange={e => setPortalName(e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <LogoUploadField label="School Logo" value={schoolLogo} onChange={setSchoolLogo} />
            <LogoUploadField label="Background Logo" value={backgroundLogo} onChange={setBackgroundLogo} />
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div className="field-label" style={{ margin: 0 }}>Logo Border Radius</div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-lt)', padding: '2px 10px', borderRadius: 6 }}>
                {logoRadius >= 999 ? '50% (circle)' : `${logoRadius}px`}
              </span>
            </div>
            <input type="range" min={0} max={999} step={1} value={logoRadius} onChange={e => setLogoRadius(Number(e.target.value))} style={{ width: '100%', accentColor: primary, cursor: 'pointer' }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {radiusPresets.map(p => (
                <button key={p.label} onClick={() => setLogoRadius(p.value)} style={{ padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', border: `1.5px solid ${logoRadius === p.value ? 'var(--accent-mid)' : 'var(--border)'}`, background: logoRadius === p.value ? 'var(--accent-lt)' : 'var(--surface2)', color: logoRadius === p.value ? 'var(--accent)' : 'var(--text2)' }}>
                  {p.label}
                </button>
              ))}
            </div>
            {schoolLogo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src={schoolLogo} alt="preview" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: r, border: '2px solid var(--accent-bd)', transition: 'border-radius .2s' }} />
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Live preview of your logo shape</div>
              </div>
            ) : (
              <div style={{ width: 52, height: 52, background: 'var(--accent-lt)', border: '2px dashed var(--accent-bd)', borderRadius: r, transition: 'border-radius .2s' }} />
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <div className="field-label">Primary Color</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 40, height: 40, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>{primaryColor}</span>
              </div>
            </div>
            <div>
              <div className="field-label">Secondary Color</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={{ width: 40, height: 40, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>{secondaryColor}</span>
              </div>
            </div>
          </div>
          <div><div className="field-label">Footer Text</div><input className="field-input" placeholder="e.g. Powered by Veridict" value={footerText} onChange={e => setFooterText(e.target.value)} /></div>
        </>
      )}

      {/* ── HEADER TEMPLATE TAB ── */}
      {configTab === 'header' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--accent-lt)', border: '1px solid var(--accent-bd)', borderRadius: 6, padding: '12px 14px', fontSize: 13, color: 'var(--accent)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <LayoutTemplate size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>Choose a <strong>header layout</strong> for the judge portal. It uses your branding colors and logo automatically.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {HEADER_TEMPLATES.map(tpl => {
              const isActive = headerTemplate === tpl.id;
              return (
                <div key={tpl.id} onClick={() => setHeaderTemplate(tpl.id)} style={{ border: `2px solid ${isActive ? 'var(--accent-mid)' : 'var(--border)'}`, borderRadius: 6, padding: 12, cursor: 'pointer', transition: 'all .18s', background: isActive ? 'var(--accent-lt)' : 'var(--surface2)', boxShadow: isActive ? '0 0 0 3px var(--accent-lt)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 5, background: isActive ? 'var(--accent)' : 'var(--surface)', border: `1px solid ${isActive ? 'var(--accent-bd)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#fff' : 'var(--text3)', flexShrink: 0 }}>
                      {tpl.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isActive ? 'var(--accent)' : 'var(--text1)' }}>{tpl.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{tpl.desc}</div>
                    </div>
                    {isActive && <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}><CheckCircle size={10} /> Selected</div>}
                  </div>
                  <div style={{ pointerEvents: 'none' }}>{tpl.render({ primary, secondary, schoolLogo, portalName, schoolName, footerText, logoRadius })}</div>
                </div>
              );
            })}
          </div>
          <div style={{ border: '1px dashed var(--border)', borderRadius: 6, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <SlidersHorizontal size={13} style={{ color: 'var(--text3)', marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Templates inherit your <strong style={{ color: 'var(--text2)' }}>primary color</strong>, <strong style={{ color: 'var(--text2)' }}>logo</strong>, and <strong style={{ color: 'var(--text2)' }}>footer text</strong> automatically. Adjust those in the <strong style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setConfigTab('branding')}>Branding tab</strong>.
            </div>
          </div>
        </div>
      )}

          </div>
        </div>
        <div className="flex flex-col gap-4">
      {/* Live preview — always visible */}
      <div>
        <div className="field-label" style={{ marginBottom: 10 }}>
          Live Preview — <span style={{ fontWeight: 500, color: 'var(--text3)' }}>{activeTemplate.name}</span>
        </div>
        {activeTemplate.render({ primary, secondary, schoolLogo, portalName, schoolName, footerText, logoRadius })}

        {/* Footer preview */}
        <div style={{ marginTop: 12, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ background: primary, padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{portalName || 'Veridict'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4, maxWidth: 240, lineHeight: 1.5 }}>
                  Professional judging and tabulation platform for Catholic schools and academic institutions in the Philippines.
                </div>
              </div>
             
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 0 12px' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>© {new Date().getFullYear()} {schoolName || 'Veridict'}. All rights reserved.</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                {['Privacy', 'Security', 'Support'].map(link => <span key={link} style={{ cursor: 'pointer' }}>{link}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};
export default SystemConfigSection