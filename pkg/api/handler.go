package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/pyne/flexibudget/pkg/auth"
	"github.com/pyne/flexibudget/pkg/models"
)

type Handler struct {
	db *models.DB
}

func NewHandler(db *models.DB) *Handler {
	return &Handler{db: db}
}

// GetCurrentUser returns the user information for the authenticated user
func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := auth.ExtractUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.db.GetUserByID(userID)
	if err != nil || user == nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	userResponse := struct {
		ID        int64  `json:"id"`
		StudentID string `json:"student_id"`
		Name      string `json:"name"`
		Email     string `json:"email"`
	}{
		ID:        user.ID,
		StudentID: user.StudentID,
		Name:      user.Name,
		Email:     user.Email,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userResponse)
}

// GetUserBalance returns the balance information for the authenticated user
func (h *Handler) GetUserBalance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := auth.ExtractUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	balance, err := h.db.GetUserBalance(userID)
	if err != nil {
		http.Error(w, "Failed to get balance", http.StatusInternalServerError)
		return
	}

	// Calculate spent amount
	spentAmount := balance.StartingBalance - balance.CurrentBalance

	balanceResponse := struct {
		UserID          int64   `json:"user_id"`
		StartingBalance float64 `json:"starting_balance"`
		CurrentBalance  float64 `json:"current_balance"`
		SpentAmount     float64 `json:"spent_amount"`
	}{
		UserID:          balance.UserID,
		StartingBalance: balance.StartingBalance,
		CurrentBalance:  balance.CurrentBalance,
		SpentAmount:     spentAmount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(balanceResponse)
}

// GetTransactions returns the list of transactions for the authenticated user with pagination
func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := auth.ExtractUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	
	if limit == 0 {
		limit = 10 
	}

	transactions, total, err := h.db.GetUserTransactions(userID, limit, offset)
	if err != nil {
		http.Error(w, "Failed to get transactions", http.StatusInternalServerError)
		return
	}

	// Add icons based on transaction location (normally these would be stored in the database)
	type TransactionWithIcon struct {
		ID              int64     `json:"id"`
		UserID          int64     `json:"user_id"`
		Amount          float64   `json:"amount"`
		Location        string    `json:"location"`
		Description     string    `json:"description"`
		TransactionDate time.Time `json:"transaction_date"`
		Icon            string    `json:"icon"`
	}

	// Map to store location to icon mappings
	locationIcons := map[string]string{
		"Campus Café":         "fa-utensils",
		"University Bookstore": "fa-book",
		"Student Center":      "fa-mug-hot",
		"Food Truck Rally":    "fa-truck",
		"Late Night Grill":    "fa-hamburger",
	}

	// Default icon
	defaultIcon := "fa-credit-card"

	// Create response with icons
	txWithIcons := make([]TransactionWithIcon, 0, len(transactions))
	for _, tx := range transactions {
		icon, ok := locationIcons[tx.Location]
		if !ok {
			icon = defaultIcon
		}

		txWithIcons = append(txWithIcons, TransactionWithIcon{
			ID:              tx.ID,
			UserID:          tx.UserID,
			Amount:          tx.Amount,
			Location:        tx.Location,
			Description:     tx.Description,
			TransactionDate: tx.TransactionDate,
			Icon:            icon,
		})
	}

	response := struct {
		Transactions []TransactionWithIcon `json:"transactions"`
		Total        int                   `json:"total"`
		Limit        int                   `json:"limit"`
		Offset       int                   `json:"offset"`
	}{
		Transactions: txWithIcons,
		Total:        total,
		Limit:        limit,
		Offset:       offset,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateTransaction creates a new transaction for the authenticated user
func (h *Handler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := auth.ExtractUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Amount      float64 `json:"amount"`
		Location    string  `json:"location"`
		Description string  `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Amount <= 0 {
		http.Error(w, "Amount must be positive", http.StatusBadRequest)
		return
	}

	if req.Location == "" {
		http.Error(w, "Location is required", http.StatusBadRequest)
		return
	}

	// Check budget settings
	settings, err := h.db.GetBudgetSettings(userID)
	if err != nil {
		http.Error(w, "Failed to get budget settings", http.StatusInternalServerError)
		return
	}

	// Get current balance
	balance, err := h.db.GetUserBalance(userID)
	if err != nil {
		http.Error(w, "Failed to get balance", http.StatusInternalServerError)
		return
	}

	// Check if transaction would exceed balance and strict budget is enabled
	if settings.StrictBudget && balance.CurrentBalance < req.Amount {
		http.Error(w, "Transaction exceeds available balance with strict budget enabled", http.StatusForbidden)
		return
	}

	// Create transaction
	tx, err := h.db.CreateTransaction(userID, req.Amount, req.Location, req.Description)
	if err != nil {
		http.Error(w, "Failed to create transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tx)
}

// GetBudget returns the budget settings for the authenticated user
func (h *Handler) GetBudget(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := auth.ExtractUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	settings, err := h.db.GetBudgetSettings(userID)
	if err != nil {
		http.Error(w, "Failed to get budget settings", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

// UpdateBudget updates the budget settings for the authenticated user
func (h *Handler) UpdateBudget(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := auth.ExtractUserID(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.BudgetSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Make sure the user ID in the request matches the authenticated user
	req.UserID = userID

	// Validate weekly budget
	if req.WeeklyBudget <= 0 {
		http.Error(w, "Weekly budget must be positive", http.StatusBadRequest)
		return
	}

	// Update settings
	if err := h.db.UpdateBudgetSettings(&req); err != nil {
		http.Error(w, "Failed to update budget settings", http.StatusInternalServerError)
		return
	}

	// Return updated settings
	settings, err := h.db.GetBudgetSettings(userID)
	if err != nil {
		http.Error(w, "Failed to get updated budget settings", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
} 