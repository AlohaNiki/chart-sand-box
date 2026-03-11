import { useState, useRef } from "react";
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

const COLOR_PRESETS = [
  "#009F70",
  "#66FFE5",
  "#F14F5D",
  "#FFCC4A",
  "#5364FF",
  "#FF6B35",
  "#A855F7",
  "#EC4899",
  "#8B95A5",
  "#14B8A6",
];

const LINE_WIDTH_OPTIONS = [0.5, 1, 2, 3, 4];
const LINE_STYLE_OPTIONS = [
  { value: 0, label: "Solid" },
  { value: 1, label: "Dotted" },
  { value: 2, label: "Dashed" },
  { value: 3, label: "Large Dashed" },
  { value: 4, label: "Sparse Dotted" },
];

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
    collect: (monitor) => ({
      handlerId: monitor.getHandlerId(),
    }),
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
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
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }] = useDrop({
    accept: ITEM_TYPE,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
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

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "auto" as const,
  };

  return (
    <div
      ref={ref}
      data-handler-id={handlerId}
      className="rounded-[var(--radius)] border overflow-hidden transition-all"
      style={{
        background: "var(--card)",
        borderColor: isOver ? "var(--primary)" : "var(--border)",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-[8px] p-[12px]">
        <div
          ref={(node) => {
            drag(node);
          }}
          className="shrink-0 cursor-grab active:cursor-grabbing flex items-center justify-center"
        >
          <GripVertical size={14} style={{ color: "var(--muted-foreground)" }} />
        </div>
        <div
          className="w-[10px] h-[10px] rounded-full shrink-0"
          style={{ backgroundColor: config.color }}
        />
        {editingLabel ? (
          <div className="flex-1 min-w-0 flex items-center gap-[4px]">
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLabelConfirm();
                if (e.key === "Escape") {
                  setLabelDraft(config.label);
                  setEditingLabel(false);
                }
              }}
              autoFocus
              style={{
                ...inputStyle,
                fontSize: "var(--text-base)",
              }}
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
            onClick={() => {
              setLabelDraft(config.label);
              setEditingLabel(true);
            }}
          >
            <span
              className="truncate"
              style={{
                color: config.visible
                  ? "var(--foreground)"
                  : "var(--muted-foreground)",
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
          {config.visible ? (
            <Eye size={14} style={{ color: "var(--muted-foreground)" }} />
          ) : (
            <EyeOff size={14} style={{ color: "var(--muted-foreground)" }} />
          )}
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 p-[4px] rounded hover:bg-secondary transition-colors cursor-pointer"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronUp size={14} style={{ color: "var(--muted-foreground)" }} />
          ) : (
            <ChevronDown
              size={14}
              style={{ color: "var(--muted-foreground)" }}
            />
          )}
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
            <label className="w-[80px] shrink-0" style={labelStyle}>
              Price
            </label>
            <input
              type="number"
              value={config.price}
              onChange={(e) =>
                onChange({ ...config, price: parseFloat(e.target.value) || 0 })
              }
              step={100}
              style={inputStyle}
            />
          </div>

          {/* Line Color */}
          <div className="flex flex-col gap-[6px]">
            <label style={labelStyle}>Line Color</label>
            <div className="flex items-center gap-[6px] flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => onChange({ ...config, color: c })}
                  className="w-[22px] h-[22px] rounded-full border-2 transition-all cursor-pointer"
                  style={{
                    backgroundColor: c,
                    borderColor:
                      config.color === c
                        ? "var(--muted-foreground)"
                        : "transparent",
                  }}
                />
              ))}
              <input
                type="color"
                value={config.color}
                onChange={(e) => onChange({ ...config, color: e.target.value })}
                className="w-[22px] h-[22px] rounded-full cursor-pointer border-0 p-0"
                style={{ background: "none" }}
              />
            </div>
          </div>

          {/* Label Badge Color */}
          <div className="flex flex-col gap-[6px]">
            <label style={labelStyle}>Badge Color</label>
            <div className="flex items-center gap-[6px] flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => onChange({ ...config, labelColor: c })}
                  className="w-[22px] h-[22px] rounded-full border-2 transition-all cursor-pointer"
                  style={{
                    backgroundColor: c,
                    borderColor:
                      config.labelColor === c
                        ? "var(--muted-foreground)"
                        : "transparent",
                  }}
                />
              ))}
              <input
                type="color"
                value={config.labelColor}
                onChange={(e) =>
                  onChange({ ...config, labelColor: e.target.value })
                }
                className="w-[22px] h-[22px] rounded-full cursor-pointer border-0 p-0"
                style={{ background: "none" }}
              />
            </div>
          </div>

          {/* Badge Text Color */}
          <div className="flex flex-col gap-[6px]">
            <label style={labelStyle}>Badge Text</label>
            <div className="flex items-center gap-[6px] flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => onChange({ ...config, labelTextColor: c })}
                  className="w-[22px] h-[22px] rounded-full border-2 transition-all cursor-pointer"
                  style={{
                    backgroundColor: c,
                    borderColor:
                      config.labelTextColor === c
                        ? "var(--muted-foreground)"
                        : "transparent",
                  }}
                />
              ))}
              <input
                type="color"
                value={config.labelTextColor}
                onChange={(e) =>
                  onChange({ ...config, labelTextColor: e.target.value })
                }
                className="w-[22px] h-[22px] rounded-full cursor-pointer border-0 p-0"
                style={{ background: "none" }}
              />
            </div>
          </div>

          {/* Line Width */}
          <div className="flex items-center gap-[8px]">
            <label className="w-[80px] shrink-0" style={labelStyle}>
              Width
            </label>
            <input
              type="range"
              min={0}
              max={LINE_WIDTH_OPTIONS.length - 1}
              step={1}
              value={LINE_WIDTH_OPTIONS.indexOf(config.lineWidth) === -1 ? 1 : LINE_WIDTH_OPTIONS.indexOf(config.lineWidth)}
              onChange={(e) =>
                onChange({
                  ...config,
                  lineWidth: LINE_WIDTH_OPTIONS[parseInt(e.target.value)],
                })
              }
              className="flex-1 cursor-pointer"
            />
            <span className="w-[32px] text-right shrink-0" style={labelStyle}>
              {config.lineWidth}px
            </span>
          </div>

          {/* Line Style */}
          <div className="flex items-center gap-[8px]">
            <label className="w-[80px] shrink-0" style={labelStyle}>
              Style
            </label>
            <select
              value={config.lineStyle}
              onChange={(e) =>
                onChange({
                  ...config,
                  lineStyle: parseInt(e.target.value, 10),
                })
              }
              style={selectStyle}
            >
              {LINE_STYLE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Delete button for custom levels */}
          {canDelete && (
            <button
              onClick={() => onDelete(config.id)}
              className="flex items-center justify-center gap-[6px] px-[10px] py-[6px] rounded-[var(--radius)] border transition-colors cursor-pointer mt-[4px]"
              style={{
                borderColor: "var(--destructive)",
                color: "var(--destructive)",
                fontFamily: "'Inter Display', sans-serif",
                fontSize: "var(--text-label)",
              }}
            >
              <Trash2 size={13} style={{ color: "var(--destructive)" }} />
              Delete Line
            </button>
          )}

          {/* Duplicate button for custom levels */}
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
        </div>
      )}
    </div>
  );
}