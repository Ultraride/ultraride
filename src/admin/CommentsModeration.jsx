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
      // pending first, then deletion requests, then recent
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else {
      // sort: pending → deletion_requested → rest
      const sorted = [...(data || [])].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        if (a.deletion_requested && !b.deletion_requested) return -1;
        if (b.deletion_requested && !a.deletion_requested) return 1;
        return 0;
      });
      setComments(sorted);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (c) => {
    setBusyId(c.id);
    const { error } = await supabase.from("comments").update({ status: "visible" }).eq("id", c.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

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

  const pendingCount = comments?.filter((c) => c.status === "pending").length || 0;
  const deletionCount = comments?.filter((c) => c.deletion_requested).length || 0;

  return (
    <div>
      <h1 className="h1">Commentaires</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {pendingCount > 0 && (
          <span className="badge badge-pending">{pendingCount} en attente de validation</span>
        )}
        {deletionCount > 0 && (
          <span className="badge badge-pending">{deletionCount} demande{deletionCount !== 1 ? "s" : ""} de suppression</span>
        )}
      </div>
      {error && <div className="error-box">{error}</div>}
      {comments === null ? (
        <p className="muted">Chargement…</p>
      ) : comments.length === 0 ? (
        <p className="muted">Aucun commentaire pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {comments.map((c) => (
            <div key={c.id} className="card" style={
              c.status === "pending" ? { borderColor: "var(--moss)" } :
              c.deletion_requested ? { borderColor: "var(--amber)" } : undefined
            }>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div className="muted mono" style={{ fontSize: 12 }}>
                  {c.race?.name || "course supprimée"} · {c.author?.display_name || c.author?.email || "Utilisateur supprimé"}
                  {c.rating ? ` · ${c.rating}/5` : ""}
                  {c.status === "pending" && <span className="badge badge-published" style={{ marginLeft: 8 }}>En attente</span>}
                  {c.status === "visible" && <span className="badge badge-published" style={{ marginLeft: 8 }}>Visible</span>}
                  {c.status === "hidden" && <span className="badge badge-rejected" style={{ marginLeft: 8 }}>Masqué</span>}
                  {c.deletion_requested && <span className="badge badge-pending" style={{ marginLeft: 8 }}>Suppression demandée</span>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {c.status === "pending" && (
                    <button className="btn btn-primary" disabled={busyId === c.id} onClick={() => approve(c)}>
                      Approuver
                    </button>
                  )}
                  {c.status !== "pending" && (
                    <button className="btn" disabled={busyId === c.id} onClick={() => toggleVisibility(c)}>
                      {c.status === "visible" ? "Masquer" : "Ré-afficher"}
                    </button>
                  )}
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
