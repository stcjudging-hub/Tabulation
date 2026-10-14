import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, LogOut, TrophyIcon, Moon, Sun, Settings, History
} from 'lucide-react';
import apiClient from '../../../services/api';
import CriteriaManager from './CreteriaManager';
import AiCriteriaSuggest from './AiCriteriaSuggest';
import { useContestContext } from '../../../context/ContestContext';
import { logoutRemote, clearAdminSession } from '../../../services/session';
import {
  AIConfigSection, ContestantsSection,
  ContestInfoSection, OverviewSection,
  SystemConfigSection, JudgesSection
} from './index';

// ─── MOBILE NAV DRAWER ────────────────────────────────────────────────────────

export const MobileNavDrawer = ({ isOpen, onClose, activeNav, setActiveNav, navItems, dark, setDark }) => {
  const navigate = useNavigate();
  const [sysConfig, setSysConfig] = useState({
    school_logo: "", portal_name: "", school_name: "",
  });

  const handleLogout = () => {
    logoutRemote("admin"); // fire-and-forget; only this device signs out
    clearAdminSession();
    window.location.href = "/login";
  };

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    apiClient
      .get("/system-config")
      .then((data) => { if (data) setSysConfig((p) => ({ ...p, ...data })); })
      .catch(() => {});
  }, []);

  const portalName = sysConfig.portal_name || "CompPortal";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[80] bg-black/45 transition-opacity duration-250 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Slide-in panel — themed to match the desktop sidebar */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-[90] w-[260px] flex flex-col overflow-y-auto
          bg-[#1B4332] border-r border-white/10 shadow-[4px_0_24px_rgba(0,0,0,0.35)]
          transition-transform duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand header — mirrors desktop sidebar */}
        <div className="p-4 flex items-center gap-2.5 border-b border-white/10">
          <img
            src="/img/USAL_LOGO.png"
            alt="Logo"
            className="w-9 h-9 object-contain rounded-full border border-white/20 shrink-0"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white tracking-tight truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {portalName}
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[#C9A227]">
              Administrator
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-md shrink-0 bg-white/10 border border-white/20 text-white/80 cursor-pointer flex items-center justify-center hover:bg-white/20"
          >
            <X size={16} />
          </button>
        </div>

        {/* Badge pill — mirrors desktop sidebar */}
        <div className="px-4 py-2.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
            Administrator
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2.5 pb-3">
          {navItems.map(item => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveNav(item.id); onClose(); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md border mb-0.5 text-[13px] font-semibold cursor-pointer font-inherit transition-all duration-150 ${
                  isActive
                    ? "border-[#C9A227]/30 bg-[#C9A227]/15 text-[#C9A227]"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                  isActive ? "bg-[#C9A227]/20 text-[#C9A227]" : "bg-white/5 text-white/50"
                }`}>
                  {item.icon}
                </div>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* ── Bottom actions ── */}
        <div className="border-t border-white/10 px-2.5 pt-2.5 pb-2 flex flex-col gap-1">

          {/* Leaderboard */}
          <button
            onClick={() => { navigate('/admin/leaderboard'); onClose(); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md border text-[13px] font-semibold cursor-pointer font-inherit transition-all duration-150 border-transparent bg-transparent text-white/70 hover:bg-rose-950/30 hover:text-rose-200 hover:border-rose-900/30"
          >
            <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-white/5 text-white/50">
              <TrophyIcon size={15} />
            </div>
            Leaderboard
          </button>

          {/* Settings */}
          <button
            onClick={() => { navigate('/admin/settings'); onClose(); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md border text-[13px] font-semibold cursor-pointer font-inherit transition-all duration-150 border-transparent bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
          >
            <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-white/5 text-white/50">
              <Settings size={15} />
            </div>
            Settings
          </button>

          {/* History */}
          <button
            onClick={() => { navigate('/admin/history'); onClose(); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md border text-[13px] font-semibold cursor-pointer font-inherit transition-all duration-150 border-transparent bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
          >
            <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-white/5 text-white/50">
              <History size={15} />
            </div>
            History
          </button>

          {/* Dark / Light toggle */}
          <button
            onClick={() => setDark(!dark)}
            className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-md border border-white/10 bg-white/5 text-white/80 text-[13px] font-medium cursor-pointer font-inherit"
          >
            <span>{dark ? 'Dark Mode' : 'Light Mode'}</span>
            {dark
              ? <Moon size={15} className="text-[#C9A227]" />
              : <Sun size={15} className="text-[#C9A227]" />}
          </button>

          {/* Sign Out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md border border-rose-900/40 bg-rose-950/30 text-rose-200 text-[13px] font-semibold cursor-pointer font-inherit transition-all duration-150 hover:bg-rose-950/50 hover:border-rose-800/50"
          >
            <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-rose-900/30 text-rose-200">
              <LogOut size={15} />
            </div>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
};

// ─── MAIN RENDER ──────────────────────────────────────────────────────────────

const SectionRender = ({
  activeNav,
  contestName, setContestName,
  contestType, setContestType,
  aiPrompt, setAiPrompt,
  aiProvider, setAiProvider,
  aiModel, setAiModel,
  uiMode, setUiMode,
  judgeCount, setJudgeCount,
  calculationType, setCalculationType,
  customBase, setCustomBase,
  tieBreakMethod, setTieBreakMethod,
  criteria, setCriteria,
  contestants, setContestants,
  newCrit, setNewCrit,
  newWeight, setNewWeight,
  newName, setNewName,
  totalWeight,
  setShowDeleteModal,
  schoolName, setSchoolName,
  portalName, setPortalName,
  schoolLogo, setSchoolLogo,
  backgroundLogo, setBackgroundLogo,
  primaryColor, setPrimaryColor,
  secondaryColor, setSecondaryColor,
  footerText, setFooterText,
  logoRadius, setLogoRadius,
  headerTemplate, setHeaderTemplate,
  aiGen,
}) => {
  const { isJudgeLocked } = useContestContext();

  const addCriterion = () => {
    if (!newCrit.trim()) return;
    setCriteria([...criteria, { id: Date.now().toString(), name: newCrit.trim(), weight: Number(newWeight) }]);
    setNewCrit('');
    setNewWeight(10);
  };

  const addContestant = () => {
    if (!newName.trim()) return;
    const num = contestants.length + 1;
    setContestants([...contestants, { id: Date.now().toString(), name: newName.trim(), number: num }]);
    setNewName('');
  };

  return (
    <>
      {activeNav === 'overview' && (
        <OverviewSection
          contestants={contestants} judgeCount={judgeCount} criteria={criteria}
          totalWeight={totalWeight} contestName={contestName} contestType={contestType}
          calculationType={calculationType} aiPrompt={aiPrompt} isJudgeLocked={isJudgeLocked}
          setShowDeleteModal={setShowDeleteModal}
          schoolLogo={schoolLogo} backgroundLogo={backgroundLogo}
          schoolName={schoolName} portalName={portalName} logoRadius={logoRadius}
        />
      )}
      {activeNav === 'contest' && (
        <ContestInfoSection contestName={contestName} setContestName={setContestName} contestType={contestType} setContestType={setContestType} />
      )}
      {activeNav === 'ai' && (
        <AIConfigSection
          aiPrompt={aiPrompt} setAiPrompt={setAiPrompt}
          aiProvider={aiProvider} setAiProvider={setAiProvider}
          aiModel={aiModel} setAiModel={setAiModel}
          uiMode={uiMode} setUiMode={setUiMode}
          contestants={contestants} criteria={criteria} contestName={contestName}
          aiGen={aiGen}
        />
      )}
      {activeNav === 'criteria' && (
        /* Two-column on wide screens; stacks with a generous gap on smaller ones */
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
          <div>
            <div className="xl:sticky xl:top-6">
              <AiCriteriaSuggest setCriteria={setCriteria} contestName={contestName} />
            </div>
          </div>
          <CriteriaManager criteria={criteria} setCriteria={setCriteria} newCrit={newCrit} setNewCrit={setNewCrit} addCriterion={addCriterion} />
        </div>
      )}
      {activeNav === 'judges' && (
        <JudgesSection
          judgeCount={judgeCount} setJudgeCount={setJudgeCount}
          calculationType={calculationType} setCalculationType={setCalculationType}
          customBase={customBase} setCustomBase={setCustomBase}
          tieBreakMethod={tieBreakMethod} setTieBreakMethod={setTieBreakMethod}
        />
      )}
      {activeNav === 'contestants' && (
        <ContestantsSection contestants={contestants} setContestants={setContestants} newName={newName} setNewName={setNewName} addContestant={addContestant} />
      )}
      {activeNav === 'system' && (
        <SystemConfigSection
          schoolName={schoolName} setSchoolName={setSchoolName}
          portalName={portalName} setPortalName={setPortalName}
          schoolLogo={schoolLogo} setSchoolLogo={setSchoolLogo}
          backgroundLogo={backgroundLogo} setBackgroundLogo={setBackgroundLogo}
          primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
          secondaryColor={secondaryColor} setSecondaryColor={setSecondaryColor}
          footerText={footerText} setFooterText={setFooterText}
          logoRadius={logoRadius} setLogoRadius={setLogoRadius}
          headerTemplate={headerTemplate} setHeaderTemplate={setHeaderTemplate}
        />
      )}
    </>
  );
};

export default SectionRender;