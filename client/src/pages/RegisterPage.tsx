import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { useSession } from '../session';

export function RegisterPage() {
  const session = useSession();
  const [organizationName, setOrganizationName] = useState('');
  const [plan, setPlan] = useState('professional');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const result = await api<{ data: { token: string } }>('/api/v1/auth/register', {
        method: 'POST',
        body: { organizationName, plan, name, email, password },
      });
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
        <h1>Open an organization</h1>
        <p className="lede">You become the owner. Password needs a letter and a number, at least 10 characters.</p>
        <form className="stack" onSubmit={(event) => void submit(event)}>
          {error ? <p className="banner" role="alert">{error}</p> : null}
          <label>Organization<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required /></label>
          <label>
            Plan
            <select value={plan} onChange={(event) => setPlan(event.target.value)}>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>
          <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="primary" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create organization'}</button>
        </form>
        <p>Already registered? <Link to="/login">Sign in</Link></p>
      </section>
      <aside className="auth-aside">
        <h2>One company, many roles.</h2>
        <p>Dispatchers schedule. Technicians work the job in front of them. Billing collects. Viewers can look and not change anything.</p>
      </aside>
    </div>
  );
}
