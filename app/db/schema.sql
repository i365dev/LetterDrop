-- schema.sql

CREATE TABLE Newsletter (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    logo TEXT,
    subscribable BOOLEAN,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Subscriber (
    email TEXT,
    newsletter_id TEXT,
    isSubscribed BOOLEAN,
    upsertedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (email, newsletter_id),
    FOREIGN KEY (newsletter_id) REFERENCES Newsletter(id)
);
