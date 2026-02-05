-- Agents table (synced from config, stores runtime state)
CREATE TABLE agents (
    id text PRIMARY KEY,
    name text NOT NULL,
    endpoint_url text NOT NULL,
    icon text,
    description text,
    status text DEFAULT 'unknown', -- online, offline, unknown
    last_seen_at timestamptz,
    config jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Threads table
CREATE TABLE threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id text REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
    title text,
    status text DEFAULT 'active', -- active, paused, completed, error
    last_activity_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX threads_agent_id_idx ON threads(agent_id);
CREATE INDEX threads_last_activity_idx ON threads(last_activity_at DESC);

-- Messages table
CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL, -- user, assistant, system, tool
    content text NOT NULL,
    metadata jsonb DEFAULT '{}', -- tool calls, attachments, etc.
    created_at timestamptz DEFAULT now()
);

CREATE INDEX messages_thread_id_idx ON messages(thread_id, created_at DESC);

-- Inbox view with last message
CREATE VIEW inbox_view AS
WITH last_messages AS (
    SELECT DISTINCT ON (thread_id)
        thread_id,
        content as last_message,
        role as last_message_role,
        created_at as last_message_at
    FROM messages
    ORDER BY thread_id, created_at DESC
)
SELECT
    t.id,
    t.agent_id,
    t.title,
    t.status,
    t.last_activity_at,
    t.created_at,
    a.name as agent_name,
    a.icon as agent_icon,
    lm.last_message,
    lm.last_message_role,
    lm.last_message_at
FROM threads t
JOIN agents a ON a.id = t.agent_id
LEFT JOIN last_messages lm ON lm.thread_id = t.id
ORDER BY COALESCE(lm.last_message_at, t.created_at) DESC;

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
