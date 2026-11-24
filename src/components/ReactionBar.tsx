import { QUICK_REACTIONS } from "../lib/reactions";

interface ReactionBarProps {
  onReact: (emoji: string) => void;
  disabled?: boolean;
}

/** One-tap "send a Zoom-style reaction" row, always visible above the composer. */
export function ReactionBar({ onReact, disabled }: ReactionBarProps) {
  return (
    <div className="reaction-bar" role="group" aria-label="Send a reaction">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-bar__item"
          aria-label={`Send reaction ${emoji}`}
          onClick={() => onReact(emoji)}
          disabled={disabled}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
