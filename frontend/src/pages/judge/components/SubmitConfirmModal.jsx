import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  Check,
  Lock,
  ShieldCheck,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Premium confirmation step shown before a judge's score sheet is submitted.
 *
 * The judge page auto-opens this the moment the final score is selected, and the
 * Submit Scores button opens the same dialog. Keeping the confirmation here
 * means every submission path gets an explicit yes/no decision.
 */
export default function SubmitConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  judge,
  contestName,
  contestantCount = 0,
  criteriaCount = 0,
  submitting = false,
  primary = '#1B4332',
  secondary = '#2D6A4F',
}) {
  const cardRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(onCancel);

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => confirmRef.current?.focus(), 80);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = cardRef.current?.querySelectorAll(FOCUSABLE);
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const judgeLabel = judge
    ? /^judge\b/i.test(String(judge))
      ? String(judge)
      : `Judge ${judge}`
    : 'Judge';

  const contestLabel = contestName || 'This contest';
  const scoreCount = contestantCount * criteriaCount;

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto">
      <style>{`
        @keyframes scm-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scm-rise {
          0%   { opacity: 0; transform: translateY(22px) scale(.965); }
          55%  { opacity: 1; transform: translateY(-3px) scale(1.004); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scm-seal {
          0%   { opacity: 0; transform: scale(.55) rotate(-10deg); }
          65%  { opacity: 1; transform: scale(1.07) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }

        .scm-overlay {
          background:
            radial-gradient(900px 520px at 50% 8%, rgba(201,162,39,.18), transparent 62%),
            radial-gradient(1100px 700px at 50% 105%, rgba(45,106,79,.45), transparent 72%),
            rgba(5, 17, 11, .80);
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
          animation: scm-fade .24s ease-out both;
        }
        .scm-card {
          animation: scm-rise .48s cubic-bezier(.22, 1, .36, 1) both;
        }
        .scm-seal {
          animation: scm-seal .6s cubic-bezier(.2, 1.2, .32, 1) both .05s;
        }
        .scm-primary {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, var(--scm-primary), var(--scm-secondary));
          box-shadow:
            0 16px 32px -16px rgba(20, 32, 26, .75),
            inset 0 1px 0 rgba(255,255,255,.18);
          transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
        }
        .scm-primary::after {
          content: '';
          position: absolute;
          top: -70%;
          left: -35%;
          width: 45%;
          height: 240%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
          transform: rotate(18deg);
          transition: left .65s ease;
          pointer-events: none;
        }
        .scm-primary:hover::after { left: 125%; }
        .scm-primary:hover {
          transform: translateY(-1px);
          filter: brightness(1.045);
          box-shadow:
            0 20px 36px -16px rgba(20, 32, 26, .8),
            inset 0 1px 0 rgba(255,255,255,.22);
        }
        .scm-primary:active { transform: translateY(0) scale(.995); }
        .scm-primary:focus-visible {
          outline: 3px solid rgba(201, 162, 39, .5);
          outline-offset: 3px;
        }
        .scm-secondary { transition: background-color .2s ease, border-color .2s ease, color .2s ease, transform .15s ease; }
        .scm-secondary:hover { background: rgba(255,255,255,.92); border-color: rgba(27,67,50,.26); color: #14201A; }
        .scm-secondary:active { transform: scale(.995); }
        .scm-secondary:focus-visible {
          outline: 3px solid rgba(27, 67, 50, .22);
          outline-offset: 2px;
        }
        .scm-close { transition: background-color .18s ease, color .18s ease, transform .18s ease; }
        .scm-close:hover { background: #14201A; color: #fff; transform: rotate(4deg); }
        .scm-close:focus-visible { outline: 3px solid rgba(27, 67, 50, .22); outline-offset: 2px; }

        @media (prefers-reduced-motion: reduce) {
          .scm-overlay, .scm-card, .scm-seal { animation: none !important; }
          .scm-primary::after { display: none; }
          .scm-primary, .scm-secondary, .scm-close { transition: none; }
        }
      `}</style>

      <div className="scm-overlay fixed inset-0" onClick={onCancel} aria-hidden="true" />

      <div
        className="relative flex min-h-full items-center justify-center p-4 sm:p-6"
        onClick={onCancel}
      >
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-confirm-title"
          aria-describedby="submit-confirm-description"
          className="scm-card relative w-full max-w-[456px] rounded-[30px] p-px"
          onClick={(event) => event.stopPropagation()}
          style={{
            '--scm-primary': primary,
            '--scm-secondary': secondary,
            background:
              'linear-gradient(145deg, rgba(236,210,124,.9), rgba(255,255,255,.55) 24%, rgba(27,67,50,.16) 64%, rgba(201,162,39,.62))',
            boxShadow: '0 48px 110px -32px rgba(0, 0, 0, .72)',
          }}
        >
          <div
            className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden rounded-[29px]"
            style={{ background: 'linear-gradient(180deg, #FDFEFB 0%, #F6F8F1 100%)' }}
          >
            {/* Soft depth + orbit details behind the header */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-60 overflow-hidden"
            >
              <div
                className="absolute -right-20 -top-24 h-64 w-64 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(201,162,39,.20) 0%, transparent 68%)' }}
              />
              <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full border border-[#1B4332]/[0.06]" />
              <div className="absolute right-2 -top-8 h-36 w-36 rounded-full border border-[#1B4332]/[0.05]" />
              <div className="absolute -left-24 top-20 h-44 w-44 rounded-full border border-[#1B4332]/[0.04]" />
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              aria-label="Close confirmation"
              className="scm-close absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#DFE7DB] bg-white/70 text-[#6C7A71] shadow-[0_4px_12px_-6px_rgba(20,32,26,.25)] backdrop-blur-sm disabled:opacity-50"
            >
              <X size={16} strokeWidth={2.1} />
            </button>

            <div className="relative px-6 pb-7 pt-7 sm:px-8 sm:pb-8 sm:pt-8">
              <div className="flex flex-col items-center text-center">
                <div className="scm-seal relative flex h-[76px] w-[76px] items-center justify-center rounded-full p-[3px]"
                  style={{
                    background:
                      'conic-gradient(from 215deg, #F4E4A6, #C9A227, #F8EDC3, #B8901B, #C9A227, #F4E4A6)',
                    boxShadow: '0 14px 30px -12px rgba(201,162,39,.55)',
                  }}
                >
                  <div
                    className="flex h-full w-full items-center justify-center rounded-full"
                    style={{
                      background: 'linear-gradient(150deg, var(--scm-primary), var(--scm-secondary))',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.28)',
                    }}
                  >
                    <Check size={30} strokeWidth={2.6} className="text-white" />
                  </div>
                  <span className="absolute -right-0.5 top-1 h-2.5 w-2.5 rounded-full bg-[#F4E4A6] shadow-[0_0_0_4px_rgba(244,228,166,.28)]" />
                </div>

                <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#D8BE62]/40 bg-[#C9A227]/10 px-3 py-1 text-[9.5px] font-extrabold uppercase tracking-[0.24em] text-[#8A6D12]">
                  <span className="h-1 w-1 rounded-full bg-[#C9A227]" />
                  Final review
                </span>

                <h2
                  id="submit-confirm-title"
                  className="mt-3 text-[29px] leading-[1.08] tracking-[-0.02em] text-[#14201A] sm:text-[33px]"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}
                >
                  Ready to{' '}
                  <span className="italic" style={{ color: '#A98518' }}>
                    submit
                  </span>
                  ?
                </h2>

                <p
                  id="submit-confirm-description"
                  className="mt-2.5 max-w-[330px] text-[12.5px] leading-[1.7] text-[#5B6B60]"
                >
                  Every score is in. Take one last look before your sheet is sent to the
                  official tally.
                </p>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-[#E4EADF] bg-white/80 shadow-[0_14px_34px_-28px_rgba(20,32,26,.6)] backdrop-blur-sm">
                <div className="flex items-center gap-3 bg-[#F4F7F1] px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE6D8] bg-white text-[#1B4332] shadow-[0_4px_10px_-6px_rgba(27,67,50,.35)]">
                    <UserRound size={16} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[8.5px] font-extrabold uppercase tracking-[0.2em] text-[#8A978D]">
                      Judge
                    </p>
                    <p className="mt-0.5 truncate text-[13.5px] font-bold leading-tight text-[#14201A]">
                      {judgeLabel}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#CFE0CA] bg-white px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#2D6A4F]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3E8E63]" />
                    Complete
                  </span>
                </div>

                <div className="divide-y divide-[#EDF1E9]">
                  <div className="flex items-center gap-2.5 px-4 py-2.5">
                    <Trophy size={14} strokeWidth={1.9} className="shrink-0 text-[#A98518]" />
                    <p className="shrink-0 text-[8.5px] font-extrabold uppercase tracking-[0.18em] text-[#8A978D]">
                      Contest
                    </p>
                    <p
                      className="ml-auto min-w-0 line-clamp-2 text-right text-[11.5px] font-semibold leading-snug text-[#3F4F44]"
                      title={contestLabel}
                    >
                      {contestLabel}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 px-4 py-2.5">
                    <Check size={14} strokeWidth={2.1} className="shrink-0 text-[#3E8E63]" />
                    <p className="shrink-0 text-[8.5px] font-extrabold uppercase tracking-[0.18em] text-[#8A978D]">
                      Score sheet
                    </p>
                    <p className="ml-auto min-w-0 truncate text-right text-[11.5px] font-semibold leading-snug text-[#3F4F44]">
                      {scoreCount > 0 ? `${scoreCount} scores` : 'All scores'}
                      {contestantCount > 0 && criteriaCount > 0
                        ? ` · ${contestantCount} × ${criteriaCount}`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#E7D8A4] bg-[#FBF6E7]/80 px-3.5 py-3">
                <ShieldCheck size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-[#9C7B16]" />
                <p className="text-left text-[10.5px] font-medium leading-[1.65] text-[#6E5C24]">
                  Your scores will be saved to the official results and reflected on the
                  leaderboard.
                </p>
              </div>

              <div className="mt-5 space-y-2.5">
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={onConfirm}
                  disabled={submitting}
                  className="scm-primary group flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-left text-white disabled:cursor-wait disabled:opacity-70"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-extrabold uppercase tracking-[0.13em]">
                      {submitting ? 'Submitting…' : 'Yes, submit scores'}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-medium tracking-wide text-white/60">
                      Confirm and send to the tally
                    </span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-inset ring-white/20 transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowUpRight size={16} strokeWidth={2.2} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  disabled={submitting}
                  className="scm-secondary w-full rounded-2xl border border-[#DFE7DB] bg-white/50 px-5 py-3 text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-[#4B5A4D] disabled:opacity-50"
                >
                  No, keep editing
                </button>
              </div>

              <p className="mt-4 flex items-center justify-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.2em] text-[#9AA69E]">
                <Lock size={9} strokeWidth={2.2} />
                Secure score submission
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
