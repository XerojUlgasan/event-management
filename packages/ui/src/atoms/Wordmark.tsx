export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <a className="cl-wordmark" href={href} aria-label="Clemora home">
      Clemora
    </a>
  );
}
