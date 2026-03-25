import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDrag, useDrop } from "react-dnd";
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Check,
  Copy,
  GripVertical,
} from "lucide-react";
import type { PriceLineConfig } from "./chart-widget";

const ITEM_TYPE = "PRICE_LINE";

// ── Color token groups ────────────────────────────────────────────────────────

interface ColorToken {
  varName: string;
  label: string;
}
interface ColorGroup {
  group: string;
  tokens: ColorToken[];
}

const COLOR_GROUPS: ColorGroup[] = [
  {
    group: "Surface",
    tokens: [
      { varName: "--surface-canvas", label: "Canvas" },
      { varName: "--surface-elevation-1", label: "Elevation-1" },
      { varName: "--surface-elevation-2", label: "Elevation-2" },
      { varName: "--surface-elevation-3", label: "Elevation-3" },
      { varName: "--surface-overlay", label: "Overlay" },
    ],
  },
  {
    group: "Contrast",
    tokens: [
      { varName: "--contrast-primary", label: "Primary" },
      { varName: "--contrast-secondary", label: "Secondary" },
      { varName: "--contrast-tertiary", label: "Tertiary" },
      { varName: "--contrast-quaternary", label: "Quaternary" },
    ],
  },
  {
    group: "Control",
    tokens: [
      { varName: "--control-border", label: "Border" },
      { varName: "--control-bg-default", label: "Default" },
      { varName: "--control-bg-hover", label: "Hover" },
      { varName: "--control-bg-active", label: "Active" },
      { varName: "--control-bg-inactive", label: "Inactive" },
    ],
  },
  {
    group: "Card",
    tokens: [
      { varName: "--card-border", label: "Border" },
      { varName: "--card-bg-default", label: "Default" },
      { varName: "--card-bg-hover", label: "Hover" },
      { varName: "--card-bg-active", label: "Active" },
      { varName: "--card-bg-inactive", label: "Inactive" },
    ],
  },
  {
    group: "Input",
    tokens: [
      { varName: "--input-border", label: "Border" },
      { varName: "--input-bg-default", label: "Default" },
      { varName: "--input-bg-hover", label: "Hover" },
      { varName: "--input-bg-active", label: "Active" },
      { varName: "--input-bg-inactive", label: "Inactive" },
    ],
  },
  {
    group: "Accent",
    tokens: [
      { varName: "--accent-bg-default", label: "Default" },
      { varName: "--accent-bg-hover", label: "Hover" },
      { varName: "--accent-bg-active", label: "Active" },
      { varName: "--accent-over", label: "Over" },
      { varName: "--accent-text-and-icons", label: "Text & Icons" },
      { varName: "--accent-transparent", label: "Transparent" },
    ],
  },
  {
    group: "Positive",
    tokens: [
      { varName: "--positive-bg-default", label: "Default" },
      { varName: "--positive-bg-hover", label: "Hover" },
      { varName: "--positive-bg-active", label: "Active" },
      { varName: "--positive-over", label: "Over" },
      { varName: "--positive-text-and-icons", label: "Text & Icons" },
      { varName: "--positive-transparent", label: "Transparent" },
    ],
  },
  {
    group: "Warning",
    tokens: [
      { varName: "--warning-bg-default", label: "Default" },
      { varName: "--warning-bg-hover", label: "Hover" },
      { varName: "--warning-bg-active", label: "Active" },
      { varName: "--warning-over", label: "Over" },
      { varName: "--warning-text-and-icons", label: "Text & Icons" },
      { varName: "--warning-transparent", label: "Transparent" },
    ],
  },
  {
    group: "Negative",
    tokens: [
      { varName: "--negative-bg-default", label: "Default" },
      { varName: "--negative-bg-hover", label: "Hover" },
      { varName: "--negative-bg-active", label: "Active" },
      { varName: "--negative-over", label: "Over" },
      { varName: "--negative-text-and-icons", label: "Text & Icons" },
      { varName: "--negative-transparent", label: "Transparent" },
    ],
  },
  {
    group: "Const",
    tokens: [
      { varName: "--const-1-green", label: "1 Green" },
      { varName: "--const-2-mustard", label: "2 Mustard" },
      { varName: "--const-3-orange", label: "3 Orange" },
      { varName: "--const-4-blue", label: "4 Blue" },
      { varName: "--const-5-pink", label: "5 Pink" },
      { varName: "--const-6-cyan", label: "6 Cyan" },
      { varName: "--const-7-peach", label: "7 Peach" },
      { varName: "--const-8-red", label: "8 Red" },
      { varName: "--const-9-violet", label: "9 Violet" },
    ],
  },
  {
    group: "Chart Lines",
    tokens: [
      { varName: "--chart-lines-grid", label: "Grid" },
      { varName: "--chart-lines-line-1", label: "Line 1" },
      { varName: "--chart-lines-line-2", label: "Line 2" },
    ],
  },
];

