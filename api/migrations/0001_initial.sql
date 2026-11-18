-- Accounts, passkeys and sessions, and everything an account syncs.

-- One row per account. `seq` counts every change the account has stored, so
-- each record gets a number and devices ask for "everything after N".
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0
);

-- Passkeys that can sign in to an account. Other sign-in methods (Google)
-- get their own table later, pointing at the same users row.
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,              -- credential id, base64url
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,        -- COSE public key, base64url
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,                  -- JSON array
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX passkeys_user ON passkeys(user_id);

-- Signed-in devices. Only a SHA-256 of the token is kept, so a leaked
-- database can't be used to sign in.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- A passkey ceremony's challenge, between the "options" and "verify" calls.
-- Creating an account also keeps the new account's id and name here until
-- the passkey is made.
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  user_id TEXT,
  name TEXT,
  expires_at INTEGER NOT NULL
);

-- Subjects, assignments, exams and the profile, one JSON document each.
-- A deleted record stays as a tombstone (deleted = 1, data NULL) so other
-- devices learn about the delete.
CREATE TABLE records (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, id)
);
CREATE INDEX records_seq ON records(user_id, seq);
