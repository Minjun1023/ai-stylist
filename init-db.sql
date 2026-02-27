-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) UNIQUE NOT NULL,
    personal_color VARCHAR(50),
    gender VARCHAR(20),
    age_group VARCHAR(20),
    body_type VARCHAR(30),
    style_mood_preference VARCHAR(30),
    style_profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    personal_color_completed BOOLEAN NOT NULL DEFAULT FALSE,
    chat_profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    style_recommendation_completed BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE TABLE IF NOT EXISTS calendar_outfits (
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    outfit_date DATE NOT NULL,
    image_data BYTEA NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    original_filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, outfit_date)
);

CREATE TABLE IF NOT EXISTS calendar_schedule_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_at TIMESTAMP NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(120) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(120) NOT NULL,
    category VARCHAR(30) NOT NULL,
    gender VARCHAR(20) NOT NULL DEFAULT 'unisex',
    season VARCHAR(20),
    mood VARCHAR(40),
    tags_csv TEXT,
    description TEXT,
    price_text VARCHAR(50),
    price_range VARCHAR(30),
    image_url TEXT NOT NULL,
    product_url TEXT NOT NULL,
    source_label VARCHAR(60) NOT NULL DEFAULT '샘플 DB',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_personal_color_results_user ON personal_color_results(user_id);
CREATE INDEX idx_closet_items_user ON closet_items(user_id);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_fashion_knowledge_embedding ON fashion_knowledge USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_fashion_knowledge_color ON fashion_knowledge(personal_color);
CREATE INDEX idx_calendar_outfits_user_date ON calendar_outfits(user_id, outfit_date);
CREATE INDEX idx_calendar_schedule_user_datetime ON calendar_schedule_events(user_id, schedule_at);
CREATE INDEX idx_products_category_gender ON products(category, gender);
CREATE INDEX idx_products_active ON products(is_active);

-- Insert sample data (optional)
INSERT INTO users (
    email,
    password,
    nickname,
    personal_color,
    gender,
    age_group,
    body_type,
    style_mood_preference,
    style_profile_completed,
    personal_color_completed,
    chat_profile_completed,
    style_recommendation_completed
) VALUES 
('test@example.com', '$2a$10$rQJ5XkZxPxEjDKvQQvXq3.dDZQQZ3nZZ3nZZ3nZZ3nZZ3nZZ3nZZ3', 'TestUser', 'spring_warm', 'undisclosed', 'twenties_early', 'standard', 'casual', true, true, false, false)
ON CONFLICT (email) DO NOTHING;

COMMIT;
