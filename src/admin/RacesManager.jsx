import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import RaceForm from "./RaceForm";

const STATUS_LABEL = { draft: "Brouillon", pending: "En attente", published: "Publiée", rejected: "Refusée" };

export default function RacesManager() {
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null = not editing, {} = new, {...} = existing
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from("races").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRaces(data);
  };

  useEffect(() => { load(); }, []);

  const remove = async (race) => {
    if (!window.confirm(`Supprimer définitivement « ${race.name} » ?`)) return;
    setBusyId(race.id);
    const { error } = await supabase.from("races").delete().eq("id", race.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  if (editing !== null) {
    return (
      <RaceForm
        race={editing.id ? editing : null}
        onSaved={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="h1" style={{ margin: 0 }}>Toutes les courses</h1>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ Nouvelle course</button>
      </div>
      {error && <div className="error-box">{error}</div>}
      {races === null ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nom</th><th>Pays</th><th>Statut</th><th>Km</th><th></th>
            </tr>
          </thead>
          <tbody>
            {races.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.country}</td>
                <td><span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                <td className="mono">{r.km ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn" onClick={() => setEditing(r)}>Modifier</button>{" "}
                  <button className="btn btn-danger" disabled={busyId === r.id} onClick={() => remove(r)}>Suppr.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
