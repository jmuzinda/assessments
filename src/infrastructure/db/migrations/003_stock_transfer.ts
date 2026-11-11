export const migration003 = `
CREATE TABLE stock_movements_next (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  part_id TEXT NOT NULL REFERENCES parts(id),
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  type TEXT NOT NULL CHECK (type IN ('receive', 'adjust', 'reserve', 'release', 'consume', 'transfer')),
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

INSERT INTO stock_movements_next (
  id, organization_id, part_id, location_id, type, quantity, reference_type, reference_id, created_by, created_at
)
SELECT
  id, organization_id, part_id, location_id, type, quantity, reference_type, reference_id, created_by, created_at
FROM stock_movements;

DROP TABLE stock_movements;

ALTER TABLE stock_movements_next RENAME TO stock_movements;
`;
