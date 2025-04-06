package models

import (
	"database/sql"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// CreateUser adds a new user to the database
func (db *DB) CreateUser(studentID, name, email, password string) (*User, error) {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("error generating password hash: %w", err)
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback()

	var userID int64
	err = tx.QueryRow(`
		INSERT INTO users (student_id, password_hash, name, email, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		RETURNING id
	`, studentID, string(passwordHash), name, email, time.Now(), time.Now()).Scan(&userID)

	if err != nil {
		return nil, fmt.Errorf("error creating user: %w", err)
	}

	// Create initial balance record
	_, err = tx.Exec(`
		INSERT INTO balances (user_id, starting_balance, current_balance, updated_at)
		VALUES (?, ?, ?, ?)
	`, userID, 1500.00, 1500.00, time.Now())
	if err != nil {
		return nil, fmt.Errorf("error creating balance: %w", err)
	}

	// Create default budget settings
	_, err = tx.Exec(`
		INSERT INTO budget_settings (user_id, weekly_budget, budget_warnings, strict_budget, transaction_notifications, weekly_reports, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, userID, 100.00, true, false, true, true, time.Now())
	if err != nil {
		return nil, fmt.Errorf("error creating budget settings: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("error committing transaction: %w", err)
	}

	return db.GetUserByID(userID)
}

// GetUserByID retrieves a user by their ID
func (db *DB) GetUserByID(id int64) (*User, error) {
	var user User
	err := db.QueryRow(`
		SELECT id, student_id, name, email, password_hash, created_at, updated_at
		FROM users
		WHERE id = ?
	`, id).Scan(&user.ID, &user.StudentID, &user.Name, &user.Email, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error getting user: %w", err)
	}

	return &user, nil
}

// GetUserByStudentID retrieves a user by their student ID
func (db *DB) GetUserByStudentID(studentID string) (*User, error) {
	var user User
	err := db.QueryRow(`
		SELECT id, student_id, name, email, password_hash, created_at, updated_at
		FROM users
		WHERE student_id = ?
	`, studentID).Scan(&user.ID, &user.StudentID, &user.Name, &user.Email, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error getting user: %w", err)
	}

	return &user, nil
}

// VerifyPassword checks if the provided password is correct
func (db *DB) VerifyPassword(user *User, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	return err == nil
} 