CREATE TABLE match_doubles_team
(
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL REFERENCES "Match"(id) ON DELETE CASCADE,
    created_by_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    registered_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE match_doubles_team_member
(
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES match_doubles_team(id) ON DELETE CASCADE,
    match_id TEXT NOT NULL REFERENCES "Match"(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    slot SMALLINT NOT NULL CHECK (slot IN (1, 2))
);

CREATE UNIQUE INDEX match_doubles_team_member_team_slot_key
  ON match_doubles_team_member(team_id, slot);

CREATE UNIQUE INDEX match_doubles_team_member_team_user_key
  ON match_doubles_team_member(team_id, user_id);

CREATE UNIQUE INDEX match_doubles_team_member_match_user_key
  ON match_doubles_team_member(match_id, user_id);

CREATE INDEX match_doubles_team_match_registered_idx
  ON match_doubles_team(match_id, registered_at);

CREATE TABLE match_doubles_invite
(
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL REFERENCES "Match"(id) ON DELETE CASCADE,
    inviter_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    invitee_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT match_doubles_invite_status_check CHECK (status IN ('pending', 'accepted', 'revoked', 'rejected', 'voided')),
    CONSTRAINT match_doubles_invite_not_self CHECK (inviter_id <> invitee_id)
);

CREATE UNIQUE INDEX match_doubles_invite_pending_unique
  ON match_doubles_invite(match_id, inviter_id, invitee_id)
  WHERE status = 'pending';

CREATE INDEX match_doubles_invite_match_status_idx
  ON match_doubles_invite(match_id, status);

CREATE INDEX match_doubles_invite_invitee_status_idx
  ON match_doubles_invite(invitee_id, status);

CREATE INDEX match_doubles_invite_inviter_status_idx
  ON match_doubles_invite(inviter_id, status);
