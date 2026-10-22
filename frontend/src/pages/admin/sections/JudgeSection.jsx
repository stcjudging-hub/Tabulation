import { useState } from 'react';
import {useContestContext} from '../../../context/ContestContext'
import {
 Lock, Unlock,  Loader, KeyRound, Eye, EyeOff, Check, AlertTriangle,
} from 'lucide-react';
import { card } from './card.js'
import apiClient from '../../../services/api';
import { getSchoolId } from '../../../utils/getSchoolId';
import ExplanationModal from '../components/ExplanationModal';

const JudgePasswordManager = () => {
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSave = async () => {
    if (!pw || pw.length < 8) {
      setFeedback({ type: 'error', msg: 'Password must be at least 8 characters.' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const schoolId = getSchoolId();
      await apiClient.patch(`/schools/${schoolId}/judge-password`, { judge_password: pw });
      setPw('');
      setFeedback({ type: 'success', msg: 'Judge password updated.' });
    } catch (err) {
      setFeedback({ type: 'error', msg: `Failed to save: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 16,
      }}
    >
      <div className="field-label" style={{ marginBottom: 6 }}>Judge Login Password</div>
      <p style={{ fontSize: 11, color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Judges log into the scoring portal using the school email + this shared password.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setFeedback(null); }}
            style={{
              width: '100%', padding: '10px 36px 10px 10px', borderRadius: 5,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              fontSize: 13, color: 'var(--text1)', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)',
              display: 'flex', alignItems: 'center', padding: 4,
            }}
            aria-label="Toggle password visibility"
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 5,
            border: 'none', background: loading ? 'var(--surface2)' : 'var(--accent-mid)',
            color: loading ? 'var(--text3)' : '#fff', fontWeight: 800, fontSize: 12,
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'all .2s', fontFamily: 'inherit',
            alignSelf: 'flex-start',
          }}
        >
          {loading ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <KeyRound size={13} />}
          {loading ? 'SAVING…' : 'Set Judge Password'}
        </button>
        {feedback && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
              color: feedback.type === 'success' ? '#15803d' : '#dc2626',
            }}
          >
            {feedback.type === 'success' ? <Check size={13} /> : <AlertTriangle size={13} />}
            {feedback.msg}
          </div>
        )}
      </div>
    </div>
  );
};

const seeMoreBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  background: 'none',
  border: 'none',
  color: 'var(--accent)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: '4px 0',
  margin: 0,
};

const OptionCard = ({ active, compact, onClick, title, desc, onSeeMore }) => (
  <div
    onClick={onClick}
    style={{
      flex: 1,
      padding: compact ? 12 : 14,
      borderRadius: 6,
      cursor: 'pointer',
      transition: 'all .2s',
      border: `2px solid ${active ? 'var(--accent-mid)' : 'var(--border)'}`,
      background: active ? 'var(--accent-lt)' : 'var(--surface2)',
      boxShadow: active ? '0 0 0 3px var(--accent-lt)' : 'none',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <div style={{ fontWeight: 800, color: active ? 'var(--accent)' : 'var(--text1)', fontSize: compact ? 13 : 14 }}>{title}</div>
    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: compact ? 3 : 4 }}>{desc}</div>
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: compact ? 8 : 10 }}>
      <button
        onClick={(e) => { e.stopPropagation(); onSeeMore && onSeeMore(); }}
        style={seeMoreBtnStyle}
      >
        See More
      </button>
    </div>
  </div>
);

const helpContent = {
  average: {
    title: 'By Average',
    description: "Each judge gives a score; the contestant's final score is the average of all judges' scores. Contestants are ranked from highest to lowest average — the highest average wins.",
    table: {
      headers: ['Contestant', 'Judge 1', 'Judge 2', 'Judge 3', 'Average', 'Rank'],
      rows: [
        [{ v: 'Contestant 1', highlight: true }, '85', '90', '80', '85.00', { v: '1st', highlight: true }],
        ['Contestant 2', '78', '82', '88', '82.67', '2nd'],
        ['Contestant 3', '80', '70', '75', '75.00', '3rd'],
      ],
    },
  },
  rank: {
    title: 'By Place (Rank-Sum)',
    description: 'Each judge ranks the contestants (1st, 2nd, 3rd…). The rank numbers across all judges are summed — the contestant with the lowest sum of ranks wins.',
    table: {
      headers: ['Contestant', 'Judge 1', 'Judge 2', 'Judge 3', 'Sum', 'Rank'],
      rows: [
        [{ v: 'Contestant 1', highlight: true }, '1', '1', '2', '4', { v: '1st', highlight: true }],
        ['Contestant 2', '2', '2', '1', '5', '2nd'],
        ['Contestant 3', '3', '3', '3', '9', '3rd'],
      ],
    },
  },
  custom: {
    title: 'Custom',
    description: "Pick a base calculation (By Average or By Place) plus your own tie-break rule. The base calculation decides the winner; the tie-break method only decides how equal scores are ranked.",
    table: {
      headers: ['Contestant', 'Average', 'Rank'],
      rows: [
        [{ v: 'Contestant 1', highlight: true }, '85.00', { v: '1st', highlight: true }],
        ['Contestant 2', '85.00', 'Tied — resolved by tie-break'],
        ['Contestant 3', '75.00', '3rd'],
      ],
    },
  },
  midrank: {
    title: 'Midrank',
    description: 'Tied contestants share the average of the positions they occupy. Two contestants tied for 2nd and 3rd both receive 2.5; the next contestant follows at 4.',
    table: {
      headers: ['Contestant', 'Score', 'Final Rank'],
      rows: [
        ['Contestant 1', '90', '1'],
        [{ v: 'Contestant 2', highlight: true }, '85', { v: '2.5', highlight: true }],
        [{ v: 'Contestant 3', highlight: true }, '85', { v: '2.5', highlight: true }],
        ['Contestant 4', '70', '4'],
      ],
    },
  },
  sequential: {
    title: 'Sequential',
    description: 'Tied contestants get consecutive positions instead of sharing. Two contestants tied for 2nd and 3rd receive 2 and 3; the next contestant follows at 4.',
    table: {
      headers: ['Contestant', 'Score', 'Final Rank'],
      rows: [
        ['Contestant 1', '90', '1'],
        [{ v: 'Contestant 2', highlight: true }, '85', { v: '2', highlight: true }],
        [{ v: 'Contestant 3', highlight: true }, '85', { v: '3', highlight: true }],
        ['Contestant 4', '70', '4'],
      ],
    },
  },
};

const JudgesSection = ({ judgeCount, setJudgeCount, calculationType, setCalculationType, customBase, setCustomBase, tieBreakMethod, setTieBreakMethod }) => {
  const { isJudgeLocked, toggleLock, lockLoading, lockError } = useContestContext();
  const [help, setHelp] = useState(null);

  const baseOpts = [
    { id: 'average', title: 'By Average', desc: 'Standard percentage-based average. Highest score wins.', help: helpContent.average },
    { id: 'rank',    title: 'By Place (Rank-Sum)', desc: 'Rank points summed from all judges. Lowest sum wins.', help: helpContent.rank },
    { id: 'custom',  title: 'Custom', desc: 'Pick a base calculation and your own tie-breaking rule.', help: helpContent.custom },
  ];

  const tieOpts = [
    { id: 'midrank',    title: 'Midrank',    desc: 'Tied contestants share the average position — e.g. 1, 2.5, 2.5, 4.', help: helpContent.midrank },
    { id: 'sequential', title: 'Sequential', desc: 'Tied contestants get consecutive positions — e.g. 1, 2, 3, 4.', help: helpContent.sequential },
  ];

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="section-heading" style={{ margin: 0 }}>Judge & Calculation Configuration</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: isJudgeLocked ? 'var(--red)' : 'var(--accent-mid)', boxShadow: isJudgeLocked ? '0 0 0 3px rgba(190,18,60,0.15)' : '0 0 0 3px var(--accent-lt)', transition: 'all .3s' }} />
          <button
            onClick={toggleLock}
            disabled={lockLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 5, border: isJudgeLocked ? 'none' : '1px solid var(--border)', background: lockLoading ? 'var(--surface2)' : isJudgeLocked ? '#be123c' : 'var(--surface)', color: lockLoading ? 'var(--text3)' : isJudgeLocked ? '#fff' : 'var(--text2)', fontWeight: 800, fontSize: 12, cursor: lockLoading ? 'not-allowed' : 'pointer', transition: 'all .2s', fontFamily: 'inherit' }}
          >
            {lockLoading ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : isJudgeLocked ? <Lock size={13} /> : <Unlock size={13} />}
            {lockLoading ? 'SAVING…' : isJudgeLocked ? 'JUDGES LOCKED' : 'LOCK JUDGES'}
          </button>
        </div>
      </div>

      {lockError && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={13} /> Failed to save: {lockError}
        </div>
      )}

      <div style={{ background: isJudgeLocked ? '#fff1f2' : 'var(--accent-lt)', border: `1px solid ${isJudgeLocked ? '#fecdd3' : 'var(--accent-bd)'}`, borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600, color: isJudgeLocked ? '#dc2626' : 'var(--accent)', transition: 'all .3s' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isJudgeLocked ? '#ef4444' : 'var(--accent-mid)', flexShrink: 0, animation: 'pulse 2s infinite' }} />
        {isJudgeLocked ? 'Judges are currently LOCKED — scoring is disabled on the judge portal.' : 'Judges are UNLOCKED — scoring is active on the judge portal.'}
      </div>

      {/* Two columns on desktop · stacks on tablet/mobile */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div>
          <div className="flex flex-col gap-6 xl:sticky xl:top-6">
      <JudgePasswordManager />

      <div>
        <div className="field-label" style={{ marginBottom: 12 }}>Number of Judges</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="counter-btn" onClick={() => setJudgeCount(j => Math.max(1, j - 1))}>−</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, color: 'var(--accent)', minWidth: 48, textAlign: 'center' }}>{judgeCount}</span>
          <button className="counter-btn" onClick={() => setJudgeCount(j => Math.min(20, j + 1))}>+</button>
        </div>
      </div>
          </div>
        </div>
        <div className="flex flex-col gap-6">
      <div>
        <div className="field-label" style={{ marginBottom: 12 }}>Result Calculation Type</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="sm:flex-row">
          {baseOpts.map(opt => (
            <OptionCard
              key={opt.id}
              active={calculationType === opt.id}
              onClick={() => setCalculationType(opt.id)}
              title={opt.title}
              desc={opt.desc}
              onSeeMore={() => setHelp(opt.help)}
            />
          ))}
        </div>
      </div>

      {calculationType === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>Custom Base Calculation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="sm:flex-row">
              {[
                { id: 'average', title: 'By Average', desc: 'Rank the final average of all judges\' scores.', help: helpContent.average },
                { id: 'rank',    title: 'By Place (Rank-Sum)', desc: 'Sum each judge\'s rank; lowest sum wins.', help: helpContent.rank },
              ].map(opt => (
                <OptionCard
                  key={opt.id}
                  compact
                  active={customBase === opt.id}
                  onClick={() => setCustomBase(opt.id)}
                  title={opt.title}
                  desc={opt.desc}
                  onSeeMore={() => setHelp(opt.help)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>Tie-Break Method</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="sm:flex-row">
              {tieOpts.map(opt => (
                <OptionCard
                  key={opt.id}
                  compact
                  active={tieBreakMethod === opt.id}
                  onClick={() => setTieBreakMethod(opt.id)}
                  title={opt.title}
                  desc={opt.desc}
                  onSeeMore={() => setHelp(opt.help)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>

      <ExplanationModal
        open={!!help}
        onClose={() => setHelp(null)}
        title={help?.title}
        description={help?.description}
        table={help?.table}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
};

export default JudgesSection