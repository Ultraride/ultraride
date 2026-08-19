import { useState } from "react";
import { useAuth } from "../lib/AuthContext";

const ROLES = [
  { value: null, label: "Administrateur" },
  { value: "organizer", label: "Organisateur" },
  { value: "participant", label: "Participant" },
];

// Dev-only tool: only rendered for a real admin. Lets you preview the site's
// UI as another role without changing your actual database role — real
// writes still use your genuine admin permissions underneath.
export default function RoleSwitcher() {
  const { realRole, previewRole, setPreviewRole } = useAuth();
  const [open, setOpen] = useState(false);

  if (realRole !== "admin") return null;

  const currentLabel = ROLES.find((r) => r.value === previewRole)?.label || "Administrateur";

  return (
    <div className="role-switcher">
      <button type="button" className="role-switcher-btn" onClick={() => setOpen((o) => !o)}>
        Aperçu : {currentLabel} ▾
      </button>
      {open && (
        <div className="role-switcher-menu">
          {ROLES.map((r) => (
            <button
              key={r.label}
              type="button"
              className={previewRole === r.value ? "active" : ""}
              onClick={() => { setPreviewRole(r.value); setOpen(false); }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
