import { BRAND_LOGO_URL, brandLogoSize } from "../assets/brand";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <a
      className="brand amac-wordmark"
      href={href}
      aria-label="Styled by AMAC home"
    >
      <img
        className="brand-logo"
        src={BRAND_LOGO_URL}
        alt="Styled by AMAC"
        {...brandLogoSize}
      />
    </a>
  );
}
