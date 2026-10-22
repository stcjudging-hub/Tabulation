import { useJudgeSystem } from '../../hooks/useJudgeSystem';
import {useSystemConfig} from '../../hooks/useSystemConfig'
import {useContestContext} from '../../context/ContestContext'
import { usePresence } from '../../hooks/usePresence';

import {GlobalStyles} from './components/GlobalStyles'
import {CriteriaHeader,EncryptedBadge,CardHeaderStrip,
  
  JudgeFooter,JudgeHeader,
  LoadingSpinner,
  ScoringCard,SubmitButton,SubmitConfirmModal
} from './components'
import { SuccessModal, ErrorModal, WarningModal, ConfirmModal } from '../../components/ui';

function JudgeTable() {
  usePresence('judge');
  const {
    selectedJudge,
    dynamicUI,
    config,
    loading,
    uiRefreshing,
    uiPending,
    waitSeconds,
    isComplete,
    modal,
    submitConfirm,
    isOnline,
    closeModal,
    submitToDB,
    confirmSubmit,
    cancelSubmit,
    updateJudge,
  } = useJudgeSystem();

  const sysConfig     = useSystemConfig();
  // Single global poller (ContestProvider → /public/get-all-data every 4s).
  // No local polling here — the old useJudgeLockState/useContestName hooks
  // fired overlapping duplicate requests to the same endpoint.
  const { isJudgeLocked, contestName, judgeCount } = useContestContext();

  const tableHtml  = typeof dynamicUI === 'string' ? dynamicUI : dynamicUI?.html || '';

  // The rich static table (buildStaticJudgeTable) is fully self-contained — it
  // already renders the criteria header, total/rank columns, the judging-strip
  // and its own footer. Wrapping more React chrome around it duplicates the UI,
  // so suppress CriteriaHeader / CardHeaderStrip / ScrollHint for it. AI-mode
  // tables vary and keep the normal chrome.
  const isRichStaticTable = tableHtml.includes('sts-table-wrap');

  const primary   = sysConfig.primary_color   || '#1B4332';
  const secondary = sysConfig.secondary_color || '#2D6A4F';

  // While the admin is still generating (empty ui_cache) and nothing can be
  // shown yet, display the system loader instead of a broken table. Normally
  // the built-in scoring table shows right away (see useJudgeSystem) and this
  // branch stays unused; it only guards the very first instant.
  const pendingUI = uiPending && !tableHtml && !loading;

  const body = pendingUI ? (
    <LoadingSpinner prompt="UI being generated" />
  ) : (
    <ScoringCard
      tableHtml={tableHtml}
      loading={loading}
      refreshing={uiRefreshing}
      waitSeconds={waitSeconds}
      showScrollHint={!isRichStaticTable}
    />
  );

  return (
    <div
      className="min-h-screen flex flex-col bg-[#FBFCF9] text-[#14201A]"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <GlobalStyles />

      <SuccessModal
        isOpen={modal.show && modal.type === 'success'}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
      />
      <ErrorModal
        isOpen={modal.show && modal.type === 'error'}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
      />
      <WarningModal
        isOpen={modal.show && modal.type === 'warning'}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
      />
      <ConfirmModal
        isOpen={modal.show && modal.type === 'confirm'}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
      />

      <SubmitConfirmModal
        isOpen={submitConfirm.show}
        onConfirm={confirmSubmit}
        onCancel={cancelSubmit}
        judge={selectedJudge}
        contestName={contestName}
        contestantCount={config.contestants?.length || 0}
        criteriaCount={config.criteria?.length || 0}
        submitting={loading}
        primary={primary}
        secondary={secondary}
      />

      <JudgeHeader
        sysConfig={sysConfig}
        contestName={contestName}
        selectedJudge={selectedJudge}
        judgeCount={judgeCount}
        updateJudge={updateJudge}
        isOnline={isOnline}
        isJudgeLocked={isJudgeLocked}
      />

      <main className="flex-1 w-full px-3 sm:px-6 lg:px-8 2xl:px-10 py-4 sm:py-8 lg:py-10">

        {!loading && !isRichStaticTable && (
          <CriteriaHeader
            criteria={config.criteria}
            primary={primary}
            secondary={secondary}
          />
        )}

        <div
          className="bg-white rounded-sm sm:rounded-sm overflow-hidden w-full"
          style={{
            border:    `1px solid ${primary}20`,
            boxShadow: `0 4px 24px ${primary}15`,
          }}
        >
          {!isRichStaticTable && <CardHeaderStrip primary={primary} secondary={secondary} selectedJudge={selectedJudge} />}

          {body}
        </div>

        <div className="mt-6 sm:mt-10 flex flex-col items-center gap-3 sm:gap-4 pb-4">
          <SubmitButton
            onClick={submitToDB}
            disabled={!selectedJudge || loading}
            complete={isComplete}
            primary={primary}
          />
          <EncryptedBadge secondary={secondary} />
        </div>
      </main>

      <JudgeFooter sysConfig={sysConfig} />
    </div>
  );
}

export default JudgeTable;