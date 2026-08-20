import { useRef, useState } from "react";

// Nominatim (OpenStreetMap) place autocomplete — no API key needed.
// On selection, calls onSelect({ name, lat, lon }) so the parent can fill
// the place label and the two coordinate fields simultaneously.
export default function PlaceSearch({ label, value, onSelect, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);

  const search = (text) => {
    setQuery(text);
    onSelect({ name: text, lat: null, lon: null });
    window.clearTimeout(timeoutRef.current);
    if (text.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    timeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=6&accept-language=fr`,
          { headers: { "Accept-Language": "fr" } }
        );
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch { setSuggestions([]); setOpen(false); }
    }, 400);
  };

  const pick = (item) => {
    const name = item.display_name.split(",").slice(0, 2).join(",").trim();
    setQuery(name);
    onSelect({ name, lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="field" style={{ position: "relative" }}>
      <label>{label}</label>
      <input
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder || "Rechercher un lieu…"}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="race-search-suggestions">
          {suggestions.map((s) => (
            <button type="button" key={s.place_id} className="race-search-suggestion" onClick={() => pick(s)}>
              <div style={{ fontSize: 13 }}>{s.display_name.split(",").slice(0, 2).join(",")}</div>
              <div className="muted mono" style={{ fontSize: 11 }}>{s.display_name.split(",").slice(2, 4).join(",")}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
