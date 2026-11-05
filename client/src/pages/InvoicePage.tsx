import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { money } from '../format';
import { can } from '../permissions';
import { useSession } from '../session';
import type { Invoice } from '../types';

export function InvoicePage() {
  const { id = '' } = useParams();
  const { token, principal } = useSession();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('card');
  const [reference, setReference] = useState('');
  const writable = principal ? can(principal.role, 'billing:write') : false;

  async function load() {
    const body = await api<{ data: Invoice }>(`/api/v1/invoices/${id}`, { token });
    setInvoice(body.data);
    const balance = body.data.totalCents - body.data.amountPaidCents;
    setAmount(String(balance > 0 ? balance : ''));
  }

  useEffect(() => {
    void load().catch((cause: unknown) => setError(errorMessage(cause)));
  }, [id, token]);

  async function act(path: string, body?: unknown) {
    setError('');
    try {
      await api(path, { method: 'POST', token, body: body ?? {} });
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  if (!invoice) {
    return <p>{error || 'Loading the invoice…'}</p>;
  }

  const balance = invoice.totalCents - invoice.amountPaidCents;

  return (
    <section className="split">
      <div className="stack">
        <p className="muted">{invoice.number}</p>
        <h2>{money(invoice.totalCents)}</h2>
        <p><span className={`pill ${invoice.status}`}>{invoice.status}</span></p>
        {error ? <p className="banner" role="alert">{error}</p> : null}
        <div className="panel">
          <table>
            <thead><tr><th>Line</th><th>Qty</th><th>Amount</th></tr></thead>
            <tbody>
              {(invoice.lines ?? []).map((line) => (
                <tr key={line.id}>
                  <td>{line.description}</td>
                  <td>{line.quantity}</td>
                  <td>{money(line.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Tax {money(invoice.taxCents)} · paid {money(invoice.amountPaidCents)} · balance {money(balance)}</p>
        </div>
        {(invoice.payments ?? []).length > 0 ? (
          <div className="panel">
            <h2>Payments</h2>
            {invoice.payments?.map((payment) => (
              <p key={payment.id}>{money(payment.amountCents)} · {payment.method} · {payment.reference}</p>
            ))}
          </div>
        ) : null}
      </div>
      {writable ? (
        <div className="stack">
          {invoice.status === 'draft' ? (
            <button className="primary" type="button" onClick={() => void act(`/api/v1/invoices/${invoice.id}/issue`)}>Issue invoice</button>
          ) : null}
          {invoice.status === 'draft' ? (
            <button className="quiet" type="button" onClick={() => void act(`/api/v1/invoices/${invoice.id}/void`)}>Void draft</button>
          ) : null}
          {invoice.status === 'issued' || invoice.status === 'partial' ? (
            <form className="panel stack" onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void act(`/api/v1/invoices/${invoice.id}/payments`, {
                amountCents: Number(amount),
                method,
                reference,
              });
            }}>
              <h2>Record payment</h2>
              <label>Amount cents<input value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
              <label>
                Method
                <select value={method} onChange={(event) => setMethod(event.target.value)}>
                  <option value="card">Card</option>
                  <option value="ach">ACH</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                </select>
              </label>
              <label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} required /></label>
              <button className="primary" type="submit">Apply payment</button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
