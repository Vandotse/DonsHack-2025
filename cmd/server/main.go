package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/pyne/flexibudget/pkg/api"
	"github.com/pyne/flexibudget/pkg/auth"
	"github.com/pyne/flexibudget/pkg/models"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db, err := models.InitDB()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	router := http.NewServeMux()

	fs := http.FileServer(http.Dir("web"))
	router.Handle("/", fs)
	router.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("web/static"))))

	apiHandler := api.NewHandler(db)
	authHandler := auth.NewHandler(db)
	
	router.HandleFunc("/api/login", authHandler.Login)
	router.HandleFunc("/api/register", authHandler.Register)
	router.HandleFunc("/api/logout", authHandler.Logout)
	
	withAuth := func(handler http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			authMiddleware := auth.AuthMiddleware(db)
			authMiddleware(http.HandlerFunc(handler)).ServeHTTP(w, r)
		}
	}
	
	router.HandleFunc("/api/users/me", withAuth(apiHandler.GetCurrentUser))
	router.HandleFunc("/api/users/me/balance", withAuth(apiHandler.GetUserBalance))
	
	router.HandleFunc("/api/transactions", withAuth(apiHandler.GetTransactions))
	router.HandleFunc("/api/transactions/new", withAuth(apiHandler.CreateTransaction))
	
	router.HandleFunc("/api/budget", withAuth(apiHandler.GetBudget))
	router.HandleFunc("/api/budget/update", withAuth(apiHandler.UpdateBudget))
	
	fmt.Printf("Server running at http://localhost:%s/\n", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
} 