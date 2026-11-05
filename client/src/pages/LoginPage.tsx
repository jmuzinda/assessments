import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { useSession } from '../session';

export function LoginPage() {
  const session = useSession();
  const [email, setEmail] = useState('avery@northwind.test');
  const [password, setPassword] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (session.token && session.principal) {
    return <Navigate to="/" replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const body: { email: string; password: string; organizationSlug?: string } = { email, password };
      if (organizationSlug.trim()) {
        body.organizationSlug = organizationSlug.trim();
      }
      const result = await api<{ data: { token: string } }>('/api/v1/auth/login', { method: 'POST', body });
      session.login(result.data.token);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-screen">
      <section className="auth-panel">
        <div className="wordmark">Helio</div>
        <h1>Sign in</h1>
        <p className="lede">Open the dispatch board for your organization.</p>
        <form className="stack" onSubmit={(event) => void submit(event)}>
          {error ? <p className="banner" role="alert">{error}</p> : null}
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label>Organization slug<input value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value)} placeholder="Optional when the email belongs to one org" /></label>
          <button className="primary" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p>New company? <Link to="/register">Open an organization</Link></p>
      </section>
      <aside className="auth-aside">
        <h2>From the call to the invoice.</h2>
        <p>Schedule the visit, send a technician, consume the part, and collect payment without leaving the job.</p>
      </aside>
    </div>
  );
}
