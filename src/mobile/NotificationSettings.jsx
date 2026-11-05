import { useEffect, useState } from "react";
import { isNative } from "../lib/native";
import { TOPICS, getPushPrefs, setPushPrefs, pushPermission, pushInviteSeen, markPushInviteSeen } from "../lib/push";
import { MenuButton } from "./ui";

// Interrupteurs « Nouveaux ultras » / « Ultras mis à jour » (app seulement).
export function NotificationSettings() {
  const [prefs, setPrefs] = useState(getPushPrefs);
  const [perm, setPerm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  useEffect(() => { pushPermission().then(setPerm); }, []);

  if (!isNative) return <p className="m-note">Les notifications sont disponibles dans l'app UltraRide.</p>;

  const toggle = async (key) => {
    setBusy(true);
    setFailure(null);
    try {
      setPrefs(await setPushPrefs({ ...prefs, [key]: !prefs[key] }));
      setPerm("granted");
    } catch (e) {
      // Refus de l'utilisateur, ou autorisation accordée mais inscription
      // Firebase / Apple en échec : on distingue les deux cas.
      const p = await pushPermission();
      setPerm(p);
      if (!(p === "denied" && e?.message === "denied")) setFailure(e?.message || String(e));
      setPrefs({ newRaces: false, updates: false });
    }
    setBusy(false);
  };

  return (
    <div className="m-card m-list">
      {Object.entries(TOPICS).map(([key, t]) => (
        <label key={key} className="m-switchrow">
          <span className="m-row-body">
            <span className="m-row-title">{t.label}</span>
            <span className="m-switch-hint">{t.hint}</span>
          </span>
          <input type="checkbox" className="m-switch" checked={!!prefs[key]} disabled={busy} onChange={() => toggle(key)} />
        </label>
      ))}
      {failure && (
        <p className="m-note m-note--warn">
          L'inscription aux notifications n'a pas abouti. Réessaie dans un instant.
          <br /><small style={{ opacity: 0.7 }}>Détail : {failure}</small>
        </p>
      )}
      {perm === "denied" && (
        <p className="m-note m-note--warn">
          Les notifications sont bloquées pour UltraRide. Autorise-les dans les réglages du téléphone, puis réessaie.
        </p>
      )}
    </div>
  );
}

// Écran /notifications, accessible depuis le menu de l'app.
export function NotificationsScreen() {
  return (
    <div className="m-screen">
      <div className="m-pad m-stack">
        <div className="m-topbar">
          <h1 className="m-h1 m-h1--page">NOTIFICATIONS</h1>
          <MenuButton />
        </div>
        <p className="m-note">Une seule notification par vague : jamais une alerte par fiche.</p>
        <NotificationSettings />
      </div>
    </div>
  );
}

// Invitation affichée une seule fois sur l'accueil de l'app.
export function NotificationInvite() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNative || pushInviteSeen()) return;
    pushPermission().then((p) => setShow(p === "prompt"));
  }, []);

  if (!show) return null;

  const close = () => { markPushInviteSeen(); setShow(false); };
  const accept = async () => {
    setBusy(true);
    try { await setPushPrefs({ newRaces: true, updates: true }); } catch { /* refusé : rien de plus */ }
    close();
  };

  return (
    <div className="m-card m-geo">
      <p><strong>Être prévenu des nouveaux ultras ?</strong> Une notification quand un ultra est ajouté ou quand des fiches sont mises à jour. Modifiable à tout moment dans le menu.</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="m-btn m-btn--dark" onClick={accept} disabled={busy}>Activer</button>
        <button type="button" className="m-btn m-btn--ghost" onClick={close} disabled={busy}>Plus tard</button>
      </div>
    </div>
  );
}
