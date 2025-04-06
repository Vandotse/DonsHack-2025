const jwt = require('jsonwebtoken');

// Different secret keys to test
const secrets = {
  original: 'flexibudget-default-secret-key',
  new: 'your-secret-key'
};

// Mock user for token generation
const user = {
  id: 1,
  student_id: '123456',
  name: 'Test User',
  email: 'test@example.com'
};

// Generate tokens with both secrets
console.log('=== Generating tokens ===');
const originalPayload = {
  user_id: user.id,
  student_id: user.student_id
};
const newPayload = {
  user_id: user.id,
  student_id: user.student_id,
  name: user.name,
  email: user.email
};

const originalToken = jwt.sign(originalPayload, secrets.original, { expiresIn: '1h' });
const newToken = jwt.sign(newPayload, secrets.new, { expiresIn: '1h' });

console.log('Original token:', originalToken);
console.log('New token:', newToken);

// Verify tokens with both secrets
console.log('\n=== Verifying tokens ===');

console.log('\nVerifying original token with original secret:');
try {
  const decoded = jwt.verify(originalToken, secrets.original);
  console.log('✅ Valid. Decoded:', decoded);
} catch (err) {
  console.log('❌ Invalid:', err.message);
}

console.log('\nVerifying original token with new secret:');
try {
  const decoded = jwt.verify(originalToken, secrets.new);
  console.log('✅ Valid. Decoded:', decoded);
} catch (err) {
  console.log('❌ Invalid:', err.message);
}

console.log('\nVerifying new token with original secret:');
try {
  const decoded = jwt.verify(newToken, secrets.original);
  console.log('✅ Valid. Decoded:', decoded);
} catch (err) {
  console.log('❌ Invalid:', err.message);
}

console.log('\nVerifying new token with new secret:');
try {
  const decoded = jwt.verify(newToken, secrets.new);
  console.log('✅ Valid. Decoded:', decoded);
} catch (err) {
  console.log('❌ Invalid:', err.message);
}

// Generate a dummy token with generic secret for testing
const genericToken = jwt.sign({ foo: 'bar' }, 'generic-secret');

console.log('\nDummy token for testing:', genericToken); 