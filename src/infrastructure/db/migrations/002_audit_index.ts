export const migration002 = `
CREATE INDEX idx_audit_lookup ON audit_entries (organization_id, created_at DESC);
CREATE INDEX idx_invoices_org_status ON invoices (organization_id, status, created_at);
`;
