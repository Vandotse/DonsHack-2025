package models

import (
	"fmt"
	"time"
)

// GetUserBalance retrieves the balance information for a user
func (db *DB) GetUserBalance(userID int64) (*Balance, error) {
	var balance Balance
	err := db.QueryRow(`
		SELECT id, user_id, starting_balance, current_balance, updated_at
		FROM balances
		WHERE user_id = ?
	`, userID).Scan(&balance.ID, &balance.UserID, &balance.StartingBalance, &balance.CurrentBalance, &balance.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("error getting balance: %w", err)
	}

	return &balance, nil
}

// UpdateBalance updates a user's balance after a transaction
func (db *DB) UpdateBalance(userID int64, newAmount float64, tx *Transaction) error {
	dbTx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}
	defer dbTx.Rollback()

	// Update balance
	_, err = dbTx.Exec(`
		UPDATE balances
		SET current_balance = ?, updated_at = ?
		WHERE user_id = ?
	`, newAmount, time.Now(), userID)

	if err != nil {
		return fmt.Errorf("error updating balance: %w", err)
	}

	// Record transaction
	_, err = dbTx.Exec(`
		INSERT INTO transactions (user_id, amount, location, description, transaction_date)
		VALUES (?, ?, ?, ?, ?)
	`, tx.UserID, tx.Amount, tx.Location, tx.Description, tx.TransactionDate)

	if err != nil {
		return fmt.Errorf("error recording transaction: %w", err)
	}

	if err = dbTx.Commit(); err != nil {
		return fmt.Errorf("error committing transaction: %w", err)
	}

	return nil
}

// GetBudgetSettings retrieves the budget settings for a user
func (db *DB) GetBudgetSettings(userID int64) (*BudgetSettings, error) {
	var settings BudgetSettings
	err := db.QueryRow(`
		SELECT id, user_id, weekly_budget, budget_warnings, strict_budget, transaction_notifications, weekly_reports, updated_at
		FROM budget_settings
		WHERE user_id = ?
	`, userID).Scan(
		&settings.ID, &settings.UserID, &settings.WeeklyBudget, &settings.BudgetWarnings,
		&settings.StrictBudget, &settings.TransactionNotifications, &settings.WeeklyReports, &settings.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("error getting budget settings: %w", err)
	}

	return &settings, nil
}

// UpdateBudgetSettings updates a user's budget settings
func (db *DB) UpdateBudgetSettings(settings *BudgetSettings) error {
	_, err := db.Exec(`
		UPDATE budget_settings
		SET weekly_budget = ?, budget_warnings = ?, strict_budget = ?, 
		    transaction_notifications = ?, weekly_reports = ?, updated_at = ?
		WHERE user_id = ?
	`,
		settings.WeeklyBudget, settings.BudgetWarnings, settings.StrictBudget,
		settings.TransactionNotifications, settings.WeeklyReports, time.Now(),
		settings.UserID,
	)

	if err != nil {
		return fmt.Errorf("error updating budget settings: %w", err)
	}

	return nil
} 