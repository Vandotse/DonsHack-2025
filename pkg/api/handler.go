package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/pyne/flexibudget/pkg/models"
)

type Handler struct {
	db *models.DB
}

func NewHandler(db *models.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := int64(1)

	user := struct {
		ID        int64  `json:"id"`
		StudentID string `json:"student_id"`
		Name      string `json:"name"`
		Email     string `json:"email"`
	}{
		ID:        userID,
		StudentID: "S12345",
		Name:      "John Doe",
		Email:     "john.doe@example.com",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *Handler) GetUserBalance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := int64(1)

	balance := struct {
		UserID          int64   `json:"user_id"`
		StartingBalance float64 `json:"starting_balance"`
		CurrentBalance  float64 `json:"current_balance"`
		SpentAmount     float64 `json:"spent_amount"`
	}{
		UserID:          userID,
		StartingBalance: 1500.00,
		CurrentBalance:  1250.00,
		SpentAmount:     250.00,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(balance)
}

func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	
	if limit == 0 {
		limit = 10 
	}

	userID := int64(1) 

	transactions := []struct {
		ID              int64     `json:"id"`
		UserID          int64     `json:"user_id"`
		Amount          float64   `json:"amount"`
		Location        string    `json:"location"`
		TransactionDate time.Time `json:"transaction_date"`
		Icon            string    `json:"icon"`
	}{}

	locations := []struct {
		Name string
		Icon string
	}{
		{"Campus Café", "fa-utensils"},
		{"University Bookstore", "fa-book"},
		{"Student Center", "fa-mug-hot"},
		{"Food Truck Rally", "fa-truck"},
		{"Late Night Grill", "fa-hamburger"},
	}

	for i := 1; i <= limit; i++ {
		loc := locations[(i-1)%len(locations)]
		date := time.Now().AddDate(0, 0, -(i-1)/2)

		transactions = append(transactions, struct {
			ID              int64     `json:"id"`
			UserID          int64     `json:"user_id"`
			Amount          float64   `json:"amount"`
			Location        string    `json:"location"`
			TransactionDate time.Time `json:"transaction_date"`
			Icon            string    `json:"icon"`
		}{
			ID:              int64(i),
			UserID:          userID,
			Amount:          10.0 + float64(i),
			Location:        loc.Name,
			TransactionDate: date,
			Icon:            loc.Icon,
		})
	}

	response := struct {
		Transactions []struct {
			ID              int64     `json:"id"`
			UserID          int64     `json:"user_id"`
			Amount          float64   `json:"amount"`
			Location        string    `json:"location"`
			TransactionDate time.Time `json:"transaction_date"`
			Icon            string    `json:"icon"`
		} `json:"transactions"`
		Total  int `json:"total"`
		Limit  int `json:"limit"`
		Offset int `json:"offset"`
	}{
		Transactions: transactions,
		Total:        30, 
		Limit:        limit,
		Offset:       offset,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
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

	transaction := struct {
		ID              int64     `json:"id"`
		UserID          int64     `json:"user_id"`
		Amount          float64   `json:"amount"`
		Location        string    `json:"location"`
		Description     string    `json:"description"`
		TransactionDate time.Time `json:"transaction_date"`
	}{
		ID:              1,
		UserID:          1,
		Amount:          req.Amount,
		Location:        req.Location,
		Description:     req.Description,
		TransactionDate: time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transaction)
}

func (h *Handler) GetBudget(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := int64(1) 

	budget := struct {
		UserID                 int64   `json:"user_id"`
		WeeklyBudget           float64 `json:"weekly_budget"`
		CurrentWeekSpent       float64 `json:"current_week_spent"`
		BudgetPercentage       float64 `json:"budget_percentage"`
		BudgetWarnings         bool    `json:"budget_warnings"`
		StrictBudget           bool    `json:"strict_budget"`
		TransactionNotifications bool   `json:"transaction_notifications"`
		WeeklyReports          bool    `json:"weekly_reports"`
	}{
		UserID:                  userID,
		WeeklyBudget:            100.00,
		CurrentWeekSpent:        45.00,
		BudgetPercentage:        45.0,
		BudgetWarnings:          true,
		StrictBudget:            false,
		TransactionNotifications: true,
		WeeklyReports:           true,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(budget)
}

func (h *Handler) UpdateBudget(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		WeeklyBudget           float64 `json:"weekly_budget"`
		BudgetWarnings         bool    `json:"budget_warnings"`
		StrictBudget           bool    `json:"strict_budget"`
		TransactionNotifications bool   `json:"transaction_notifications"`
		WeeklyReports          bool    `json:"weekly_reports"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.WeeklyBudget <= 0 {
		http.Error(w, "Weekly budget must be positive", http.StatusBadRequest)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
} 