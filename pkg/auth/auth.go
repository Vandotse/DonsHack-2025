package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/pyne/flexibudget/pkg/models"
)

type Handler struct {
	db *models.DB
}

func NewHandler(db *models.DB) *Handler {
	return &Handler{db: db}
}

type LoginRequest struct {
	StudentID string `json:"student_id"`
	Password  string `json:"password"`
}

type LoginResponse struct {
	Token     string `json:"token"`
	ExpiresAt int64  `json:"expires_at"`
	User      User   `json:"user"`
}

type User struct {
	ID        int64  `json:"id"`
	StudentID string `json:"student_id"`
	Name      string `json:"name"`
}

type RegisterRequest struct {
	StudentID string `json:"student_id"`
	Password  string `json:"password"`
	Name      string `json:"name"`
	Email     string `json:"email"`
}

// Login authenticates a user and returns a JWT token
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Get user from database
	user, err := h.db.GetUserByStudentID(req.StudentID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if user == nil {
		// If user doesn't exist but we're in development mode, create a test user
		if os.Getenv("APP_ENV") == "development" && req.StudentID != "" {
			user, err = h.db.CreateUser(req.StudentID, "Demo User", req.StudentID+"@example.com", req.Password)
			if err != nil {
				http.Error(w, "Failed to create user", http.StatusInternalServerError)
				return
			}
		} else {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}
	} else {
		// Verify password
		if !h.db.VerifyPassword(user, req.Password) {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}
	}

	// Generate token
	expiresAt := time.Now().Add(24 * time.Hour).Unix()
	token, err := generateToken(user.ID, user.StudentID, expiresAt)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	resp := LoginResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User: User{
			ID:        user.ID,
			StudentID: user.StudentID,
			Name:      user.Name,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// Register creates a new user
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.StudentID == "" || req.Password == "" || req.Name == "" || req.Email == "" {
		http.Error(w, "All fields are required", http.StatusBadRequest)
		return
	}

	// Check if user already exists
	existingUser, err := h.db.GetUserByStudentID(req.StudentID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if existingUser != nil {
		http.Error(w, "User already exists", http.StatusConflict)
		return
	}

	// Create new user
	user, err := h.db.CreateUser(req.StudentID, req.Name, req.Email, req.Password)
	if err != nil {
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	// Generate token
	expiresAt := time.Now().Add(24 * time.Hour).Unix()
	token, err := generateToken(user.ID, user.StudentID, expiresAt)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	resp := LoginResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User: User{
			ID:        user.ID,
			StudentID: user.StudentID,
			Name:      user.Name,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// In a real implementation, you might want to add the token to a blocklist
	// For now, we'll just return success
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// JWT secret key
var jwtSecret = []byte(getJWTSecret())

func getJWTSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "flexibudget-default-secret-key"
	}
	return secret
}

// Generate JWT token
func generateToken(userID int64, studentID string, expiresAt int64) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":    userID,
		"student_id": studentID,
		"exp":        expiresAt,
	})

	return token.SignedString(jwtSecret)
}

// ExtractUserID extracts the user ID from the Authorization header
func ExtractUserID(r *http.Request) (int64, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return 0, fmt.Errorf("missing authorization header")
	}

	// Remove "Bearer " prefix
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenStr == authHeader {
		return 0, fmt.Errorf("invalid token format")
	}

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		return 0, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userID, ok := claims["user_id"].(float64)
		if !ok {
			return 0, fmt.Errorf("invalid user_id in token")
		}
		return int64(userID), nil
	}

	return 0, fmt.Errorf("invalid token")
}

// AuthMiddleware protects routes that require authentication
func AuthMiddleware(db *models.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, err := ExtractUserID(r)
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Verify user exists
			user, err := db.GetUserByID(userID)
			if err != nil || user == nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Set user ID in context
			ctx := r.Context()
			r = r.WithContext(ctx)

			next.ServeHTTP(w, r)
		})
	}
}
