document.addEventListener('DOMContentLoaded', function() {
    // Mock data for menu items
    const menuItems = [
        {
            id: 1,
            name: "Avocado Toast",
            price: "$8.99",
            mealType: "breakfast",
            dietaryRestrictions: ["vegetarian", "dairy-free"]
        },
        {
            id: 2,
            name: "Belgian Waffle",
            price: "$7.50",
            mealType: "breakfast",
            dietaryRestrictions: ["vegetarian"]
        },
        {
            id: 3,
            name: "Breakfast Burrito",
            price: "$9.25",
            mealType: "breakfast",
            dietaryRestrictions: []
        },
        {
            id: 4,
            name: "Greek Yogurt Parfait",
            price: "$5.99",
            mealType: "breakfast",
            dietaryRestrictions: ["vegetarian", "gluten-free"]
        },
        {
            id: 5,
            name: "Grilled Chicken Sandwich",
            price: "$10.50",
            mealType: "lunch",
            dietaryRestrictions: []
        },
        {
            id: 6,
            name: "Quinoa Bowl",
            price: "$11.25",
            mealType: "lunch",
            dietaryRestrictions: ["vegetarian", "gluten-free", "dairy-free"]
        },
        {
            id: 7,
            name: "Caprese Panini",
            price: "$9.99",
            mealType: "lunch",
            dietaryRestrictions: ["vegetarian"]
        },
        {
            id: 8,
            name: "Caesar Salad",
            price: "$8.75",
            mealType: "lunch",
            dietaryRestrictions: []
        },
        {
            id: 9,
            name: "Mushroom Risotto",
            price: "$13.50",
            mealType: "dinner",
            dietaryRestrictions: ["vegetarian", "gluten-free"]
        },
        {
            id: 10,
            name: "Grilled Salmon",
            price: "$16.99",
            mealType: "dinner",
            dietaryRestrictions: ["gluten-free", "dairy-free"]
        },
        {
            id: 11,
            name: "Margherita Pizza",
            price: "$12.50",
            mealType: "dinner",
            dietaryRestrictions: ["vegetarian"]
        },
        {
            id: 12,
            name: "Beef Stir-Fry",
            price: "$14.25",
            mealType: "dinner",
            dietaryRestrictions: ["dairy-free"]
        },
        {
            id: 13, 
            name: "Vegan Burger",
            price: "$11.99",
            mealType: "lunch",
            dietaryRestrictions: ["vegan", "vegetarian", "dairy-free"]
        },
        {
            id: 14,
            name: "Fruit Smoothie Bowl",
            price: "$7.99",
            mealType: "breakfast",
            dietaryRestrictions: ["vegan", "vegetarian", "gluten-free", "dairy-free"]
        },
        {
            id: 15,
            name: "Pasta Primavera",
            price: "$13.99",
            mealType: "dinner",
            dietaryRestrictions: ["vegetarian"]
        }
    ];

    // Get DOM elements
    const menuContainer = document.getElementById('menu-container');
    const mealTypeFilter = document.getElementById('meal-type');
    const dietaryFilter = document.getElementById('dietary-restriction');
    const searchInput = document.getElementById('search');

    // Function to render menu items
    function renderMenuItems(items) {
        menuContainer.innerHTML = '';
        
        if (items.length === 0) {
            menuContainer.innerHTML = '<div class="no-results">No menu items match your filters</div>';
            return;
        }
        
        items.forEach(item => {
            const menuItemElement = document.createElement('div');
            menuItemElement.className = 'menu-item';
            
            // Create meal type badge
            const mealTypeBadge = document.createElement('div');
            mealTypeBadge.className = 'menu-item-type';
            mealTypeBadge.textContent = item.mealType.charAt(0).toUpperCase() + item.mealType.slice(1);
            
            // Create dietary restriction tags
            const dietaryTags = document.createElement('div');
            dietaryTags.className = 'dietary-tags';
            
            if (item.dietaryRestrictions.length > 0) {
                item.dietaryRestrictions.forEach(restriction => {
                    const tagElement = document.createElement('span');
                    tagElement.className = 'dietary-tag';
                    
                    // Add appropriate icon
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'icon';
                    
                    if (restriction === 'vegetarian') {
                        iconSpan.className += ' veg-icon';
                    } else if (restriction === 'vegan') {
                        iconSpan.className += ' vegan-icon';
                    } else if (restriction === 'gluten-free') {
                        iconSpan.className += ' gf-icon';
                    } else if (restriction === 'dairy-free') {
                        iconSpan.className += ' df-icon';
                    }
                    
                    tagElement.appendChild(iconSpan);
                    
                    // Add text
                    const restrictionText = document.createTextNode(
                        restriction.split('-').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                        ).join('-')
                    );
                    tagElement.appendChild(restrictionText);
                    
                    dietaryTags.appendChild(tagElement);
                });
            }
            
            // Create menu item content
            menuItemElement.innerHTML = `
                <h3>${item.name}</h3>
                <div class="menu-item-price">${item.price}</div>
            `;
            
            menuItemElement.prepend(mealTypeBadge);
            menuItemElement.appendChild(dietaryTags);
            
            menuContainer.appendChild(menuItemElement);
        });
    }

    // Filter function
    function filterMenuItems() {
        const mealType = mealTypeFilter.value;
        const dietaryRestriction = dietaryFilter.value;
        const searchTerm = searchInput.value.toLowerCase();
        
        let filteredItems = menuItems;
        
        // Filter by meal type
        if (mealType !== 'all') {
            filteredItems = filteredItems.filter(item => item.mealType === mealType);
        }
        
        // Filter by dietary restriction
        if (dietaryRestriction !== 'all') {
            filteredItems = filteredItems.filter(item => 
                item.dietaryRestrictions.includes(dietaryRestriction)
            );
        }
        
        // Filter by search term
        if (searchTerm) {
            filteredItems = filteredItems.filter(item => 
                item.name.toLowerCase().includes(searchTerm)
            );
        }
        
        renderMenuItems(filteredItems);
    }

    // Add event listeners
    mealTypeFilter.addEventListener('change', filterMenuItems);
    dietaryFilter.addEventListener('change', filterMenuItems);
    searchInput.addEventListener('input', filterMenuItems);

    // Initial render
    renderMenuItems(menuItems);

    // Fetch and display user name if available
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        // Try to get user data from localStorage if available
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                if (user && user.name) {
                    userNameElement.textContent = user.name;
                }
            } catch (error) {
                console.error('Error parsing user data:', error);
            }
        }
    }
}); 