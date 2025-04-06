const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');
const db = require('../db');

router.post('/toggle', authMiddleware, async (req, res) => {
  try {
    const { is_active, max_transaction_amount } = req.body;
    const userId = req.user.id;

    await db.updateFairyStatus(userId, is_active, max_transaction_amount);
    
    const fairyStatus = await db.getFairyStatus(userId);
    res.json(fairyStatus);
  } catch (error) {
    console.error('Failed to update fairy status:', error);
    res.status(500).json({ error: 'Failed to update fairy status', details: error.message });
  }
});

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const fairyStatus = await db.getFairyStatus(userId);
    res.json(fairyStatus);
  } catch (error) {
    console.error('Failed to get fairy status:', error);
    res.status(500).json({ error: 'Failed to get fairy status', details: error.message });
  }
});

router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { location, amount, description } = req.body;
    const userId = req.user.id;
    
    if (!location || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    
    const pendingRequests = await db.getUserPendingRequests(userId);
    if (pendingRequests.length >= 3) {
      return res.status(400).json({ error: 'You have reached the maximum number of pending requests (3)' });
    }

    const requestId = await db.createFairyRequest(userId, location, amount, description);
    res.json({ success: true, request_id: requestId });
  } catch (error) {
    console.error('Failed to create fairy request:', error);
    res.status(500).json({ error: 'Failed to create fairy request', details: error.message });
  }
});

router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await db.getUserFairyRequests(userId);
    res.json({ requests });
  } catch (error) {
    console.error('Failed to get user fairy requests:', error);
    res.status(500).json({ error: 'Failed to get user fairy requests', details: error.message });
  }
});

router.get('/requests/pending', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const fairyStatus = await db.getFairyStatus(userId);
    
    const maxAmount = fairyStatus && fairyStatus.max_transaction_amount ? 
      fairyStatus.max_transaction_amount : null;
      
    const requests = await db.getPendingFairyRequests(userId, maxAmount);
    res.json({ requests });
  } catch (error) {
    console.error('Failed to get pending fairy requests:', error);
    res.status(500).json({ error: 'Failed to get pending fairy requests', details: error.message });
  }
});

router.get('/requests/accepted', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await db.getFairyAcceptedRequests(userId);
    res.json({ requests });
  } catch (error) {
    console.error('Failed to get accepted fairy requests:', error);
    res.status(500).json({ error: 'Failed to get accepted fairy requests', details: error.message });
  }
});

router.post('/request/accept', authMiddleware, async (req, res) => {
  try {
    const { request_id } = req.body;
    const fairyId = req.user.id;
    
    const fairyStatus = await db.getFairyStatus(fairyId);
    if (!fairyStatus.is_active) {
      return res.status(403).json({ error: 'You must be an active fairy to accept requests' });
    }
    
    const request = await db.getFairyRequestById(request_id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This request has already been accepted' });
    }
    
    if (request.requestor_id === fairyId) {
      return res.status(400).json({ error: 'You cannot accept your own request' });
    }
    
    const fairyBalance = await db.getUserBalance(fairyId);
    if (fairyBalance < request.amount) {
      return res.status(400).json({ error: 'You do not have enough balance to fulfill this request' });
    }
    
    await db.acceptFairyRequest(request_id, fairyId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to accept fairy request:', error);
    res.status(500).json({ error: 'Failed to accept fairy request', details: error.message });
  }
});

router.post('/request/cancel', authMiddleware, async (req, res) => {
  try {
    const { request_id } = req.body;
    const userId = req.user.id;
    
    const request = await db.getFairyRequestById(request_id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (request.requestor_id !== userId) {
      return res.status(403).json({ error: 'You can only cancel your own requests' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be cancelled' });
    }
    
    await db.cancelFairyRequest(request_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to cancel fairy request:', error);
    res.status(500).json({ error: 'Failed to cancel fairy request', details: error.message });
  }
});

router.post('/request/confirm', authMiddleware, async (req, res) => {
  try {
    const { request_id } = req.body;
    const fairyId = req.user.id;
    
    const request = await db.getFairyRequestById(request_id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (request.fairy_id !== fairyId) {
      return res.status(403).json({ error: 'You can only confirm requests you accepted' });
    }
    
    if (request.status !== 'accepted') {
      return res.status(400).json({ error: 'Only accepted requests can be confirmed' });
    }
    
    if (request.fairy_confirmed) {
      return res.status(400).json({ error: 'You have already confirmed this request' });
    }
    
    await db.confirmFairyRequest(request_id, fairyId, request.requestor_id, request.amount);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to confirm fairy request:', error);
    res.status(500).json({ error: 'Failed to confirm fairy request', details: error.message });
  }
});

router.post('/request/rate', authMiddleware, async (req, res) => {
  try {
    const { request_id, rating, comment } = req.body;
    const userId = req.user.id;
    
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid rating. Please provide a rating between 1 and 5' });
    }
    
    const request = await db.getFairyRequestById(request_id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (request.requestor_id !== userId) {
      return res.status(403).json({ error: 'You can only rate requests you created' });
    }
    
    if (request.status !== 'accepted') {
      return res.status(400).json({ error: 'Only accepted requests can be rated' });
    }
    
    if (request.requestor_confirmed) {
      return res.status(400).json({ error: 'You have already confirmed and rated this request' });
    }
    
    await db.rateFairyRequest(request_id, rating, comment);
    
    const updatedRequest = await db.getFairyRequestById(request_id);
    if (updatedRequest.fairy_confirmed && updatedRequest.requestor_confirmed) {
      await db.completeFairyRequest(request_id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to rate fairy request:', error);
    res.status(500).json({ error: 'Failed to rate fairy request', details: error.message });
  }
});

router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'all';
    const fairies = await db.getFairyLeaderboard(timeframe);
    res.json({ fairies });
  } catch (error) {
    console.error('Failed to get fairy leaderboard:', error);
    res.status(500).json({ error: 'Failed to get fairy leaderboard', details: error.message });
  }
});

module.exports = router; 