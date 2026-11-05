import { FormEvent, useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { can } from '../permissions';
import { useSession } from '../session';
import type { Customer, Page, Site } from '../types';

export function CustomersPage() {
  const { token, principal } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [siteName, setSiteName] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const writable = principal ? can(principal.role, 'customers:write') : false;

  async function load() {
    const page = await api<Page<Customer>>('/api/v1/customers', { token });
    setCustomers(page.data);
  }

  useEffect(() => {
    void load().catch((cause: unknown) => setError(errorMessage(cause)));
  }, [token]);

  async function openCustomer(customer: Customer) {
    setSelected(customer);
    const body = await api<{ data: Site[] }>(`/api/v1/customers/${customer.id}/sites`, { token });
    setSites(body.data);
  }

  async function createCustomer(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/v1/customers', {
        method: 'POST',
        token,
        body: { name, email: email || null, phone: null },
      });
      setName('');
      setEmail('');
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function createSite(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      return;
    }
    setError('');
    try {
      await api(`/api/v1/customers/${selected.id}/sites`, {
        method: 'POST',
        token,
        body: { name: siteName, line1, city, region, postalCode, country: 'US', timezone: 'America/New_York' },
      });
      setSiteName('');
      setLine1('');
      setCity('');
      setRegion('');
      setPostalCode('');
      await openCustomer(selected);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <section className="split">
      <div>
        <h2>Customers</h2>
        {error ? <p className="banner" role="alert">{error}</p> : null}
        <div className="tickets">
          {customers.length === 0 ? <p className="empty">No customers yet.</p> : null}
          {customers.map((customer) => (
            <button className="ticket" key={customer.id} type="button" onClick={() => void openCustomer(customer)}>
              <strong>{customer.name}</strong>
              <span>{customer.email ?? 'No email'}</span>
              <span className="muted">{customer.phone ?? ''}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="stack">
        {writable ? (
          <form className="panel stack" onSubmit={(event) => void createCustomer(event)}>
            <h2>Add customer</h2>
            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <button className="primary" type="submit">Save customer</button>
          </form>
        ) : null}
        {selected ? (
          <div className="panel stack">
            <h2>{selected.name}</h2>
            {sites.length === 0 ? <p className="empty">No sites yet.</p> : null}
            {sites.map((site) => (
              <p key={site.id}>{site.name}<br /><span className="muted">{site.address.line1}, {site.address.city}</span></p>
            ))}
            {writable ? (
              <form className="stack" onSubmit={(event) => void createSite(event)}>
                <label>Site name<input value={siteName} onChange={(event) => setSiteName(event.target.value)} required /></label>
                <label>Street<input value={line1} onChange={(event) => setLine1(event.target.value)} required /></label>
                <label>City<input value={city} onChange={(event) => setCity(event.target.value)} required /></label>
                <label>Region<input value={region} onChange={(event) => setRegion(event.target.value)} required /></label>
                <label>Postal code<input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} required /></label>
                <button className="quiet" type="submit">Add site</button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
