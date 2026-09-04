# PRD — Cinema Reservation System

## Overview

Build a BE cinema seat reservation system where authenticated users can view seats, reserve seats for 15 minutes, and complete reservations.

The server must prevent double-booking, enforce seating rules, and support local execution using Docker.

---

## Tech Stack

- Backend: Node.js + TypeScript
- Database: PostgreSQL
- Infrastructure: Docker

---

## Functional Requirements

### Authentication

- Users must log in before accessing the system.
- Reservation operations require authentication.

### Cinema Layout

- 10 rows × 10 seats.
- 3 rows × 5 seats.
- Total: 115 seats.

### Seat States

Each seat can be:

- Available
- Reserved (temporary hold)
- Booked (completed reservation)

### Reservations

Users can:

1. View seat availability.
2. Select one or more seats.
3. Create a reservation.
4. Complete a reservation before expiration.

Reservation rules:

- Reservation expires after 15 minutes.
- Expired reservations automatically release seats.
- Reserved seats are unavailable to other users.
- Two users cannot reserve the same seat simultaneously.

---

## Business Rules

### Rule 1 — Consecutive Seats

Selected seats must:

- Be in the same row.
- Form a consecutive sequence.

Valid:

```text
A: 5,6,7
B: 1,2
```

Invalid:

```text
A: 5,7
C: 2,3,5
```

### Rule 2 — No Isolated Empty Seat

A reservation must not leave exactly one empty seat trapped between occupied seats.

Occupied seats include:

- Reserved seats
- Booked seats
- Newly selected seats

Valid:

```text
# # * * . . . . . .
```

Invalid:

```text
# # . * * . . . . .
```

Single empty seats at the edge of a row are allowed.

---

## Reservation Lifecycle

```text
ACTIVE
 ├─> COMPLETED
 └─> EXPIRED
```

### Active

- Created when seats are reserved.
- Expires after 15 minutes.

### Completed

- Reservation finalized.
- Seats become permanently booked.

### Expired

- Reservation timed out.
- Seats become available again.

---

## Concurrency Requirements

The system must guarantee that:

- Two users cannot successfully reserve the same seat.
- Reservation creation is transactional.
- Concurrent requests leave the database in a consistent state.

Expected result:

```text
User A reserves A-5 -> Success
User B reserves A-5 -> Conflict
```


## API

### Login

```http
POST /auth/login
```

### Get Seats

```http
GET /seats
```

### Create Reservation

```http
POST /reservations
```

Request:

```json
{
  "seatIds": ["A-5", "A-6", "A-7"]
}
```

### Complete Reservation

```http
POST /reservations/:id/complete
```

### Get User Reservations

```http
GET /reservations
```



## Project Technical Requirements:

- Node.js with TypeScript
- Express framework
- PostgreSQL database
- RESTful API
- Server-side validation for seating rules and concurrency
- we will add a FE react app to this repo in the future so setup the project structure accordingly - perhaps use npm workspaces or perhaps Vite -- suggest options
- Create a README with 
- Create An ERD (Entity Relationship Diagram)
- we will add int the future Node native testing framework (assert module) for backend tests along with supertest and postgresql inm memory mocking
