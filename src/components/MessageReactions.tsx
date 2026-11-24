import { useRef, useState } from "react";
import { QUICK_REACTIONS } from "../lib/reactions";
import { useDismissablePopover } from "../lib/useDismissablePopover";
import { usePopoverPlacement } from "../lib/usePopoverPlacement";

export interface MessageReaction {
  emoji: string;
  count: number;
  /** Whether the viewer is one of the people who reacted with this emoji. */
  mine: boolean;
}

interface MessageReactionsProps {
  reactions: MessageReaction[];
  onToggle?: (emoji: string) => void;
}

/** Reaction chips under a message, plus (when interactive) an "add reaction" picker. */
export function MessageReactions({ reactions, onToggle }: MessageReactionsProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  useDismissablePopover(containerRef, open, () => setOpen(false));
  const placement = usePopoverPlacement(triggerRef, popoverRef, open);

  if (reactions.length === 0 && !onToggle) return null;

  return (
    <div className="msg-reactions" ref={containerRef}>
      {reactions.map(({ emoji, count, mine }) => {
        const label = `${emoji} ${count}`;
        return onToggle ? (
          <button
            key={emoji}
            type="button"
            className={`msg-reactions__chip${mine ? " msg-reactions__chip--mine" : ""}`}
            aria-pressed={mine}
            aria-label={`${label}${mine ? " (you reacted)" : ""}`}
            onClick={() => onToggle(emoji)}
          >
            <span aria-hidden="true">{emoji}</span> {count}
          </button>
        ) : (
          <span key={emoji} className="msg-reactions__chip" aria-label={label}>
            <span aria-hidden="true">{emoji}</span> {count}
          </span>
        );
      })}
      {onToggle && (
        <span className="msg-reactions__add">
          <button
            ref={triggerRef}
            type="button"
            className="msg-reactions__chip msg-reactions__chip--add"
            aria-haspopup="true"
            aria-expanded={open}
            aria-label="Add reaction"
            onClick={() => setOpen((o) => !o)}
          >
            + 😊
          </button>
          {open && (
            <div
              className="reaction-popover"
              role="menu"
              aria-label="React to message"
              ref={popoverRef}
              style={placement}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  className="reaction-popover__item"
                  onClick={() => {
                    onToggle(emoji);
                    setOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </span>
      )}
    </div>
  );
}
