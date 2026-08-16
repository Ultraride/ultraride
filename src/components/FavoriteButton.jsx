import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

// Small star toggle. Works on race cards and the race detail page. If the
// visitor isn't logged in, clicking sends them to /login instead of failing.
export default function FavoriteButton({ raceId, size = 18 }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setIsFav(false); return; }
    supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("race_id", raceId)
      .maybeSingle()
      .then(({ data }) => setIsFav(!!data));
  }, [user, raceId]);

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate("/login"); return; }
    setBusy(true);
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("race_id", raceId);
      setIsFav(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, race_id: raceId });
      setIsFav(true);
    }
    setBusy(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="favorite-btn"
      aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={isFav ? "#E3A23C" : "none"} stroke="#E3A23C" strokeWidth="1.8">
        <path d="M12 3l2.7 5.9 6.3.6-4.7 4.4 1.3 6.2L12 17l-5.6 3.1 1.3-6.2L3 9.5l6.3-.6L12 3z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
