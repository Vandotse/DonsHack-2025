/**
 * Demo data initialization script
 * Run with: node init-demo-data.js
 * 
 * This script creates demo data for the FlexiBudget application:
 * - Creates fairy requests
 * - Accepts some requests
 * - Completes some requests
 * - Adds ratings
 */

const db = require('./db');

const sqlite3 = require('sqlite3').verbose();
const dbConnection = new sqlite3.Database('flexibudget.db');

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    dbConnection.run(query, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function initializeDemoData() {
  console.log('Initializing demo data...');
  
  try {
    
    const testUsers = [
      { student_id: '10000001', name: 'Alice Johnson', email: 'alice@example.com', password: 'password123' },
      { student_id: '10000002', name: 'Bob Smith', email: 'bob@example.com', password: 'password123' },
      { student_id: '10000003', name: 'Charlie Davis', email: 'charlie@example.com', password: 'password123' },
      { student_id: '10000004', name: 'Diana Miller', email: 'diana@example.com', password: 'password123' },
      { student_id: '10000005', name: 'Ethan Wilson', email: 'ethan@example.com', password: 'password123' }
    ];
    
    const createdUsers = [];
    
    for (const userData of testUsers) {
      const existingUser = await db.getUserByStudentId(userData.student_id);
      if (!existingUser) {
        const user = await db.createUser(
          userData.student_id,
          userData.name,
          userData.email,
          userData.password
        );
        createdUsers.push(user);
        console.log(`Created user: ${userData.name}`);
      } else {
        createdUsers.push(existingUser);
        console.log(`User ${userData.name} already exists`);
      }
    }
    
    const fairyUsers = [createdUsers[0], createdUsers[2], createdUsers[4]];
    for (const user of fairyUsers) {
      await db.updateFairyStatus(user.id, true, 50);
      console.log(`Activated fairy status for ${user.name}`);
    }
    
    const locations = ['Lone Mountain', 'Market Cafe', 'Wolf & Kettle', 'Crossroads Cafe', 'Koret Health Center'];
    const descriptions = [
      'Need help with lunch today!',
      'Running low on flexi, would appreciate help',
      'Forgot my wallet and need food',
      'Any fairy available to help with dinner?',
      'Studying late and need a coffee, please help!',
      'Need some food before my exam'
    ];
    
    const requesters = [createdUsers[1], createdUsers[3]];
    
    for (let i = 0; i < 8; i++) {
      const requester = requesters[i % requesters.length];
      const amount = 5 + Math.random() * 20;
      const location = locations[Math.floor(Math.random() * locations.length)];
      const description = descriptions[Math.floor(Math.random() * descriptions.length)];
      
      const result = await db.createFairyRequest(
        requester.id,
        location,
        amount.toFixed(2),
        description
      );
      
      const requestId = result.lastID;
      
      console.log(`Created request #${requestId} from ${requester.name}`);
      
      if (i % 3 === 0) {
        const fairy = fairyUsers[i % fairyUsers.length];
        await db.acceptFairyRequest(requestId, fairy.id);
        console.log(`Request #${requestId} accepted by ${fairy.name}`);
        
        if (i % 2 === 0) {
          try {
            const request = await db.getFairyRequestById(requestId);
            if (!request || request.status !== 'accepted') {
              console.log(`Skipping confirmation of request #${requestId} as it's not in accepted state`);
              continue;
            }
            
            await run(
              `UPDATE fairy_requests 
               SET fairy_confirmed = 1, requestor_confirmed = 1, 
                   status = 'completed', updated_at = datetime('now') 
               WHERE id = ?`,
              [requestId]
            );
            
            console.log(`Request #${requestId} completed`);
          } catch (error) {
            console.error(`Error completing request #${requestId}:`, error.message);
          }
        }
      }
    }
    
    console.log('Demo data initialization completed!');
    console.log('\nTest Users (student_id: password)');
    testUsers.forEach(user => {
      console.log(`${user.name} (${user.student_id}): password123`);
    });
    
  } catch (error) {
    console.error('Error initializing demo data:', error);
  } finally {
    process.exit();
  }
}

initializeDemoData(); 