function resolveVar(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/** If value is a CSS var name (starts with --), resolve it. Otherwise return as-is. */
export function resolveColor(value: string): string {
  if (value.startsWith("--")) return resolveVar(value);
  return value;
}

// ── Color Token Picker ────────────────────────────────────────────────────────

interface ColorTokenPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorTokenPicker({ label, value, onChange }: ColorTokenPickerProps) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 240,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !buttonRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = () => {
    if (open) { setOpen(false); return; }
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen(true);
  };

  // Find friendly label for current value (token name stored directly)
  let selectedLabel: string = value;
  for (const group of COLOR_GROUPS) {
    for (const token of group.tokens) {
      if (token.varName === value) {
        selectedLabel = `${group.group} / ${token.label}`;
        break;
      }
    }
    if (selectedLabel !== value) break;
  }

  const resolvedValue = resolveColor(value);

  return (
    <div className="flex flex-col gap-[6px]">
      <span
        style={{
          fontFamily: "'Inter Display', sans-serif",
          fontSize: "var(--text-label)",
          color: "var(--muted-foreground)",
        }}
      >
        {label}
      </span>

      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="flex items-center gap-[8px] px-[8px] py-[6px] rounded-[var(--radius-sm)] border cursor-pointer w-full"
        style={{
          background: "var(--secondary)",
          borderColor: open ? "var(--primary)" : "var(--border)",
          color: "var(--foreground)",
          fontFamily: "'Inter Display', sans-serif",
          fontSize: "var(--text-label)",
        }}
      >
        <span
          className="w-[12px] h-[12px] rounded-full shrink-0 border"
          style={{ background: resolvedValue, borderColor: "var(--border)" }}
        />
        <span className="flex-1 text-left truncate" style={{ color: "var(--muted-foreground)" }}>
          {selectedLabel}
        </span>
        <ChevronDown
          size={12}
          style={{
            color: "var(--muted-foreground)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
            flexShrink: 0,
          }}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: dropPos.top,
              left: dropPos.left,
              width: Math.max(dropPos.width, 220),
              zIndex: 9999,
              maxHeight: 280,
              overflowY: "auto",
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            {COLOR_GROUPS.map((group) => (
              <div key={group.group}>
                {/* Group header */}
                <div
                  style={{
                    padding: "6px 10px 3px",
                    fontFamily: "'Inter Display', sans-serif",
                    fontSize: "var(--text-label)",
                    fontWeight: "600",
                    color: "var(--muted-foreground)",
                    position: "sticky",
                    top: 0,
                    background: "var(--popover)",
                  }}
                >
                  {group.group}
                </div>

                {group.tokens.map((token) => {
                  const resolved = resolveVar(token.varName);
                  const isSelected = token.varName === value;
                  return (
                    <button
                      key={token.varName}
                      onClick={() => { onChange(token.varName); setOpen(false); }}
                      className="flex items-center gap-[8px] w-full px-[10px] py-[5px] cursor-pointer"
                      style={{
                        background: isSelected ? "var(--secondary)" : "transparent",
                        fontFamily: "'Inter Display', sans-serif",
                        fontSize: "var(--text-label)",
                        color: "var(--foreground)",
                      }}
                    >
                      <span
                        className="w-[10px] h-[10px] rounded-full shrink-0 border"
                        style={{ background: resolved, borderColor: "var(--border)", flexShrink: 0 }}
                      />
                      <span>{token.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

// ── Line Width / Style options ────────────────────────────────────────────────

const LINE_WIDTH_OPTIONS = [0.5, 1.0, 1.5, 2.0];
const LINE_STYLE_OPTIONS = [
  { value: 0, label: "Solid" },
  { value: 1, label: "Dotted" },
  { value: 2, label: "Dashed" },
  { value: 3, label: "Large Dashed" },
  { value: 4, label: "Sparse Dotted" },
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--secondary)",
  color: "var(--foreground)",
  fontFamily: "'Inter Display', sans-serif",
  fontSize: "var(--text-label)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "4px 8px",
  outline: "none",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Inter Display', sans-serif",
  fontSize: "var(--text-label)",
  color: "var(--muted-foreground)",
};

// ── PriceLineEditor ───────────────────────────────────────────────────────────

interface PriceLineEditorProps {
  index: number;
  config: PriceLineConfig;
  onChange: (updated: PriceLineConfig) => void;
  onDelete: (id: string) => void;
  onDuplicate: (config: PriceLineConfig) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  canDelete: boolean;
}

export function PriceLineEditor({
  index,
  config,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  canDelete,
}: PriceLineEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(config.label);
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop({
    accept: ITEM_TYPE,
    collect: (monitor) => ({ handlerId: monitor.getHandlerId() }),
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  drop(ref);

  const handleLabelConfirm = () => {
    const trimmed = labelDraft.trim();
    if (trimmed) {
      onChange({ ...config, label: trimmed });
    } else {
      setLabelDraft(config.label);
    }
    setEditingLabel(false);
  };

  return (
    <div
      ref={ref}
      data-handler-id={handlerId}
      className="rounded-[var(--radius)] border overflow-hidden transition-all"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-[8px] p-[12px]">
        <div
          ref={(node) => { drag(node); }}
          className="shrink-0 cursor-grab active:cursor-grabbing flex items-center justify-center"
        >
          <GripVertical size={14} style={{ color: "var(--muted-foreground)" }} />
        </div>

        {editingLabel ? (
          <div className="flex-1 min-w-0 flex items-center gap-[4px]">
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLabelConfirm();
                if (e.key === "Escape") { setLabelDraft(config.label); setEditingLabel(false); }
              }}
              autoFocus
              style={{ ...inputStyle, fontSize: "var(--text-base)" }}
            />
            <button
              onClick={handleLabelConfirm}
              className="shrink-0 p-[2px] rounded hover:bg-secondary transition-colors cursor-pointer"
            >
              <Check size={14} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        ) : (
          <button
            className="flex-1 min-w-0 flex items-center gap-[4px] cursor-pointer group"
            onClick={() => { setLabelDraft(config.label); setEditingLabel(true); }}
          >
            <span
              className="truncate"
              style={{
                color: config.visible ? "var(--foreground)" : "var(--muted-foreground)",
                fontFamily: "'Inter Display', sans-serif",
                fontSize: "var(--text-base)",
              }}
            >
              {config.label}
            </span>
            <Pencil
              size={12}
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              style={{ color: "var(--muted-foreground)" }}
            />
          </button>
        )}

        <span
          className="shrink-0"
          style={{
            color: "var(--muted-foreground)",
            fontFamily: "'Inter Display', sans-serif",
            fontSize: "var(--text-label)",
          }}
        >
          ${config.price.toLocaleString()}
        </span>

        <button
          onClick={() => onChange({ ...config, visible: !config.visible })}
          className="shrink-0 p-[4px] rounded hover:bg-secondary transition-colors cursor-pointer"
          title={config.visible ? "Hide line" : "Show line"}
        >
          {config.visible
            ? <Eye size={14} style={{ color: "var(--muted-foreground)" }} />
            : <EyeOff size={14} style={{ color: "var(--muted-foreground)" }} />}
        </button>

        {canDelete && (
          <button
            onClick={() => onDelete(config.id)}
            className="shrink-0 p-[4px] rounded hover:bg-secondary transition-colors cursor-pointer"
            title="Delete line"
          >
            <Trash2 size={14} style={{ color: "var(--destructive)" }} />
          </button>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 p-[4px] rounded hover:bg-secondary transition-colors cursor-pointer"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded
            ? <ChevronUp size={14} style={{ color: "var(--muted-foreground)" }} />
            : <ChevronDown size={14} style={{ color: "var(--muted-foreground)" }} />}
        </button>
      </div>

      {/* Expanded editor body */}
      {expanded && (
        <div
          className="px-[12px] pb-[12px] flex flex-col gap-[10px] border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Price */}
          <div className="flex items-center gap-[8px] pt-[10px]">
            <label className="w-[80px] shrink-0" style={labelStyle}>Price</label>
            <input
              type="number"
              value={config.price}
              onChange={(e) => onChange({ ...config, price: parseFloat(e.target.value) || 0 })}
              step={100}
              style={inputStyle}
            />
          </div>

          {/* Line Color */}
          <ColorTokenPicker
            label="Line Color"
            value={config.color}
            onChange={(c) => onChange({ ...config, color: c })}
          />

          {/* Badge Color */}
          <ColorTokenPicker
            label="Badge Color"
            value={config.labelColor}
            onChange={(c) => onChange({ ...config, labelColor: c })}
          />

          {/* Badge Text */}
          <ColorTokenPicker
            label="Badge Text"
            value={config.labelTextColor}
            onChange={(c) => onChange({ ...config, labelTextColor: c })}
          />

          {/* Line Width */}
          <div className="flex items-center gap-[8px]">
            <label className="w-[80px] shrink-0" style={labelStyle}>Width</label>
            <input
              type="range"
              min={0}
              max={LINE_WIDTH_OPTIONS.length - 1}
              step={1}
              value={
                LINE_WIDTH_OPTIONS.indexOf(config.lineWidth) === -1
                  ? 1
                  : LINE_WIDTH_OPTIONS.indexOf(config.lineWidth)
              }
              onChange={(e) =>
                onChange({ ...config, lineWidth: LINE_WIDTH_OPTIONS[parseInt(e.target.value)] })
              }
              className="flex-1 cursor-pointer"
            />
            <span className="w-[32px] text-right shrink-0" style={labelStyle}>
              {config.lineWidth}px
            </span>
          </div>

          {/* Line Style */}
          <div className="flex flex-col gap-[6px]">
            <label style={labelStyle}>Style</label>
            <div className="flex gap-[4px]">
              {LINE_STYLE_OPTIONS.map((s) => {
                const active = config.lineStyle === s.value;
                const dashArray =
                  s.value === 0 ? undefined :
                  s.value === 1 ? "2,2" :
                  s.value === 2 ? "5,3" :
                  s.value === 3 ? "7,3" :
                  "2,6";
                const shortLabel =
                  s.value === 0 ? "Solid" :
                  s.value === 1 ? "Dot" :
                  s.value === 2 ? "Dash" :
                  s.value === 3 ? "Large" :
                  "Sparse";
                return (
                  <button
                    key={s.value}
                    onClick={() => onChange({ ...config, lineStyle: s.value })}
                    title={s.label}
                    className="flex-1 flex flex-col items-center gap-[4px] py-[6px] px-[2px] rounded cursor-pointer transition-colors"
                    style={{
                      background: active ? "var(--secondary)" : "transparent",
                      border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                    }}
                  >
                    <svg width="28" height="8" viewBox="0 0 28 8" style={{ overflow: "visible" }}>
                      <line
                        x1="2" y1="4" x2="26" y2="4"
                        stroke={active ? "var(--foreground)" : "var(--muted-foreground)"}
                        strokeWidth="1.5"
                        strokeDasharray={dashArray}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span style={{ fontSize: "9px", color: active ? "var(--foreground)" : "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif" }}>
                      {shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duplicate */}
          <button
            onClick={() => onDuplicate(config)}
            className="flex items-center justify-center gap-[6px] px-[10px] py-[6px] rounded-[var(--radius)] border transition-colors cursor-pointer mt-[4px]"
            style={{
              borderColor: "var(--primary)",
              color: "var(--primary)",
              fontFamily: "'Inter Display', sans-serif",
              fontSize: "var(--text-label)",
            }}
          >
            <Copy size={13} style={{ color: "var(--primary)" }} />
            Duplicate Line
          </button>

          {/* Show PnL */}
          <label
            className="flex items-center gap-[8px] cursor-pointer"
            style={{ ...labelStyle, color: "var(--foreground)" }}
          >
            <input
              type="checkbox"
              checked={config.showPnl ?? false}
              onChange={(e) => onChange({ ...config, showPnl: e.target.checked })}
              className="cursor-pointer"
            />
            Show PnL
          </label>
        </div>
      )}
    </div>
  );
}
