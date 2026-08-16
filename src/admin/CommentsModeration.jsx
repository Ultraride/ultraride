import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function CommentsModeration() {
  const [comments, setComments] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("*, race:races(name), author:profiles(email, display_name)")
      // deletion requests bubble to the top so admin sees them first
      .order("deletion_requested", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setComments(data);
  };

  useEffect(() => { load(); }, []);

  const toggleVisibility = async (c) => {
    setBusyId(c.id);
    const { error } = await supabase
      .from("comments")
      .update({ status: c.status === "visible" ? "hidden" : "visible" })
      .eq("id", c.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  const dismissRequest = async (c) => {
    setBusyId(c.id);
    const { error } = await supabase.from("comments").update({ deletion_requested: false }).eq("id", c.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  const remove = async (c) => {
    if (!window.confirm("Supprimer définitivement ce commentaire ?")) return;
    setBusyId(c.id);
    const { error } = await supabase.from("comments").delete().eq("id", c.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  const pendingCount = comments?.filter((c) => c.deletion_requested).length || 0;

  return (
    <div>
      <h1 className="h1">Commentaires</h1>
      {pendingCount > 0 && (
        <p className="muted" style={{ marginBottom: 12 }}>
          <span className="badge badge-pending">{pendingCount} demande{pendingCount !== 1 ? "s" : ""} de suppression</span>
        </p>
      )}
      {error && <div className="error-box">{error}</div>}
      {comments === null ? (
        <p className="muted">Chargement…</p>
      ) : comments.length === 0 ? (
        <p className="muted">Aucun commentaire pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {comments.map((c) => (
            <div key={c.id} className="card" style={c.deletion_requested ? { borderColor: "var(--amber)" } : undefined}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div className="muted mono" style={{ fontSize: 12 }}>
                  {c.race?.name || "course supprimée"} · {c.author?.display_name || c.author?.email || "Utilisateur supprimé"}
                  {c.rating ? ` · ${c.rating}/5` : ""}
                  <span className={`badge badge-${c.status}`} style={{ marginLeft: 8 }}>{c.status === "visible" ? "Visible" : "Masqué"}</span>
                  {c.deletion_requested && <span className="badge badge-pending" style={{ marginLeft: 8 }}>Suppression demandée</span>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" disabled={busyId === c.id} onClick={() => toggleVisibility(c)}>
                    {c.status === "visible" ? "Masquer" : "Ré-afficher"}
                  </button>
                  {c.deletion_requested && (
                    <button className="btn" disabled={busyId === c.id} onClick={() => dismissRequest(c)}>Ignorer la demande</button>
                  )}
                  <button className="btn btn-danger" disabled={busyId === c.id} onClick={() => remove(c)}>Supprimer</button>
                </div>
              </div>
              <p style={{ marginTop: 8, marginBottom: 0 }}>{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
