import { setPathAssist, usePathAssist } from "../pathAssist";
import Icon from "./Icon";
export default function PathAssistControl() {
  const enabled = usePathAssist() === "full";
  return (
    <button
      type="button"
      className="pause-option"
      role="switch"
      aria-checked={enabled}
      onClick={() => setPathAssist(enabled ? "partial" : "full")}
    >
      <Icon name="path" />
      <span>Path assist</span>
      <span className="pause-switch" aria-hidden="true" />
    </button>
  );
}
