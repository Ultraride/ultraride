import { priceTier, formatPrice } from "../lib/price";

// Échelle de quatre symboles dont seuls les premiers sont actifs : la
// position dans la fourchette se lit d'un coup d'œil, sans avoir à
// compter les euros affichés.
export default function PriceTag({ price, showAmount = false, className = "" }) {
  const tier = priceTier(price);
  if (!tier) return null;

  const amount = formatPrice(price);

  return (
    <span className={`price-tag ${className}`} title={amount ? `${amount} — ${tier.label}` : tier.label}>
      <span className="price-signs">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={n <= tier.signs ? "price-sign-on" : "price-sign-off"}>€</span>
        ))}
      </span>
      {showAmount && amount && <span className="price-amount">{amount}</span>}
    </span>
  );
}
