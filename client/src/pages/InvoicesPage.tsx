import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { money, when } from '../format';
import { useSession } from '../session';
import type { Invoice, Page } from '../types';

export function InvoicesPage() {
  const { token } = useSession();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void api<Page<Invoice>>('/api/v1/invoices', { token })
      .then((page) => setInvoices(page.data))
      .catch((cause: unknown) => setError(errorMessage(cause)));
  }, [token]);

  return (
    <section>
      <h2>Invoices</h2>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      <div className="tickets">
        {invoices.length === 0 ? <p className="empty">No invoices yet. Complete a job, then create the invoice from the job.</p> : null}
        {invoices.map((invoice) => (
          <Link className="ticket" key={invoice.id} to={`/invoices/${invoice.id}`}>
            <strong>{invoice.number}</strong>
            <span>{money(invoice.totalCents)} · paid {money(invoice.amountPaidCents)}</span>
            <span>
              <span className={`pill ${invoice.status}`}>{invoice.status}</span>
              <br />
              <small>Due {when(invoice.dueAt)}</small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
