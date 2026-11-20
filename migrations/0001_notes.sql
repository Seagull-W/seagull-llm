CREATE TABLE notebook_entries (
  document TEXT NOT NULL,
  id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  revision TEXT NOT NULL,
  published INTEGER NOT NULL CHECK (published IN (0, 1)),
  payload TEXT NOT NULL,
  PRIMARY KEY (document, id),
  UNIQUE (document, sequence)
);
CREATE INDEX notebook_public ON notebook_entries(document, published, sequence);
