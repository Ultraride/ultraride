import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric",
  });

const fmtTime = (d) =>
  new Date(d)
    .toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");

export default function DataFreshness() {
  const [data, setData] = useState(null);

  useEffect(() => {
    supabase.rpc("get_data_freshness").then(({ data, error }) => {
      if (!error && data) setData(data);
    });
  }, []);

  if (!data || (!data.last_check && !data.last_update)) return null;

  const parts = [];
  if (data.last_check) parts.push(`Vérifié le ${fmtDate(data.last_check)}`);
  if (data.last_update) {
    parts.push(`Dernière mise à jour le ${fmtDate(data.last_update)} à ${fmtTime(data.last_update)}`);
  }

  return <div className="data-freshness">{parts.join(" · ")}</div>;
}
