import { FormEvent, useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { money } from '../format';
import { can } from '../permissions';
import { useSession } from '../session';
import type { Part, StockLevel, StockLocation } from '../types';

export function InventoryPage() {
  const { token, principal } = useSession();
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [error, setError] = useState('');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('0');
  const [price, setPrice] = useState('0');
  const [reorderPoint, setReorderPoint] = useState('0');
  const [locationName, setLocationName] = useState('');
  const [kind, setKind] = useState('warehouse');
  const [partId, setPartId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const writable = principal ? can(principal.role, 'inventory:write') : false;

  async function load() {
    const [partBody, locationBody, levelBody] = await Promise.all([
      api<{ data: Part[] }>('/api/v1/parts', { token }),
      api<{ data: StockLocation[] }>('/api/v1/locations', { token }),
      api<{ data: StockLevel[] }>('/api/v1/stock', { token }),
    ]);
    setParts(partBody.data);
    setLocations(locationBody.data);
    setLevels(levelBody.data);
  }

  useEffect(() => {
    void load().catch((cause: unknown) => setError(errorMessage(cause)));
  }, [token]);

  async function createPart(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/v1/parts', {
        method: 'POST',
        token,
        body: {
          sku,
          name,
          unitCostCents: Number(cost),
          unitPriceCents: Number(price),
          reorderPoint: Number(reorderPoint),
        },
      });
      setSku('');
      setName('');
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function createLocation(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/v1/locations', { method: 'POST', token, body: { name: locationName, kind } });
      setLocationName('');
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function receive(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/v1/stock/receive', {
        method: 'POST',
        token,
        body: { partId, locationId, quantity: Number(quantity) },
      });
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <section className="stack">
      <h2>Parts</h2>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      <div className="panel">
        <table>
          <thead>
            <tr><th>SKU</th><th>Name</th><th>Cost</th><th>Reorder</th></tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr key={part.id}>
                <td>{part.sku}</td>
                <td>{part.name}</td>
                <td>{money(part.unitCostCents)}</td>
                <td>{part.reorderPoint}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {parts.length === 0 ? <p className="empty">No parts yet.</p> : null}
      </div>
      <div className="panel">
        <h2>On hand</h2>
        <table>
          <thead>
            <tr><th>SKU</th><th>Location</th><th>On hand</th><th>Reserved</th><th>Available</th></tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <tr key={`${level.partId}-${level.locationId}`}>
                <td>{level.sku}</td>
                <td>{level.locationName}</td>
                <td>{level.onHand}</td>
                <td>{level.reserved}</td>
                <td>{level.onHand - level.reserved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {writable ? (
        <div className="grid-2">
          <form className="panel stack" onSubmit={(event) => void createPart(event)}>
            <h2>New part</h2>
            <label>SKU<input value={sku} onChange={(event) => setSku(event.target.value)} required /></label>
            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Cost cents<input value={cost} onChange={(event) => setCost(event.target.value)} required /></label>
            <label>Price cents<input value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
            <label>Reorder point<input value={reorderPoint} onChange={(event) => setReorderPoint(event.target.value)} required /></label>
            <button className="primary" type="submit">Save part</button>
          </form>
          <form className="panel stack" onSubmit={(event) => void createLocation(event)}>
            <h2>New location</h2>
            <label>Name<input value={locationName} onChange={(event) => setLocationName(event.target.value)} required /></label>
            <label>
              Kind
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="warehouse">Warehouse</option>
                <option value="van">Van</option>
              </select>
            </label>
            <button className="quiet" type="submit">Save location</button>
          </form>
          <form className="panel stack" onSubmit={(event) => void receive(event)}>
            <h2>Receive stock</h2>
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
            <button className="primary" type="submit">Receive</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
