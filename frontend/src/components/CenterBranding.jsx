export default function CenterBranding() {
  return (
    <div className="branding fade-in-branding">
      <h1 className="branding__title">Golden Era</h1>
      <p className="branding__subtitle">redefined by Canopus</p>

      <div className="branding__ornament" aria-hidden="true">
        <span className="branding__ornament-line" />
        <span className="branding__ornament-diamond" />
        <span className="branding__ornament-line" />
      </div>

      <p className="branding__tagline">Radio &nbsp;•&nbsp; Records &nbsp;•&nbsp; Listen</p>
    </div>
  );
}
