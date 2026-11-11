import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { money, toIso, when } from '../format';
import { can } from '../permissions';
import { useSession } from '../session';
import type { Part, StockLocation, Technician, WorkOrder } from '../types';

interface TechnicianSuggestion {
  technicianId: string;
  name: string;
  score: number;
  skillMatch: number;
  openAssignments: number;
}

export function WorkOrderPage() {
  const { id = '' } = useParams();
  const { token, principal } = useSession();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [reason, setReason] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [partId, setPartId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [suggestions, setSuggestions] = useState<TechnicianSuggestion[] | null>(null);

  async function load() {
    const body = await api<{ data: WorkOrder }>(`/api/v1/work-orders/${id}`, { token });
    setOrder(body.data);
    if (principal && can(principal.role, 'work_orders:dispatch')) {
      const crew = await api<{ data: Technician[] }>('/api/v1/technicians', { token });
      setTechnicians(crew.data.filter((person) => person.active));
    }
    if (principal && can(principal.role, 'inventory:read') && body.data.status === 'in_progress') {
      const [partBody, locationBody] = await Promise.all([
        api<{ data: Part[] }>('/api/v1/parts', { token }),
        api<{ data: StockLocation[] }>('/api/v1/locations', { token }),
      ]);
      setParts(partBody.data);
      setLocations(locationBody.data);
    }
  }

  useEffect(() => {
    void load().catch((cause: unknown) => setError(errorMessage(cause)));
  }, [id, token, principal]);

  async function suggest() {
    setError('');
    try {
      const body = await api<{ data: TechnicianSuggestion[] }>(`/api/v1/work-orders/${id}/suggestions`, { token });
      setSuggestions(body.data);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function run(path: string, body: unknown) {
    setError('');
    try {
      await api(path, { method: 'POST', token, body });
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  if (!order || !principal) {
    return <p>{error || 'Loading the job…'}</p>;
  }

  const version = { expectedVersion: order.version };
  const dispatch = can(principal.role, 'work_orders:dispatch');
  const execute = can(principal.role, 'work_orders:execute');
  const billing = can(principal.role, 'billing:write');

  return (
    <section className="split">
      <div className="stack">
        <p className="muted">{order.number}</p>
        <h2>{order.title}</h2>
        <p>{order.description}</p>
        <p>
          <span className={`pill ${order.status}`}>{order.status.replaceAll('_', ' ')}</span>{' '}
          <span className={`pill ${order.priority}`}>{order.priority}</span>
        </p>
        <p className="muted">SLA {when(order.slaDueAt)} · version {order.version}</p>
        {order.scheduledStart ? <p>Window {when(order.scheduledStart)} – {when(order.scheduledEnd)}</p> : null}
        {error ? <p className="banner" role="alert">{error}</p> : null}
        <div className="panel">
          <h2>Notes</h2>
          {order.notes.length === 0 ? <p className="empty">No notes yet.</p> : null}
          {order.notes.map((item) => <p key={item.id}>{item.body}</p>)}
          {can(principal.role, 'work_orders:write') || can(principal.role, 'work_orders:execute') ? (
            <form className="stack" onSubmit={(event) => {
              event.preventDefault();
              void run(`/api/v1/work-orders/${order.id}/notes`, { body: note }).then(() => setNote(''));
            }}>
              <label>Add a note<textarea value={note} onChange={(event) => setNote(event.target.value)} required /></label>
              <button className="quiet" type="submit">Save note</button>
            </form>
          ) : null}
        </div>
        {order.timeEntries.length > 0 ? (
          <div className="panel">
            <h2>Time</h2>
            {order.timeEntries.map((entry) => (
              <p key={entry.id}>{entry.minutes} min · {entry.notes || 'No note'}</p>
            ))}
          </div>
        ) : null}
        {order.partUsages.length > 0 ? (
          <div className="panel">
            <h2>Parts used</h2>
            {order.partUsages.map((usage) => (
              <p key={usage.id}>{usage.quantity} × {money(usage.unitPriceCents)}</p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="stack">
        {dispatch && order.status === 'draft' ? (
          <form className="panel stack" onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(`/api/v1/work-orders/${order.id}/schedule`, {
              ...version,
              scheduledStart: toIso(start),
              scheduledEnd: toIso(end),
            });
          }}>
            <h2>Schedule</h2>
            <label>Start<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label>
            <label>End<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required /></label>
            <button className="primary" type="submit">Save window</button>
          </form>
        ) : null}
        {dispatch && order.status === 'scheduled' ? (
          <form className="panel stack" onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(`/api/v1/work-orders/${order.id}/dispatch`, { ...version, technicianId });
          }}>
            <h2>Dispatch</h2>
            <label>
              Technician
              <select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)} required>
                <option value="">Choose</option>
                {technicians.map((person) => (
                  <option key={person.id} value={person.id}>{person.name} · {money(person.hourlyRateCents)}/hr</option>
                ))}
              </select>
            </label>
            <button className="primary" type="submit">Assign</button>
            <button className="quiet" type="button" onClick={() => void suggest()}>Suggest technicians</button>
            {suggestions ? (
              suggestions.length === 0 ? (
                <p>No technicians are available for this window.</p>
              ) : (
                suggestions.map((person) => (
                  <p key={person.technicianId}>
                    {person.name} · score {person.score} · skill match {person.skillMatch} · open assignments {person.openAssignments}{' '}
                    <button className="quiet" type="button" onClick={() => setTechnicianId(person.technicianId)}>
                      Use {person.name}
                    </button>
                  </p>
                ))
              )
            ) : null}
          </form>
        ) : null}
        {execute && order.status === 'dispatched' ? (
          <button className="primary" type="button" onClick={() => void run(`/api/v1/work-orders/${order.id}/start`, version)}>Start job</button>
        ) : null}
        {execute && order.status === 'in_progress' ? (
          <>
            <form className="panel stack" onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void run(`/api/v1/work-orders/${order.id}/hold`, { ...version, reason });
            }}>
              <label>Hold reason<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
              <button className="quiet" type="submit">Put on hold</button>
            </form>
            <button className="primary" type="button" onClick={() => void run(`/api/v1/work-orders/${order.id}/complete`, version)}>Complete</button>
            <form className="panel stack" onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void run(`/api/v1/work-orders/${order.id}/time-entries`, {
                startedAt: toIso(timeStart),
                endedAt: toIso(timeEnd),
                notes: '',
              });
            }}>
              <h2>Log time</h2>
              <label>Started<input type="datetime-local" value={timeStart} onChange={(event) => setTimeStart(event.target.value)} required /></label>
              <label>Ended<input type="datetime-local" value={timeEnd} onChange={(event) => setTimeEnd(event.target.value)} required /></label>
              <button className="quiet" type="submit">Add time</button>
            </form>
            <form className="panel stack" onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void run(`/api/v1/work-orders/${order.id}/parts`, {
                partId,
                locationId,
                quantity: Number(quantity),
              });
            }}>
              <h2>Use a part</h2>
              <label>
                Part
                <select value={partId} onChange={(event) => setPartId(event.target.value)} required>
                  <option value="">Choose</option>
                  {parts.map((part) => <option key={part.id} value={part.id}>{part.sku}</option>)}
                </select>
              </label>
              <label>
                Location
                <select value={locationId} onChange={(event) => setLocationId(event.target.value)} required>
                  <option value="">Choose</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </label>
              <label>Quantity<input value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
              <button className="quiet" type="submit">Consume</button>
            </form>
          </>
        ) : null}
        {execute && order.status === 'on_hold' ? (
          <button className="primary" type="button" onClick={() => void run(`/api/v1/work-orders/${order.id}/resume`, version)}>Resume</button>
        ) : null}
        {dispatch && !['completed', 'cancelled'].includes(order.status) ? (
          <form className="panel stack" onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(`/api/v1/work-orders/${order.id}/cancel`, { ...version, reason });
          }}>
            <label>Cancel reason<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
            <button className="quiet" type="submit">Cancel job</button>
          </form>
        ) : null}
        {billing && order.status === 'completed' ? (
          <button className="primary" type="button" onClick={() => void run(`/api/v1/work-orders/${order.id}/invoice`, {})}>Create invoice</button>
        ) : null}
      </div>
    </section>
  );
}
