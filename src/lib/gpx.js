// Client-side GPX parsing: extract track points, compute distance (km) and
// elevation gain (m) via the haversine formula, and downsample the track so
// it stores compactly as jsonb (~300 points is plenty for a preview map).

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
          reject(new Error("Aucun point de trace trouvé dans ce fichier."));
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

        // downsample to ~300 points for compact storage
        const target = 300;
        const stride = Math.max(1, Math.floor(points.length / target));
        const downsampled = points.filter((_, i) => i % stride === 0).map((p) => ({ lat: p.lat, lon: p.lon }));

        resolve({
          points: downsampled,
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
