import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function RaceSubmissions() {
  const [submissions, setSubmissions] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("race_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setSubmissions(data || []);
  };

  useEffect(() => { load(); }, []);

  const toggleHandled = async (s) => {
    setBusyId(s.id);
    const { error } = await supabase
      .from("race_submissions")
      .update({ status: s.status === "handled" ? "new" : "handled" })
      .eq("id", s.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  const remove = async (s) => {
    if (!window.confirm("Supprimer définitivement cette proposition ?")) return;
    setBusyId(s.id);
    const { error } = await supabase.from("race_submissions").delete().eq("id", s.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  const newCount = submissions?.filter((s) => s.status === "new").length || 0;

  return (
    <div>
      <h1 className="h1">Propositions de course</h1>
      {newCount > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span className="badge badge-pending">{newCount} nouvelle{newCount !== 1 ? "s" : ""}</span>
        </div>
      )}
      {error && <div className="error-box">{error}</div>}
      {submissions === null ? (
        <p className="muted">Chargement…</p>
      ) : submissions.length === 0 ? (
        <p className="muted">Aucune proposition pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {submissions.map((s) => (
            <div key={s.id} className="card" style={s.status === "new" ? { borderColor: "var(--moss)" } : undefined}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div className="muted mono" style={{ fontSize: 12 }}>
                  {new Date(s.created_at).toLocaleDateString("fr-FR")} · {s.name} ({s.email})
                  {s.status === "new" && <span className="badge badge-published" style={{ marginLeft: 8 }}>Nouveau</span>}
                  {s.status === "handled" && <span className="badge badge-rejected" style={{ marginLeft: 8 }}>Traité</span>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" disabled={busyId === s.id} onClick={() => toggleHandled(s)}>
                    {s.status === "handled" ? "Marquer non traité" : "Marquer traité"}
                  </button>
                  <button className="btn btn-danger" disabled={busyId === s.id} onClick={() => remove(s)}>Supprimer</button>
                </div>
              </div>
              <p style={{ marginTop: 8, marginBottom: 4, fontWeight: 600 }}>{s.race_name}</p>
              {s.website && (
                <p style={{ marginTop: 0, marginBottom: 4, fontSize: 13 }}>
                  <a href={s.website} target="_blank" rel="noopener noreferrer">{s.website}</a>
                </p>
              )}
              <p style={{ marginTop: 4, marginBottom: 0, whiteSpace: "pre-wrap" }}>{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
