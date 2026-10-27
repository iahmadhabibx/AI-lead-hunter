import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="shell">
      <header className="site-header">
        <div className="brand">ForgePath</div>
        <nav className="nav" aria-label="Primary">
          <Link className="btn btn-secondary" href="/login">
            Sign in
          </Link>
          <Link className="btn btn-primary" href="/register">
            Create account
          </Link>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="brand" style={{ fontSize: '1rem', opacity: 0.85 }}>
          ForgePath
        </div>
        <h1 id="hero-title">Find roles that fit the evidence on your CV.</h1>
        <p>
          Upload your CV, review a structured profile, and match against permitted
          job sources with explanations — not invented hiring odds.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/register">
            Start free
          </Link>
          <Link className="btn btn-secondary" href="/login">
            I already have an account
          </Link>
        </div>
      </section>
    </main>
  );
}
