-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    personal_color VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personal_color_results (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    color_type VARCHAR(50) NOT NULL,
    confidence FLOAT,
    method VARCHAR(20) CHECK (method IN ('survey', 'image', 'hybrid')),
    image_url TEXT,
    survey_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS closet_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    category VARCHAR(50),
    color VARCHAR(50),
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fashion_knowledge (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),
    personal_color VARCHAR(50),
    occasion VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_personal_color_results_user ON personal_color_results(user_id);
CREATE INDEX idx_closet_items_user ON closet_items(user_id);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_fashion_knowledge_embedding ON fashion_knowledge USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_fashion_knowledge_color ON fashion_knowledge(personal_color);

-- Insert sample data (optional)
INSERT INTO users (email, password, nickname, personal_color) VALUES 
('test@example.com', '$2a$10$rQJ5XkZxPxEjDKvQQvXq3.dDZQQZ3nZZ3nZZ3nZZ3nZZ3nZZ3nZZ3', 'TestUser', 'spring_warm')
ON CONFLICT (email) DO NOTHING;

COMMIT;
