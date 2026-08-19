export default function Rules() {
  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 640 }}>
      <h1 className="h1">Règles de la communauté</h1>
      <div className="prose" style={{ color: "var(--paperDim)", lineHeight: 1.7, fontSize: 14 }}>
        <p>UltraRide est un répertoire construit par et pour la communauté de l'ultra-distance à vélo. Pour que les avis et échanges restent utiles à tous, merci de respecter ces quelques règles simples :</p>
        <ul>
          <li>Reste factuel et respectueux dans tes avis, même en cas de désaccord avec un organisateur ou un autre participant.</li>
          <li>Pas de propos injurieux, discriminatoires, diffamatoires ou harcelants.</li>
          <li>Pas de spam, de publicité non sollicitée ni de contenu hors sujet.</li>
          <li>Ne publie pas d'informations personnelles concernant un tiers sans son accord.</li>
          <li>Un avis doit refléter une expérience réelle et sincère.</li>
        </ul>
        <p>Un commentaire qui enfreint ces règles peut être masqué ou supprimé par un administrateur. En cas de manquement répété, un compte peut voir ses droits de publication restreints.</p>
        <p className="muted" style={{ fontSize: 12 }}>
          Cette charte est une base de bon sens pour l'usage du site et n'a pas vocation à constituer un texte juridique complet (CGU).
        </p>
      </div>
    </div>
  );
}
