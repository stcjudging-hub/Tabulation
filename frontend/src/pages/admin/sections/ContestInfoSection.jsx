import { useState, useRef, useEffect } from "react";
import { card } from "./card.js";
import { ChevronDown, ChevronUp } from "lucide-react";

const PRESET_TYPES = ["pageant", "talent show", "debate", "sports", "academic"];

const ContestInfoSection = ({
  contestName,
  setContestName,
  contestType,
  setContestType,
}) => {
  const isCustom = !PRESET_TYPES.includes(contestType);
  const [customOpen, setCustomOpen] = useState(isCustom);
  const [customValue, setCustomValue] = useState(isCustom ? contestType : "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (customOpen) inputRef.current?.focus();
  }, [customOpen]);

  const baseStyle = {
    padding: "7px 14px",
    borderRadius: 6,
    border: "1.5px solid var(--border)",
    background: "var(--surface2)",
    color: "var(--text2)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    textTransform: "capitalize",
    fontFamily: "inherit",
    transition: "all .15s",
  };
  const activeStyle = {
    ...baseStyle,
    border: "1.5px solid var(--accent-mid)",
    background: "var(--accent-lt)",
    color: "var(--accent)",
  };

  const customStyle = !customOpen
    ? baseStyle
    : {
        ...baseStyle,
        borderColor: "var(--accent-mid)",
        background: "var(--accent-lt)",
        color: "var(--accent)",
      };

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="section-heading">Contest Information</div>
      {/* Two columns on desktop · stacks on tablet/mobile */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div>
        <div className="field-label">Contest Name</div>
        <input
          className="field-input"
          placeholder="e.g. Miss Barangay Fiesta 2025"
          value={contestName}
          onChange={(e) => setContestName(e.target.value)}
        />
      </div>
      <div>
        <div className="field-label">Contest Type</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 6,
            alignItems: "center",
          }}
        >
          {PRESET_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => {
                setContestType(t);
                setCustomOpen(false);
                setCustomValue("");
              }}
              style={contestType === t ? activeStyle : baseStyle}
            >
              {t}
            </button>
          ))}

  
<button
  onClick={() => {
    setCustomOpen(!customOpen);
    if (!customOpen) setContestType(customValue.trim() || '');
  }}
  style={{
    ...customStyle,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  }}
>
  Custom
  <ChevronDown
    size={13}
    style={{
      transform: customOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
    }}
  />
</button>

        </div>

        {customOpen && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 10,
            }}
          >
            <input
              ref={inputRef}
              className="field-input"
              style={{ maxWidth: 260 }}
              placeholder="e.g. spelling bee, choir, chess"
              value={customValue}
              onChange={(e) => {
                setCustomValue(e.target.value);
                setContestType(e.target.value);
              }}
            />
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              Type your own contest type if it's not listed.
            </span>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
export default ContestInfoSection;
