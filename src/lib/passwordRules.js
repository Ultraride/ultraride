// Doit rester aligné sur Supabase > Authentication > Policies (longueur
// minimale, caractères requis, vérification des fuites).
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_HINT = "12 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre";

// Traduit les refus de mot de passe renvoyés par Supabase ; les autres
// erreurs sont rendues telles quelles.
export function passwordErrorMessage(error) {
  if (!error) return null;
  const msg = error.message || "";
  const reasons = error.reasons || [];
  // Le refus « fuite » arrive avec reasons: ["pwned"] et le message
  // « Password is known to be weak and easy to guess… ».
  if (reasons.includes("pwned") || /pwned|leaked|known to be weak/i.test(msg)) {
    return "Ce mot de passe figure dans des fuites de données connues. Choisis-en un autre.";
  }
  if (
    error.code === "weak_password" ||
    /weak_password|Password should be at least|Password should contain/i.test(msg)
  ) {
    return "Mot de passe trop faible : 12 caractères minimum, avec majuscule, minuscule et chiffre.";
  }
  return msg;
}
