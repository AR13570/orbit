import { useId, useState, type ReactNode } from "react";
import Icon from "./Icon";

export default function AdvancedToggle({
  label,
  description,
  enabled,
  onToggle,
  icon,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  icon: ReactNode;
}) {
  const [explaining, setExplaining] = useState(false);
  const id = useId();
  return (
    <div className="advanced-setting">
      <div className="advanced-setting-controls">
        <button
          type="button"
          className="pause-option"
          role="switch"
          aria-label={label}
          aria-checked={enabled}
          onClick={onToggle}
        >
          {icon}
          <span className="advanced-setting-label">{label}</span>
          <span className="pause-switch" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="advanced-setting-help"
          aria-label={`About ${label}`}
          aria-expanded={explaining}
          aria-controls={id}
          onClick={() => setExplaining((value) => !value)}
        >
          <Icon name="help" />
        </button>
      </div>
      <p id={id} className="advanced-setting-description" hidden={!explaining}>
        {description}
      </p>
    </div>
  );
}
