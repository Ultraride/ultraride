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

  const remove = async (c) => {
    if (!window.confirm("Supprimer définitivement ce commentaire ?")) return;
    setBusyId(c.id);
    const { error } = await supabase.from("comments").delete().eq("id", c.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  return (
    <div>
      <h1 className="h1">Commentaires</h1>
      {error && <div className="error-box">{error}</div>}
      {comments === null ? (
        <p className="muted">Chargement…</p>
      ) : comments.length === 0 ? (
        <p className="muted">Aucun commentaire pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {comments.map((c) => (
            <div key={c.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div className="muted mono" style={{ fontSize: 12 }}>
                  {c.race?.name || "course supprimée"} · {c.author?.display_name || c.author?.email || "—"}
                  {c.rating ? ` · ${c.rating}/5` : ""}
                  <span className={`badge badge-${c.status}`} style={{ marginLeft: 8 }}>{c.status === "visible" ? "Visible" : "Masqué"}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" disabled={busyId === c.id} onClick={() => toggleVisibility(c)}>
                    {c.status === "visible" ? "Masquer" : "Ré-afficher"}
                  </button>
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
