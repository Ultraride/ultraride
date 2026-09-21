// Europe + North Africa countries for the race form country dropdown,
// plus a few non-EMEA countries where listed races take place.
export const EMEA_COUNTRIES = [
  // Amérique du Nord
  "Canada",
  // Amérique du Sud
  "Brésil",
  "Pérou",
  // Afrique subsaharienne
  "Ouganda",
  // Europe
  "Albanie","Allemagne","Andorre","Autriche","Belgique","Biélorussie","Bosnie-Herzégovine",
  "Bulgarie","Chypre","Croatie","Danemark","Espagne","Estonie","Finlande","France",
  "Géorgie","Grèce","Hongrie","Irlande","Islande","Italie","Kosovo","Lettonie",
  "Liechtenstein","Lituanie","Luxembourg","Macédoine du Nord","Malte","Moldavie",
  "Monaco","Monténégro","Norvège","Pays-Bas","Pologne","Portugal","République tchèque",
  "Roumanie","Royaume-Uni","Russie","Saint-Marin","Serbie","Slovaquie","Slovénie",
  "Suède","Suisse","Turquie","Ukraine","Vatican",
  // North Africa
  "Algérie","Égypte","Libye","Maroc","Mauritanie","Tunisie",
];

const COUNTRY_TO_ISO = {
  "Canada": "CA",
  "Brésil": "BR",
  "Pérou": "PE",
  "Ouganda": "UG",
  "Albanie": "AL",
  "Allemagne": "DE",
  "Andorre": "AD",
  "Autriche": "AT",
  "Belgique": "BE",
  "Biélorussie": "BY",
  "Bosnie-Herzégovine": "BA",
  "Bulgarie": "BG",
  "Chypre": "CY",
  "Croatie": "HR",
  "Danemark": "DK",
  "Espagne": "ES",
  "Estonie": "EE",
  "Finlande": "FI",
  "France": "FR",
  "Géorgie": "GE",
  "Grèce": "GR",
  "Hongrie": "HU",
  "Irlande": "IE",
  "Islande": "IS",
  "Italie": "IT",
  "Kosovo": "XK",
  "Lettonie": "LV",
  "Liechtenstein": "LI",
  "Lituanie": "LT",
  "Luxembourg": "LU",
  "Macédoine du Nord": "MK",
  "Malte": "MT",
  "Moldavie": "MD",
  "Monaco": "MC",
  "Monténégro": "ME",
  "Norvège": "NO",
  "Pays-Bas": "NL",
  "Pologne": "PL",
  "Portugal": "PT",
  "République tchèque": "CZ",
  "Roumanie": "RO",
  "Royaume-Uni": "GB",
  "Russie": "RU",
  "Saint-Marin": "SM",
  "Serbie": "RS",
  "Slovaquie": "SK",
  "Slovénie": "SI",
  "Suède": "SE",
  "Suisse": "CH",
  "Turquie": "TR",
  "Ukraine": "UA",
  "Vatican": "VA",
  "Algérie": "DZ",
  "Égypte": "EG",
  "Libye": "LY",
  "Maroc": "MA",
  "Mauritanie": "MR",
  "Tunisie": "TN",
};

export function getFlagEmoji(countryName) {
  const iso = COUNTRY_TO_ISO[countryName];
  if (!iso) return null;
  return String.fromCodePoint(...[...iso].map((c) => 127397 + c.charCodeAt(0)));
}

export const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

export const NEXT_EDITION_YEARS = ["2026","2027","2028","2029","2030"];
