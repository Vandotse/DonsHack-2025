# FlexiBudget Demo

This demo showcases a sample implementation of the FlexiBudget application, a campus meal plan tracking and budgeting tool. The demo focuses primarily on the frontend implementation, with placeholder files for the Go backend structure.

## Project Structure

- `web/`: Frontend HTML, CSS, and JavaScript
  - `index.html`: Dashboard page
  - `login.html`: Login page
  - `settings.html`: Settings page
  - `transactions.html`: Transactions history page
  - `static/`: Static assets (CSS, JS, images)

- `cmd/server/`: Go backend entry point
- `pkg/`: Go backend packages
  - `api/`: API handlers
  - `auth/`: Authentication logic
  - `models/`: Data models and database interface

- `server.js`: Simple Node.js server to serve the frontend for demo purposes

## Running the Demo

To run the demo:

1. Make sure you have Node.js installed

2. Install the dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000/
   ```

## Demo Credentials

You can use any credentials to log in to the demo. For example:
- Student ID: `12345`
- Password: `password`

## Features

The demo showcases the following features:

- **Login Screen**: Simulated authentication
- **Dashboard**: Overview of the meal plan balance, budget, recent spending, and latest transactions
- **Transactions**: View and filter transaction history
- **Settings**: Configure budget preferences and notification settings
- **Add Transaction**: Simulate adding a new transaction with budget warnings

## About the Implementation

This demo uses:
- HTML, CSS, and vanilla JavaScript for the frontend
- Chart.js for visualizations
- Font Awesome for icons
- Node.js for the simple demo server

In a real implementation, the backend would be built with Go:
- Using standard library `net/http` for the web server
- SQLite for the database (via `github.com/mattn/go-sqlite3`)
- JWT for authentication (via `github.com/dgrijalva/jwt-go`)
- RESTful API endpoints for data access

## Connecting to a Real Campus System

In a production environment, this application would need to connect to the campus meal plan system. This would likely involve:

1. Getting authorization from the school administration
2. Obtaining API credentials or database access to the meal plan system
3. Implementing real-time transaction monitoring
4. Adding secure authentication tied to the campus identity system

## Next Steps

To turn this demo into a production-ready application:

1. Implement the Go backend
2. Add proper authentication with the campus system
3. Implement real-time transaction tracking
4. Add email/push notifications
5. Improve mobile responsiveness
6. Add accessibility features
7. Implement proper error handling and logging 