import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { when } from '../format';
import { can } from '../permissions';
import { useSession } from '../session';
import type { Customer, OperationsReport, Page, Site, WorkOrder } from '../types';

export function BoardPage() {
  const { token, principal } = useSession();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [report, setReport] = useState<OperationsReport | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');

  async function load(nextStatus = status) {
    const query = nextStatus ? `?status=${nextStatus}` : '';
    const page = await api<Page<WorkOrder>>(`/api/v1/work-orders${query}`, { token });
    setOrders(page.data);
    if (!principal || !can(principal.role, 'reports:read')) {
      return;
    }
    try {
      const from = new Date();
      from.setUTCDate(1);
      from.setUTCHours(0, 0, 0, 0);
      const to = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const summary = await api<{ data: OperationsReport }>(
        `/api/v1/reports/operations?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        { token },
      );
      setReport(summary.data);
    } catch {
      setReport(null);
    }
  }

  useEffect(() => {
    void load().catch((cause: unknown) => setError(errorMessage(cause)));
    if (principal && can(principal.role, 'customers:read') && can(principal.role, 'work_orders:write')) {
      void api<Page<Customer>>('/api/v1/customers', { token }).then((page) => setCustomers(page.data));
    }
  }, [token, principal]);

  useEffect(() => {
    if (!customerId) {
      setSites([]);
      setSiteId('');
      return;
    }
    void api<{ data: Site[] }>(`/api/v1/customers/${customerId}/sites`, { token }).then((body) => {
      setSites(body.data);
      setSiteId(body.data[0]?.id ?? '');
    });
  }, [customerId, token]);

  async function createJob(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/v1/work-orders', {
        method: 'POST',
        token,
        body: { customerId, siteId, title, description, priority },
      });
      setTitle('');
      setDescription('');
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  const openCount = report
    ? ['draft', 'scheduled', 'dispatched', 'in_progress', 'on_hold'].reduce((sum, key) => sum + (report.countsByStatus[key] ?? 0), 0)
    : orders.length;

  return (
    <section>
      <h2>Dispatch board</h2>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      {report ? (
        <div className="metrics">
          <div className="metric"><span>Open jobs</span><strong>{openCount}</strong></div>
          <div className="metric"><span>Overdue</span><strong>{report.openOverdue}</strong></div>
          <div className="metric"><span>Completed this window</span><strong>{report.completedInWindow}</strong></div>
        </div>
      ) : null}
      <div className="row">
        <label>
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              void load(event.target.value).catch((cause: unknown) => setError(errorMessage(cause)));
            }}
          >
            <option value="">All open and closed</option>
            {['draft', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'cancelled'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="tickets">
        {orders.length === 0 ? <p className="empty">No work orders match this filter.</p> : null}
        {orders.map((order) => (
          <Link className="ticket" key={order.id} to={`/work-orders/${order.id}`}>
            <strong>{order.number}</strong>
            <span>
              {order.title}
              <br />
              <small>SLA {when(order.slaDueAt)}</small>
            </span>
            <span>
              <span className={`pill ${order.priority}`}>{order.priority}</span>{' '}
              <span className={`pill ${order.status}`}>{order.status.replaceAll('_', ' ')}</span>
            </span>
          </Link>
        ))}
      </div>
      {principal && can(principal.role, 'work_orders:write') ? (
        <form className="panel stack" onSubmit={(event) => void createJob(event)}>
          <h2>New job</h2>
          <div className="grid-2">
            <label>
              Customer
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
                <option value="">Choose</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label>
              Site
              <select value={siteId} onChange={(event) => setSiteId(event.target.value)} required>
                <option value="">Choose</option>
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </label>
          </div>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label>What needs doing<textarea value={description} onChange={(event) => setDescription(event.target.value)} required /></label>
          <label>
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <button className="primary" type="submit">Create job</button>
        </form>
      ) : null}
    </section>
  );
}
