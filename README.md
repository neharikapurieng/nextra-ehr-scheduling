# Nextera EHR Scheduling Backend

A robust, scalable NestJS + PostgreSQL backend for healthcare appointment scheduling, supporting multi-clinic/provider environments and advanced slot recommendations.

## Features

- Appointment slot recommendations considering:
  - Physician working hours
  - Ontario billing gap rules
  - Avoids clustering and prioritizes least disruptive slots
  - Multi-clinic and multi-provider support
- Seed data for clinics, physicians, patients, and appointments
- Comprehensive unit/integration tests

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL

### Setup

1. Clone the repository.
2. Copy `.env.example` to `.env` and configure your database connection.
3. Install dependencies:
   ```sh
   npm install
   ```
4. Run database migrations and seed data:
   ```sh
   npm run seed
   ```
5. Start the server:
   ```sh
   npm run start:dev
   ```

### Testing

Run all tests:
```sh
npm test
```

## API

- `POST /appointments/recommend`  
  Recommends appointment slots based on input criteria.

## Postman Collection & Assumptions

- See `nextra-ehr-scheduling.postman_collection.json` for a ready-to-use example of the recommend endpoint.

The design and implementation are based on the following key assumptions:

- Each physician is uniquely identified by a composite key consisting of their physicianId and the clinicId they are associated with.
- Billing rules are structured to be region-based and are designed for easy extensibility, allowing for the addition of new provincial or regional rules without significant code changes.
- The modular nature of the system ensures it is ready for future expansion, including the onboarding of more clinics, providers, and geographical regions, with minimal modifications required.
- Comprehensive seed data is supplied to facilitate demonstration, testing, and initial setup of the application.
- All times are handled in UTC to avoid timezone issues.
- Only availability blocks of type `available` are considered for slot recommendations.
- Billing gap and buffer rules are based on the Ontario region and are configurable.
- The slot search increments by the billing gap duration for efficiency.
- The scoring system penalizes clustering, edge-of-day slots, and squeezed slots, and prefers least disruptive options.