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
          return {
            lat: parseFloat(n.getAttribute("lat")),
            lon: parseFloat(n.getAttribute("lon")),
            ele: eleEl ? parseFloat(eleEl.textContent) : null,
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

        resolve({
          points: downsample(points),
          distanceKm: Math.round((distanceM / 1000) * 10) / 10,
          elevationGain: Math.round(elevationGain),
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
            points.push({ lat, lon });
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

        resolve({
          points: downsample(points),
          distanceKm: Math.round((distanceM / 1000) * 10) / 10,
          elevationGain: Math.round(elevationGain),
        });
      });
    };
    reader.onerror = () => reject(new Error("Impossible de lire ce fichier."));
    reader.readAsArrayBuffer(file);
  });
}

export function parseTrackFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "fit") return parseFITFile(file);
  if (ext === "gpx") return parseGPXFile(file);
  return Promise.reject(new Error("Format non reconnu — utilise un fichier .gpx ou .fit."));
}
