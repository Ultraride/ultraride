import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import RaceForm from "./RaceForm";

const STATUS_LABEL = {
  draft: "Brouillon",
  pending: "En attente",
  published: "Publiée",
  rejected: "Refusée",
};

const NO_ORGANIZER = "— Sans organisateur —";

function normalize(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function RacesManager() {
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState({});

  const load = async () => {
    const { data, error } = await supabase
      .from("races")
      .select("*, organizer:organizers!races_organizer_id_fkey(name)")
      .order("name", { ascending: true });
    if (error) setError(error.message);
    else setRaces(data);
  };

  useEffect(() => { load(); }, []);

  const remove = async (race) => {
    if (!window.confirm(`Supprimer définitivement « ${race.name} » ?`)) return;
    setDeleting(race.id);
    const { error } = await supabase.from("races").delete().eq("id", race.id);
    setDeleting(null);
    if (error) setError(error.message);
    else load();
  };

  // Regroupement par organisateur. La recherche filtre d'abord, ce qui vide
  // les groupes sans correspondance : chercher « corsica » ne laisse que
  // BikingMan à l'écran.
  const groups = useMemo(() => {
    if (!races) return [];
    const q = normalize(search.trim());

    const filtered = q
      ? races.filter((r) =>
          normalize([r.name, r.organizer?.name, r.organizer_name, r.country, r.event_name]
            .filter(Boolean).join(" ")).includes(q)
        )
      : races;

    const map = new Map();
    filtered.forEach((r) => {
      const key = r.organizer?.name || r.organizer_name || NO_ORGANIZER;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });

    return [...map.entries()]
      .map(([name, list]) => ({
        name,
        races: list,
        pending: list.filter((r) => r.status === "pending").length,
        unpublished: list.filter((r) => r.status !== "published").length,
      }))
      // Les courses orphelines en dernier : elles signalent une anomalie,
      // pas un organisateur.
      .sort((a, b) => {
        if (a.name === NO_ORGANIZER) return 1;
        if (b.name === NO_ORGANIZER) return -1;
        return a.name.localeCompare(b.name);
      });
  }, [races, search]);

  const searching = search.trim().length > 0;

  const toggle = (name) => setOpenGroups((g) => ({ ...g, [name]: !g[name] }));

  const isOpen = (name) => (searching ? true : !!openGroups[name]);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <h1 className="h1" style={{ margin: 0 }}>Toutes les courses</h1>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ Nouvelle course</button>
      </div>

      <div className="search-bar" style={{ marginBottom: 16 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une course, un organisateur, un pays…"
          aria-label="Rechercher"
        />
        {search && (
          <button type="button" className="filter-reset" onClick={() => setSearch("")}>Effacer</button>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {races === null ? (
        <p className="muted">Chargement…</p>
      ) : groups.length === 0 ? (
        <p className="muted">Aucune course ne correspond à cette recherche.</p>
      ) : (
        <>
          <div className="muted mono" style={{ fontSize: 12, marginBottom: 10 }}>
            {groups.reduce((n, g) => n + g.races.length, 0)} course
            {groups.reduce((n, g) => n + g.races.length, 0) !== 1 ? "s" : ""} ·{" "}
            {groups.length} organisateur{groups.length !== 1 ? "s" : ""}
            {searching && " · groupes dépliés automatiquement"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.map((g) => (
              <div key={g.name} className="org-group">
                <button
                  type="button"
                  className="org-group-head"
                  onClick={() => toggle(g.name)}
                  aria-expanded={isOpen(g.name)}
                >
                  <span className="org-group-caret">{isOpen(g.name) ? "▾" : "▸"}</span>
                  <span className="org-group-name">{g.name}</span>
                  <span className="org-group-count">
                    {g.races.length} course{g.races.length !== 1 ? "s" : ""}
                  </span>
                  {g.pending > 0 && <span className="badge badge-pending">{g.pending} en attente</span>}
                  {g.unpublished - g.pending > 0 && (
                    <span className="badge badge-draft">{g.unpublished - g.pending} non publiée{g.unpublished - g.pending !== 1 ? "s" : ""}</span>
                  )}
                </button>

                {isOpen(g.name) && (
                  <table className="admin-table" style={{ marginTop: 0 }}>
                    <thead>
                      <tr>
                        <th>Nom</th>
                        <th>Événement</th>
                        <th>Pays</th>
                        <th>Statut</th>
                        <th>Km</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {g.races.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.name}
                            {r.deletion_requested && (
                              <span className="badge badge-rejected" style={{ marginLeft: 6 }}>
                                suppression demandée
                              </span>
                            )}
                          </td>
                          <td className="muted">{r.event_name || "—"}</td>
                          <td>{r.country}</td>
                          <td>
                            <span className={`badge badge-${r.status}`}>
                              {STATUS_LABEL[r.status] || r.status}
                            </span>
                          </td>
                          <td className="mono">{r.km ?? "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button className="btn" onClick={() => setEditing(r)}>Modifier</button>{" "}
                            <button className="btn btn-danger" disabled={deleting === r.id} onClick={() => remove(r)}>
                              Suppr.
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
