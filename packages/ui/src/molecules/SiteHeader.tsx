import { Wordmark } from "../atoms/Wordmark";

export type SiteLink = { label: string; href: string };

export function SiteHeader({ links }: { links: SiteLink[] }) {
  return (
    <header className="amac-site-header">
      <Wordmark />
      <nav className="amac-site-header__nav" aria-label="Main navigation">
        {links.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <details className="amac-site-header__mobile">
        <summary aria-label="Open navigation">
          <span></span>
          <span></span>
        </summary>
        <nav aria-label="Mobile navigation">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </details>
    </header>
  );
}
