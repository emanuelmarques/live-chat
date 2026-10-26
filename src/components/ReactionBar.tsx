import { useRef, useState } from "react";
import { QUICK_REACTIONS } from "../lib/reactions";
import { useDismissablePopover } from "../lib/useDismissablePopover";

interface ReactionBarProps {
  onReact: (emoji: string) => void;
  disabled?: boolean;
}

/** The small "send a Zoom-style reaction" trigger and its quick-pick popover. */
export function ReactionBar({ onReact, disabled }: ReactionBarProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissablePopover(containerRef, open, () => setOpen(false));

  return (
    <div className="reaction-trigger" ref={containerRef}>
      <button
        type="button"
        className="reaction-trigger__button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className="reaction-trigger__icon" aria-hidden="true">
          👍
        </span>
        <span>React</span>
      </button>
      {open && (
        <div className="reaction-popover" role="menu" aria-label="Reactions">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              className="reaction-popover__item"
              onClick={() => {
                onReact(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
