import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function PendingRaces() {
  const { user } = useAuth();
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("races")
      .select("*, created_by:profiles!races_created_by_fkey(email, display_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setRaces(data);
  };

  useEffect(() => { load(); }, []);

  const approve = async (race) => {
    setBusyId(race.id);
    const { error } = await supabase
      .from("races")
      .update({ status: "published", reviewed_by: user.id, review_note: null })
      .eq("id", race.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  const reject = async (race) => {
    const note = window.prompt("Raison du refus (visible par l'organisateur) :", "");
    if (note === null) return;
    setBusyId(race.id);
    const { error } = await supabase
      .from("races")
      .update({ status: "rejected", reviewed_by: user.id, review_note: note })
      .eq("id", race.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  return (
    <div>
      <h1 className="h1">Courses à valider</h1>
      {error && <div className="error-box">{error}</div>}
      {races === null ? (
        <p className="muted">Chargement…</p>
      ) : races.length === 0 ? (
        <p className="muted">Aucune soumission en attente.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {races.map((r) => (
            <div key={r.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="h2" style={{ marginBottom: 4 }}>{r.name}</div>
                  <div className="muted mono">
                    {r.country} · {r.discipline} · {r.km} km · {r.dplus} D+ · soumis par{" "}
                    {r.created_by?.display_name || r.created_by?.email || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" disabled={busyId === r.id} onClick={() => approve(r)}>
                    Publier
                  </button>
                  <button className="btn btn-danger" disabled={busyId === r.id} onClick={() => reject(r)}>
                    Refuser
                  </button>
                </div>
              </div>
              {r.blurb && <p className="muted" style={{ marginTop: 10 }}>{r.blurb}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
