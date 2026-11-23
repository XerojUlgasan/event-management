import { BRAND_LOGO_URL, brandLogoSize } from "../assets/brand";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <img
        className="brand-logo"
        src={BRAND_LOGO_URL}
        alt="Styled by AMAC"
        {...brandLogoSize}
      />
    </span>
  );
}
