import Link from "next/link";

export interface Crumb {
  href: string;
  label: string;
}

/**
 * Fil d'Ariane : <nav> nommée, liste ordonnée, page courante marquée par
 * aria-current="page" (et restée un lien). Les séparateurs sont générés en
 * CSS (.breadcrumbs dans globals.css), hors de l'arbre d'accessibilité.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="breadcrumbs">
      <ol>
        {items.map((item, index) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={index === items.length - 1 ? "page" : undefined}>
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
