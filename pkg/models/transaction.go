package models

import (
	"fmt"
	"time"
)

// GetUserTransactions retrieves transactions for a specific user with pagination
func (db *DB) GetUserTransactions(userID int64, limit, offset int) ([]Transaction, int, error) {
	// Get total count
	var total int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM transactions WHERE user_id = ?
	`, userID).Scan(&total)
	
	if err != nil {
		return nil, 0, fmt.Errorf("error getting transaction count: %w", err)
	}

	// If no limit specified, use default
	if limit <= 0 {
		limit = 10
	}

	// Get transactions with pagination
	rows, err := db.Query(`
		SELECT id, user_id, amount, location, description, transaction_date
		FROM transactions
		WHERE user_id = ?
		ORDER BY transaction_date DESC
		LIMIT ? OFFSET ?
	`, userID, limit, offset)
	
	if err != nil {
		return nil, 0, fmt.Errorf("error getting transactions: %w", err)
	}
	defer rows.Close()

	var transactions []Transaction
	for rows.Next() {
		var tx Transaction
		err := rows.Scan(
			&tx.ID, &tx.UserID, &tx.Amount, &tx.Location, 
			&tx.Description, &tx.TransactionDate,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error scanning transaction: %w", err)
		}
		transactions = append(transactions, tx)
	}

	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating transactions: %w", err)
	}

	return transactions, total, nil
}

// CreateTransaction creates a new transaction and updates the user's balance
func (db *DB) CreateTransaction(userID int64, amount float64, location, description string) (*Transaction, error) {
	// Get current balance
	balance, err := db.GetUserBalance(userID)
	if err != nil {
		return nil, fmt.Errorf("error getting balance: %w", err)
	}

	// Calculate new balance
	newBalance := balance.CurrentBalance - amount
	
	// Create transaction
	tx := &Transaction{
		UserID:          userID,
		Amount:          amount,
		Location:        location,
		Description:     description,
		TransactionDate: time.Now(),
	}

	// Update balance and record transaction
	if err := db.UpdateBalance(userID, newBalance, tx); err != nil {
		return nil, fmt.Errorf("error updating balance: %w", err)
	}

	// Fetch the created transaction to get its ID
	rows, err := db.Query(`
		SELECT id, user_id, amount, location, description, transaction_date
		FROM transactions
		WHERE user_id = ? AND location = ?
		ORDER BY transaction_date DESC LIMIT 1
	`, userID, location)
	if err != nil {
		return nil, fmt.Errorf("error fetching created transaction: %w", err)
	}
	defer rows.Close()

	if rows.Next() {
		err := rows.Scan(
			&tx.ID, &tx.UserID, &tx.Amount, &tx.Location, 
			&tx.Description, &tx.TransactionDate,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning transaction: %w", err)
		}
	}

	return tx, nil
} 