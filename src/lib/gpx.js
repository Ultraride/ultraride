// Seuil au-delà duquel on considère que le vélo avance. En dessous, le temps
// est compté comme pause : à l'échelle d'un ultra, un arrêt ravito de 20 min
// et une heure de sommeil doivent sortir du temps de roulage.
const MOVING_THRESHOLD_KMH = 3;

// Au-delà de cette durée, un intervalle entre deux points est forcément un
// arrêt (montre éteinte, perte de signal prolongée), quelle que soit la
// distance apparente parcourue entre les deux.
const MAX_MOVING_GAP_S = 300;

// Shared by both GPX (XML) and FIT (binary) parsing.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function downsample(points, target = 300) {
  const stride = Math.max(1, Math.floor(points.length / target));
  return points.filter((_, i) => i % stride === 0).map((p) => ({ lat: p.lat, lon: p.lon }));
}

// Calcule le temps écoulé et le temps de roulage à partir des points bruts
// (avant sous-échantillonnage : sous-échantillonner d'abord fausserait les
// vitesses instantanées et donc la détection des arrêts).
function computeTimes(points) {
  const timed = points.filter((p) => p.time != null);
  if (timed.length < 2) return { totalSeconds: null, movingSeconds: null };

  const totalSeconds = Math.max(0, Math.round((timed[timed.length - 1].time - timed[0].time) / 1000));

  let movingSeconds = 0;
  for (let i = 1; i < timed.length; i++) {
    const dt = (timed[i].time - timed[i - 1].time) / 1000;
    if (dt <= 0 || dt > MAX_MOVING_GAP_S) continue;
    const meters = haversineMeters(timed[i - 1].lat, timed[i - 1].lon, timed[i].lat, timed[i].lon);
    const kmh = (meters / 1000) / (dt / 3600);
    if (kmh >= MOVING_THRESHOLD_KMH) movingSeconds += dt;
  }

  return { totalSeconds, movingSeconds: Math.round(movingSeconds) };
}

export function parseGPXFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(reader.result, "application/xml");
        if (doc.querySelector("parsererror")) {
          reject(new Error("Fichier GPX invalide."));
          return;
        }
        const nodes = [...doc.querySelectorAll("trkpt"), ...doc.querySelectorAll("rtept")];
        if (nodes.length === 0) {
          reject(new Error("Aucun point de trace trouvé dans ce fichier GPX."));
          return;
        }
        const points = nodes.map((n) => {
          const eleEl = n.querySelector("ele");
          const timeEl = n.querySelector("time");
          let time = null;
          if (timeEl) {
            const parsed = Date.parse(timeEl.textContent);
            if (!Number.isNaN(parsed)) time = parsed;
          }
          return {
            lat: parseFloat(n.getAttribute("lat")),
            lon: parseFloat(n.getAttribute("lon")),
            ele: eleEl ? parseFloat(eleEl.textContent) : null,
            time,
          };
        }).filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lon));

        let distanceM = 0;
        let elevationGain = 0;
        for (let i = 1; i < points.length; i++) {
          distanceM += haversineMeters(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
          if (points[i].ele != null && points[i - 1].ele != null) {
            const diff = points[i].ele - points[i - 1].ele;
            if (diff > 0) elevationGain += diff;
          }
        }

        const { totalSeconds, movingSeconds } = computeTimes(points);

        resolve({
          points: downsample(points),
          distanceKm: Math.round((distanceM / 1000) * 10) / 10,
          elevationGain: Math.round(elevationGain),
          totalSeconds,
          movingSeconds,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Impossible de lire ce fichier."));
    reader.readAsText(file);
  });
}

// FIT stores lat/lon in "semicircles" on some devices/exports and in plain
// degrees on others depending on the encoder — detect and convert safely.
function toDegrees(v) {
  if (v == null) return null;
  return Math.abs(v) > 180 ? v * (180 / 2147483648) : v;
}

export function parseFITFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      // Loaded lazily — most visitors never touch a .fit file, no reason to
      // ship this parser in the main bundle for everyone.
      const { default: FitParser } = await import("fit-file-parser");
      const fitParser = new FitParser({ mode: "list", lengthUnit: "m", speedUnit: "km/h" });
      fitParser.parse(reader.result, (error, data) => {
        if (error) {
          reject(new Error(typeof error === "string" ? error : "Fichier FIT invalide."));
          return;
        }
        const records = data.records || [];
        const points = [];
        let elevationGain = 0;
        let prevEle = null;
        let deviceDistance = null;

        for (const r of records) {
          const lat = toDegrees(r.position_lat);
          const lon = toDegrees(r.position_long);
          if (lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)) {
            let time = null;
            if (r.timestamp != null) {
              const parsed = r.timestamp instanceof Date ? r.timestamp.getTime() : Date.parse(r.timestamp);
              if (!Number.isNaN(parsed)) time = parsed;
            }
            points.push({ lat, lon, time });
          }
          const ele = r.altitude ?? r.enhanced_altitude;
          if (ele != null) {
            if (prevEle != null && ele > prevEle) elevationGain += ele - prevEle;
            prevEle = ele;
          }
          if (r.distance != null) deviceDistance = r.distance;
        }

        if (points.length === 0) {
          reject(new Error("Aucune position GPS trouvée dans ce fichier FIT (activité indoor sans GPS ?)."));
          return;
        }

        let distanceM = 0;
        for (let i = 1; i < points.length; i++) {
          distanceM += haversineMeters(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
        }
        // The device's own cumulative distance is usually more accurate
        // than a GPS-derived estimate — prefer it when present.
        if (deviceDistance != null && deviceDistance > 0) distanceM = deviceDistance;

        const { totalSeconds, movingSeconds } = computeTimes(points);

        resolve({
          points: downsample(points),
          distanceKm: Math.round((distanceM / 1000) * 10) / 10,
          elevationGain: Math.round(elevationGain),
          totalSeconds,
          movingSeconds,
        });
      });
    };
    reader.onerror = () => reject(new Error("Impossible de lire ce fichier."));
    reader.readAsArrayBuffer(file);
  });
}

// Seul le FIT est accepté à l'import : il garantit la présence des
// horodatages (donc des temps d'épreuve) et embarque la distance mesurée
// par l'appareil, plus fiable qu'une distance recalculée depuis les points
// GPS. parseGPXFile reste exportée si le besoin d'accepter le GPX revient.
export function parseTrackFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "fit") return parseFITFile(file);
  if (ext === "gpx") {
    return Promise.reject(
      new Error(
        "Les fichiers GPX ne sont pas acceptés. Exporte le fichier .fit d'origine depuis ton compteur ou ta montre."
      )
    );
  }
  return Promise.reject(new Error("Format non reconnu — utilise un fichier .fit."));
}

// "2 j 05h12" au-delà de 24 h, "14h07" en dessous, "48 min" sous l'heure.
export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days} j ${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}`;
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}`;
  return `${minutes} min`;
}
