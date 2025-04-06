package models

import (
	"fmt"
	"time"
)

func (db *DB) GetUserTransactions(userID int64, limit, offset int) ([]Transaction, int, error) {
	var total int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM transactions WHERE user_id = ?
	`, userID).Scan(&total)
	
	if err != nil {
		return nil, 0, fmt.Errorf("error getting transaction count: %w", err)
	}

	if limit <= 0 {
		limit = 10
	}

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

func (db *DB) CreateTransaction(userID int64, amount float64, location, description string) (*Transaction, error) {
	balance, err := db.GetUserBalance(userID)
	if err != nil {
		return nil, fmt.Errorf("error getting balance: %w", err)
	}

	newBalance := balance.CurrentBalance - amount
	
	tx := &Transaction{
		UserID:          userID,
		Amount:          amount,
		Location:        location,
		Description:     description,
		TransactionDate: time.Now(),
	}

	if err := db.UpdateBalance(userID, newBalance, tx); err != nil {
		return nil, fmt.Errorf("error updating balance: %w", err)
	}

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