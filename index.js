const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const expenseRoutes = require('./routes/expenseRoutes');

dotenv.config();

const app = express();
app.use(cors({
  origin: ['https://smart-split-frontend.vercel.app'],
  credentials: true
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);

app.get("/", (req, res) => res.send("SmartSplit Backend Running"));

mongoose.connect(process.env.MONGO_URI, {
    //useNewUrlParser: true,
    //useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected")).catch(err => console.error("MongoDB Error:", err));

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


