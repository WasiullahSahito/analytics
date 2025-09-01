# Analytics API for User Activity and Post Engagement



A modular, secure Analytics API built with Node.js, Express, and MongoDB. It provides a robust system for ingesting user activity events, performing daily aggregations via background jobs, and exposing insightful metrics through a secure, admin-only interface.

## 🌟 Key Features

-   **🚀 High-Performance Ingestion**: A rate-limited endpoint to ingest various user activity events in batches.
-   **🔑 Idempotency**: Prevents duplicate event processing using an `X-Idempotency-Key` header, ensuring data integrity.
-   **📈 Daily Aggregations**: A background cron job runs daily to roll up raw events into aggregated metrics (DAU, post views, likes), making read queries extremely fast.
-   **🔐 Secure by Design**: Analytics data is protected by JWT authentication and accessible only by users with an `admin` role.
-   **📊 Comprehensive Metrics**: Exposes endpoints for DAU, retention cohorts, top posts, trending searches, and detailed post engagement rates.
-   **🌱 Data Seeding**: Includes a powerful script to populate the database with realistic demo data for immediate testing and demonstration.

---

## 🏛️ System Architecture

The API follows a simple, scalable architecture that separates raw event ingestion from aggregated data querying.

```mermaid
graph TD
    A[Clients/Frontend] -->|POST /api/analytics/events| B(Ingestion API);
    B -->|Writes Raw Events| C[MongoDB: events Collection];
    D[Cron Job (Daily)] -->|Reads from| C;
    D -->|Aggregates Data| E[MongoDB: daily_metrics & post_daily_metrics];
    F[Admin User] -->|GET /api/analytics/*| G(Secure Read API);
    G -->|Reads Aggregated Data| E;
```

---

## 🛠️ Tech Stack

-   **Backend**: Node.js, Express.js
-   **Database**: MongoDB with Mongoose ODM
-   **Authentication**: JSON Web Tokens (JWT)
-   **Background Jobs**: `node-cron`
-   **Validation**: `express-validator`
-   **Security**: `helmet`, `bcryptjs`, `express-rate-limit`
-   **Development**: `nodemon` for live reloading, `@faker-js/faker` for data seeding

---

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

-   [Node.js](https://nodejs.org/en/) (v16.x or later)
-   [MongoDB](https://www.mongodb.com/try/download/community) (running locally or a cloud instance like MongoDB Atlas)

### Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/WasiullahSahito/analytics.git
    cd analytics-api
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Set Up Environment Variables**
    Create a `.env` file in the project root. Copy the contents of `.env.example` and fill in your configuration details.

    ```env
    # .env
    PORT=5001
    MONGO_URI=mongodb://localhost:2717/analyticsDB
    JWT_SECRET=your_super_secret_jwt_key_that_is_very_long
    IP_HASH_SALT=a_very_strong_and_random_salt_for_ips
    ```

### Running the Application

1.  **Seed the Database (Highly Recommended)**
    This command will clean the database and populate it with thousands of realistic demo events and pre-calculated metrics.

    ```bash
    npm run seed
    ```
    > **Note:** The seed script creates an admin user with the following credentials:
    > -   **Username**: `admin`
    > -   **Password**: `password123`

2.  **Start the Development Server**
    The server will run with `nodemon`, automatically restarting on file changes.

    ```bash
    npm run dev
    ```
    The API will be available at `http://localhost:5001`.

---

## 📖 API Documentation

All endpoints are prefixed with `/api`. Admin endpoints require an `Authorization: Bearer <token>` header.

<details>
<summary><strong>🔑 Authentication Endpoints</strong></summary>

### Register User
-   **Method:** `POST`
-   **Endpoint:** `/auth/register`
-   **Body:**
    ```json
    {
      "username": "admin",
      "password": "password123",
      "role": "admin"
    }
    ```

### Login User
-   **Method:** `POST`
-   **Endpoint:** `/auth/login`
-   **Body:**
    ```json
    {
      "username": "admin",
      "password": "password123"
    }
    ```
</details>

<details>
<summary><strong>📥 Event Ingestion Endpoint</strong></summary>

### Ingest Events
-   **Method:** `POST`
-   **Endpoint:** `/analytics/events`
-   **Auth:** Public (Rate-limited)
-   **Headers:** `X-Idempotency-Key: <unique-uuid>` (Required)
-   **Body:**
    ```json
    [
      {
        "event": "post_view",
        "userId": "some_user_id",
        "postId": "some_post_id",
        "sessionId": "some_session_id",
        "metadata": { "path": "/posts/some_post_id" }
      }
    ]
    ```
</details>

<details>
<summary><strong>📊 Analytics Endpoints (Admin Only)</strong></summary>

### Get Overview
-   **Method:** `GET`
-   **Endpoint:** `/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Get Active Users
-   **Method:** `GET`
-   **Endpoint:** `/analytics/users/active?window=7|30`

### Get Cohort Retention
-   **Method:** `GET`
-   **Endpoint:** `/analytics/retention?cohortStart=YYYY-MM-DD`

### Get Top Posts
-   **Method:** `GET`
-   **Endpoint:** `/analytics/posts/top?metric=views|likes|comments&period=7|30&limit=10`

### Get Post Details
-   **Method:** `GET`
-   **Endpoint:** `/analytics/posts/:postId`

### Get Trending Searches
-   **Method:** `GET`
-   **Endpoint:** `/analytics/search/trending?period=7|30`
</details>

---

## 📬 Postman Collection

A Postman collection is provided to easily test all API endpoints.

1.  Open Postman.
2.  Click **Import** and upload the `Analytics-API.postman_collection.json` file from the repository.
3.  The collection includes a `baseUrl` variable, which is pre-set to `http://localhost:5001/api`.
4.  Run the `Login (Admin)` request first. It will automatically save the JWT token to a collection variable, authorizing all subsequent admin requests.

---

## 📂 Project Structure

```
.
├── script/
│   └── seed.js             # Database seeding script
├── src/
│   ├── config/
│   │   └── db.js           # MongoDB connection
│   ├── controllers/        # Request handling logic
│   ├── jobs/               # Background cron jobs
│   ├── middleware/         # Express middleware (auth, admin, validation)
│   ├── models/             # Mongoose schemas and models
│   ├── routes/             # API route definitions
│   └── utils/              # Utility functions (e.g., IP hasher)
├── .env.example            # Environment variable template
├── .gitignore
├── server.js               # Main application entry point
└── package.json
```

---
