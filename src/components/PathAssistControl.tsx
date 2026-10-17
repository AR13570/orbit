import { setPathAssist, usePathAssist } from "../pathAssist";
import Icon from "./Icon";
import AdvancedToggle from "./AdvancedToggle";
export default function PathAssistControl() {
  const enabled = usePathAssist() === "full";
  return (
    <AdvancedToggle
      label="Path assist"
      description="On shows the full predicted path while aiming. Off shows a shorter preview. This changes the guide only, not shot power or gravity."
      enabled={enabled}
      onToggle={() => setPathAssist(enabled ? "partial" : "full")}
      icon={<Icon name="path" />}
    />
  );
}
