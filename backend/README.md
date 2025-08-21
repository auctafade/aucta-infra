# Backend (Node API)

A RESTful API backend service built with Node.js for the Aucta platform.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Database](#database)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

- RESTful API endpoints
- Authentication and authorization
- Database integration
- Input validation
- Error handling
- Logging
- Rate limiting
- CORS support
- API documentation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: [MongoDB/PostgreSQL/MySQL]
- **Authentication**: JWT
- **Validation**: Joi/Express-validator
- **Testing**: Jest/Mocha
- **Documentation**: Swagger/OpenAPI
- **Process Manager**: PM2

## Prerequisites

- Node.js (v16.0.0 or higher)
- npm or yarn
- [Database system] running locally or remotely
- Git

## Installation

1. Clone the repository:
    ```bash
    git clone <repository-url>
    cd aucta-infra/backend
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Copy environment variables:
    ```bash
    cp .env.example .env
    ```

4. Configure your environment variables (see [Configuration](#configuration))

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL=your_database_connection_string
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aucta_db
DB_USER=your_username
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# External APIs
API_KEY=your_api_key

# Email Configuration (if applicable)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password

# Redis Configuration (if applicable)
REDIS_URL=redis://localhost:6379
```

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### With Docker
```bash
docker-compose up
```

The API will be available at `http://localhost:3000`

## API Documentation

### Base URL
```
Development: http://localhost:3000/api/v1
Production: https://api.aucta.com/v1
```

### Authentication
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Core Endpoints

#### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset

#### Users
- `GET /users` - Get all users (admin only)
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

#### [Add your specific endpoints here]

### Response Format
All API responses follow this structure:
```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Responses
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Project Structure

```
backend/
├── src/
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── config/          # Configuration files
│   ├── validators/      # Input validation schemas
│   └── app.js           # Express app setup
├── tests/               # Test files
├── docs/                # Documentation
├── scripts/             # Build and deployment scripts
├── .env.example         # Environment variables template
├── .gitignore
├── package.json
├── README.md
└── server.js            # Entry point
```

## Database

### Migrations
```bash
# Run migrations
npm run migrate

# Rollback migrations
npm run migrate:rollback

# Create new migration
npm run migrate:create migration_name
```

### Seeds
```bash
# Run seeds
npm run seed

# Create new seed
npm run seed:create seed_name
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/auth.test.js
```

## Deployment

### Environment Setup
1. Set up production environment variables
2. Configure database
3. Set up reverse proxy (Nginx)
4. Configure SSL certificates

### Using PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor application
pm2 monit

# View logs
pm2 logs
```

### Using Docker
```bash
# Build image
docker build -t aucta-backend .

# Run container
docker run -p 3000:3000 aucta-backend
```

## Development Guidelines

### Code Style
- Use ESLint and Prettier
- Follow conventional commit messages
- Write meaningful variable and function names
- Add JSDoc comments for functions

### Git Workflow
1. Create feature branch from `develop`
2. Make changes and commit
3. Create pull request
4. Code review and merge

### Error Handling
- Use try-catch blocks for async operations
- Create custom error classes
- Log errors appropriately
- Return consistent error responses

## Scripts

```bash
npm run dev          # Start development server
npm run start        # Start production server
npm run test         # Run tests
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run build        # Build for production
npm run migrate      # Run database migrations
npm run seed         # Run database seeds
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).

## Support

For support, email support@aucta.com or create an issue in the repository.
