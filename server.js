import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import { users, interlocks, STOCKS_DATA } from './data/store.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve frontend static files from the 'frontend' directory
app.use(express.static(path.join(__dirname, 'frontend')));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ai = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// Auth Routes
app.post('/api/auth/register', (req, res) => {
    const { name, email, password, level = 'Beginner' } = req.body;
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email exists' });
    const user = { id: Date.now().toString(), name, email, password, balance: 100000, portfolio: [], trades: [], level };
    users.push(user);
    res.json({ user });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ user });
});

app.get('/api/auth/me', (req, res) => {
    const user = users.find(u => u.email === req.query.email);
    user ? res.json({ user }) : res.status(404).json({ error: 'Not found' });
});

// Markets Route
app.get('/api/markets', (req, res) => {
    res.json(Object.values(STOCKS_DATA));
});

// Trading Engine
app.post('/api/trade', (req, res) => {
    const { userId, type, ticker, quantity } = req.body;
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const stock = STOCKS_DATA[ticker];
    if (!stock) return res.status(400).json({ error: 'Invalid stock' });

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' });

    const totalCost = stock.price * qty;
    
    user.trades = user.trades || [];
    const executionDate = new Date().toISOString();

    if (type === 'BUY') {
        if (user.balance < totalCost) return res.status(400).json({ error: 'Insufficient funds' });
        user.balance -= totalCost;
        const existing = user.portfolio.find(p => p.ticker === ticker);
        if (existing) {
            existing.avgPrice = ((existing.qty * existing.avgPrice) + totalCost) / (existing.qty + qty);
            existing.qty += qty;
        } else {
            user.portfolio.push({ ticker, qty: qty, avgPrice: stock.price });
        }
        user.trades.push({ type, ticker, qty, price: stock.price, total: totalCost, date: executionDate });
        res.json({ message: 'Buy successful', user });
    } else if (type === 'SELL') {
        const existing = user.portfolio.find(p => p.ticker === ticker);
        if (!existing || existing.qty < qty) return res.status(400).json({ error: 'Insufficient shares' });
        
        user.balance += totalCost;
        existing.qty -= qty;
        if (existing.qty === 0) {
            user.portfolio = user.portfolio.filter(p => p.ticker !== ticker);
        }
        user.trades.push({ type, ticker, qty, price: stock.price, total: totalCost, date: executionDate });
        res.json({ message: 'Sell successful', user });
    } else {
        res.status(400).json({ error: 'Invalid trade type' });
    }
});


// AI Routes Mock/Integration
app.post('/api/vibe-trade', async (req, res) => {
    try {
        if (!ai) return res.json({ reply: "I am Labh Sathi! Please add GROQ_API_KEY in .env to enable my AI brain. Right now, I'm just a simple bot. But I can tell you the market looks interesting today!" });
        const { prompt } = req.body;
        const response = await ai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: 'You are Labh Sathi, a helpful AI assistant for the Indian Stock Market.' }, { role: 'user', content: prompt }],
            max_tokens: 300
        });
        res.json({ reply: response.choices[0].message.content });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "AI Error: " + e.message }); 
    }
});

app.post('/api/roast', async (req, res) => {
    if (!ai) return res.json({ roastText: "Your portfolio is too boring to roast. Add GROQ_API_KEY to get the real FIRE! 🔥", riskScore: 5 });
    try {
        const response = await ai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Roast this stock portfolio: ' + JSON.stringify(req.body.portfolio) + '. Return pure JSON format: { "roastText": "string", "riskScore": integer } without any markdown like ```json' }],
            max_tokens: 200
        });
        let content = response.choices[0].message.content.trim();
        if(content.startsWith('```json')) content = content.replace(/```json/g, '').replace(/```/g, '');
        else if(content.startsWith('```')) content = content.replace(/```/g, '');
        res.json(JSON.parse(content));
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "AI Error: " + e.message }); 
    }
});

// Serve index.html for unknown routes (SPA behavior fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
