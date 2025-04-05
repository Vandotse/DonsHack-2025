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
	router.HandleFunc("/api/logout", authHandler.Logout)
	
	router.HandleFunc("/api/users/me", apiHandler.GetCurrentUser)
	router.HandleFunc("/api/users/me/balance", apiHandler.GetUserBalance)
	
	router.HandleFunc("/api/transactions", apiHandler.GetTransactions)
	router.HandleFunc("/api/transactions/new", apiHandler.CreateTransaction)
	
	router.HandleFunc("/api/budget", apiHandler.GetBudget)
	router.HandleFunc("/api/budget/update", apiHandler.UpdateBudget)
	
	fmt.Printf("Server running at http://localhost:%s/\n", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
} 