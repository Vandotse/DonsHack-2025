package models


import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	*sql.DB
}

func InitDB() (*DB, error) {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "flexibudget.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("error opening database: %w", err)
	}

	if err = db.Ping(); err != nil {
		return nil, fmt.Errorf("error connecting to database: %w", err)
	}

	if err = createTables(db); err != nil {
		return nil, fmt.Errorf("error creating tables: %w", err)
	}

	return &DB{db}, nil
}

func createTables(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			student_id TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS balances (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			starting_balance REAL NOT NULL,
			current_balance REAL NOT NULL,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users (id)
		)
	`)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS budget_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER UNIQUE NOT NULL,
			weekly_budget REAL NOT NULL DEFAULT 100.00,
			budget_warnings BOOLEAN NOT NULL DEFAULT 1,
			strict_budget BOOLEAN NOT NULL DEFAULT 0,
			transaction_notifications BOOLEAN NOT NULL DEFAULT 1,
			weekly_reports BOOLEAN NOT NULL DEFAULT 1,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users (id)
		)
	`)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS transactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			amount REAL NOT NULL,
			location TEXT NOT NULL,
			description TEXT,
			transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users (id)
		)
	`)
	if err != nil {
		return err
	}

	return nil
}

func (db *DB) Close() error {
	return db.DB.Close()
}

type User struct {
	ID          int64     `json:"id"`
	StudentID   string    `json:"student_id"`
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	PasswordHash string    `json:"-"`
}

type Balance struct {
	ID             int64     `json:"id"`
	UserID         int64     `json:"user_id"`
	StartingBalance float64   `json:"starting_balance"`
	CurrentBalance float64   `json:"current_balance"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type BudgetSettings struct {
	ID                     int64     `json:"id"`
	UserID                 int64     `json:"user_id"`
	WeeklyBudget           float64   `json:"weekly_budget"`
	BudgetWarnings         bool      `json:"budget_warnings"`
	StrictBudget           bool      `json:"strict_budget"`
	TransactionNotifications bool     `json:"transaction_notifications"`
	WeeklyReports          bool      `json:"weekly_reports"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type Transaction struct {
	ID              int64     `json:"id"`
	UserID          int64     `json:"user_id"`
	Amount          float64   `json:"amount"`
	Location        string    `json:"location"`
	Description     string    `json:"description"`
	TransactionDate time.Time `json:"transaction_date"`
} 