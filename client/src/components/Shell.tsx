import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { can } from '../permissions';
import { useSession } from '../session';

export function Shell() {
  const session = useSession();
  if (!session.ready) {
    return <p className="shell-main">Checking the session…</p>;
  }
  if (!session.token || !session.principal) {
    return <Navigate to="/login" replace />;
  }
  const role = session.principal.role;
  return (
    <div className="shell">
      <aside className="shell-nav">
        <strong>Helio</strong>
        <nav>
          {can(role, 'work_orders:read') ? <NavLink to="/" end>Board</NavLink> : null}
          {can(role, 'customers:read') ? <NavLink to="/customers">Customers</NavLink> : null}
          {can(role, 'inventory:read') ? <NavLink to="/inventory">Inventory</NavLink> : null}
          {can(role, 'billing:read') ? <NavLink to="/invoices">Invoices</NavLink> : null}
        </nav>
        <div className="identity">
          <div>{session.principal.name}</div>
          <div>{role}</div>
          <button type="button" onClick={session.logout}>Sign out</button>
        </div>
      </aside>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}

export function Missing() {
  return (
    <section>
      <h2>This page is not on the board</h2>
      <p className="lede">The route does not match a screen in this console.</p>
      <Link to="/">Back to the board</Link>
    </section>
  );
}
