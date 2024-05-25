# i365-letter-drop

## How to run

```
npm install
npm run dev
```

```
npm run deploy
```

## Architecture

### Database Schema

```mermaid
erDiagram
    Newsletter ||--o{ Subscriber : has

    Newsletter {
        string id PK
        string title
        string description 
        string logo
        int subscriberCount
        bool subscribable
        datetime createdAt
        datetime updatedAt
    }

    Subscriber {
        string email PK
        bool isSubscribed
        datetime upsertedAt
    }
```
