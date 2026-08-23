import RaceCard from "./RaceCard";

// Course fictive utilisée uniquement pour illustrer la lecture d'une fiche
// dans le bloc pédagogique de l'accueil — jamais sauvée en base.
const DEMO_RACE = {
  id: "demo-badlands",
  name: "Badlands",
  country: "Espagne",
  discipline: "Gravel",
  km: 800,
  dplus: 16000,
  month: "Août",
  open: true,
  format: "aventure",
  parcours: "point",
  mode: "Autonomie",
};

// Les pastilles 1 à 5 ne sont pas positionnées ici : elles sont ancrées en
// CSS (::after) directement sur les vrais éléments de la RaceCard, ciblés
// par leurs classes réelles et scopés à .htr-demo — voir index.css. Ça
// évite des coordonnées pixel figées qui se désynchronisent dès que la
// carte réelle change de mise en page, sans avoir à toucher RaceCard.jsx.
const LEGEND = [
  { n: 1, title: "Statut d'inscription", desc: "Vert = ouvertes, gris = fermées. Visible sans ouvrir la fiche." },
  { n: 2, title: "Discipline", desc: "Gravel, Route ou VTT — le type de vélo attendu." },
  { n: 3, title: "Pays et mois", desc: "Où et quand a lieu le départ." },
  { n: 4, title: "Distance", desc: "Longueur totale du parcours, en kilomètres." },
  { n: 5, title: "Dénivelé positif (D+)", desc: "Cumul de montée sur tout le parcours." },
];

export default function HowToReadCard() {
  return (
    <section className="htr-section">
      <div className="eyebrow">Comment lire une fiche course</div>
      <h2 className="carousel-title" style={{ marginBottom: 16 }}>
        Décrypte les infos en un coup d'œil
      </h2>

      <div className="htr-grid">
        <div className="htr-demo">
          <RaceCard race={DEMO_RACE} />
          {/* Capte le clic avant la carte : cette fiche est un exemple, pas un lien réel. */}
          <div className="htr-demo-overlay" onClick={(e) => e.preventDefault()} />
        </div>

        <div className="htr-legend">
          {LEGEND.map((item) => (
            <div className="htr-legend-item" key={item.n}>
              <span className="htr-legend-num">{item.n}</span>
              <div>
                <div className="htr-legend-title">{item.title}</div>
                <div className="htr-legend-desc">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
