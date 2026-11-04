import { useMemo, useState } from "react";
import { formatBytes } from "../lib/compressImage";
import { MEDIA_BASE, uploadImage } from "../lib/mediaUpload";

// Copie unique des images du bucket Supabase « public-images » vers OVH
// (/media/, mêmes chemins), puis SQL qui réécrit les URLs en base.
// Relançable sans risque : un fichier déjà présent chez OVH est ignoré.

const OLD_BASE = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "")}/storage/v1/object/public/public-images/`;

const EXT_BY_TYPE = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/svg+xml": ["svg"],
};

// Les images recompressées par l'optimiseur sont du WebP sous un nom en .png
// ou .jpg : elles sont déposées en « nom.png.webp », et media/.htaccess les
// sert à leur URL d'origine.
function targetPath(path, type) {
  const ext = path.split(".").pop().toLowerCase();
  const expected = EXT_BY_TYPE[type];
  if (expected && !expected.includes(ext)) return `${path}.${expected[0]}`;
  return path;
}

function buildSql() {
  return `-- UltraRide : URLs d'images Supabase Storage → OVH (${MEDIA_BASE})
-- À lancer une seule fois, après la copie des fichiers sans erreur.
-- Parcourt toutes les colonnes texte du schéma public (races.image_url,
-- organizers.logo_url…) ; triggers utilisateur coupés le temps de l'UPDATE.
create temp table if not exists _media_migration (table_name text, column_name text, lignes bigint);
truncate _media_migration;

do $$
declare
  old_prefix text := '${OLD_BASE}';
  new_prefix text := '${MEDIA_BASE}';
  c record;
  n bigint;
begin
  for c in
    select col.table_name, col.column_name
    from information_schema.columns col
    join information_schema.tables t
      on t.table_schema = col.table_schema and t.table_name = col.table_name
    where col.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and col.data_type in ('text', 'character varying')
  loop
    execute format('select count(*) from public.%I where starts_with(%I, %L)',
      c.table_name, c.column_name, old_prefix) into n;
    if n > 0 then
      execute format('alter table public.%I disable trigger user', c.table_name);
      execute format('update public.%I set %I = %L || substr(%I, %s) where starts_with(%I, %L)',
        c.table_name, c.column_name, new_prefix, c.column_name, length(old_prefix) + 1,
        c.column_name, old_prefix);
      execute format('alter table public.%I enable trigger user', c.table_name);
      insert into _media_migration values (c.table_name, c.column_name, n);
    end if;
  end loop;
end $$;

-- Lignes réécrites par colonne (aucune ligne = rien à migrer ou déjà fait).
select * from _media_migration order by table_name, column_name;
`;
}

export default function MediaMigration({ files, downloadFile }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState([]);
  const [copied, setCopied] = useState(false);

  const sql = useMemo(buildSql, []);
  const counts = useMemo(() => {
    const values = Object.values(results);
    return {
      copied: values.filter((r) => r === "copied").length,
      exists: values.filter((r) => r === "exists").length,
      error: values.filter((r) => r === "error").length,
    };
  }, [results]);
  const done = progress && progress.current === null;

  const run = async () => {
    setBusy(true);
    setErrors([]);
    const queue = files.filter((f) => results[f.path] !== "copied" && results[f.path] !== "exists");
    for (let i = 0; i < queue.length; i += 1) {
      const f = queue[i];
      setProgress({ done: i, total: queue.length, current: f.path });
      try {
        const blob = await downloadFile(f.path);
        const type = blob.type || f.type;
        const res = await uploadImage(blob, {
          path: targetPath(f.path, type),
          filename: f.path.split("/").pop(),
        });
        setResults((r) => ({ ...r, [f.path]: res.exists ? "exists" : "copied" }));
      } catch (e) {
        setResults((r) => ({ ...r, [f.path]: "error" }));
        setErrors((list) => [...list, `${f.path} : ${e.message}`]);
      }
    }
    setProgress({ done: queue.length, total: queue.length, current: null });
    setBusy(false);
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé : le texte reste sélectionnable à la main.
    }
  };

  const totalSize = files.reduce((n, f) => n + f.size, 0);

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <h2 className="h2" style={{ marginTop: 0 }}>Passage des images chez OVH</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Les nouvelles images sont déjà envoyées chez OVH ({MEDIA_BASE}). Pour les anciennes :
        1. copier les fichiers du Storage Supabase vers OVH ; 2. coller le SQL dans le SQL Editor de
        Supabase pour réécrire les URLs en base. Ensuite, plus aucune image n'est servie par Supabase.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="mono" style={{ fontSize: 13 }}>
          {files.length} fichier{files.length !== 1 ? "s" : ""} · {formatBytes(totalSize)}
          {(counts.copied > 0 || counts.exists > 0) && (
            <span style={{ color: "var(--moss)" }}>
              {" "}· {counts.copied} copié{counts.copied !== 1 ? "s" : ""}
              {counts.exists > 0 && `, ${counts.exists} déjà présent${counts.exists !== 1 ? "s" : ""}`}
            </span>
          )}
          {counts.error > 0 && <span style={{ color: "var(--brick)" }}> · {counts.error} en erreur</span>}
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy || files.length === 0}>
          {busy ? "Copie en cours…" : counts.error > 0 ? "Relancer les fichiers en erreur" : "1. Copier les fichiers vers OVH"}
        </button>
      </div>

      {progress && (
        <div style={{ marginTop: 12 }}>
          <div className="ig-progress">
            <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }} />
          </div>
          <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>
            {progress.current ? `${progress.done + 1} / ${progress.total} · ${progress.current}` : "Copie terminée."}
          </div>
        </div>
      )}
      {errors.map((e, i) => (
        <div key={i} className="error-box" style={{ marginTop: 8 }}>{e}</div>
      ))}

      {done && counts.error === 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <strong>2. SQL à coller dans le SQL Editor de Supabase</strong>
            <button className="btn" onClick={copySql}>{copied ? "Copié" : "Copier le SQL"}</button>
          </div>
          <textarea
            readOnly
            value={sql}
            className="mono"
            rows={12}
            style={{ width: "100%", fontSize: 11, marginTop: 8 }}
            onFocus={(e) => e.target.select()}
          />
          <div className="field-hint">
            Le résultat liste les colonnes réécrites. Vérifie ensuite quelques fiches : les images doivent
            s'afficher depuis ultraride.eu/media/.
          </div>
        </div>
      )}
    </div>
  );
}
